import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fromShopInput, toShopInput } from "@/lib/admin/dates";
import { sectionSchemas, type SectionType } from "@/lib/home-sections";
import {
  checkSection,
  isShopImage,
  isShopLink,
  LINK_TYPES,
  scheduleProblem,
  schemaFor,
  type AnnouncementsDoc,
  type DocKey,
  type HomeDoc,
  type LinkType,
  type MenuDoc,
  type MenuLinkDoc,
  type PageDoc,
  type PopupsDoc,
} from "./docs";
import { cleanRichText, emptyDoc } from "./rich-text";

/**
 * Reading and publishing the content documents described in ./docs.ts.
 *
 *   - loadPublished(key): what the shop shows now, read from the real tables.
 *   - saveDraft / loadDraft: unpublished changes (shown only in Preview).
 *   - publish(key, doc): writes the tables, keeps a version, clears the draft.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export type DocOf<K extends DocKey> = K extends "home"
  ? HomeDoc
  : K extends "menu"
    ? MenuDoc
    : K extends "announcements"
      ? AnnouncementsDoc
      : K extends "popups"
        ? PopupsDoc
        : PageDoc;

/** How many published versions of each piece of content are kept for undo. */
export const KEEP_VERSIONS = 10;

const iso = (text: string) => fromShopInput(text);

// ── Reading what's published ────────────────────────────────────

export async function loadPublished<K extends DocKey>(key: K, db: Db = prisma): Promise<DocOf<K> | null> {
  if (key === "home") {
    const rows = await db.homeSection.findMany({ orderBy: { order: "asc" } });
    const doc: HomeDoc = {
      sections: rows
        .filter((r) => r.type in sectionSchemas)
        .map((r) => ({
          id: r.id,
          type: r.type as SectionType,
          title: r.title ?? "",
          active: r.active,
          startsAt: toShopInput(r.startsAt),
          endsAt: toShopInput(r.endsAt),
          config: r.config && typeof r.config === "object" && !Array.isArray(r.config) ? (r.config as Record<string, unknown>) : {},
        })),
    };
    return doc as DocOf<K>;
  }

  if (key === "menu") {
    const rows = await db.menuItem.findMany({
      where: { parentId: null },
      orderBy: { order: "asc" },
      include: { children: { orderBy: { order: "asc" } } },
    });
    const link = (m: (typeof rows)[number]["children"][number]) => ({
      id: m.id,
      label: m.label,
      linkType: (m.linkType in LINK_TYPES ? m.linkType : "url") as LinkType,
      targetId: m.targetId ?? "",
      url: m.linkType === "url" && m.url !== "#" ? m.url : "",
      image: m.image ?? "",
    });
    const group = (location: string): MenuLinkDoc[] =>
      rows.filter((r) => r.location === location).map((r) => ({ ...link(r), children: r.children.map(link) }));
    const doc: MenuDoc = { header: group("header"), footer: group("footer") };
    return doc as DocOf<K>;
  }

  if (key === "announcements") {
    const rows = await db.banner.findMany({ where: { placement: "announcement" }, orderBy: { order: "asc" } });
    const doc: AnnouncementsDoc = {
      items: rows.map((b) => ({
        id: b.id,
        text: b.title ?? "",
        link: b.link ?? "",
        active: b.active,
        startsAt: toShopInput(b.startsAt),
        endsAt: toShopInput(b.endsAt),
      })),
    };
    return doc as DocOf<K>;
  }

  if (key === "popups") {
    const rows = await db.popup.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
    const doc: PopupsDoc = {
      items: rows.map((p) => ({
        id: p.id,
        kind: p.kind === "newsletter" ? "newsletter" : "sale",
        title: p.title ?? "",
        body: p.body ?? "",
        image: p.image ?? "",
        buttonLabel: p.buttonLabel ?? "",
        buttonLink: p.buttonLink ?? "",
        delaySeconds: p.delaySeconds,
        active: p.active,
        startsAt: toShopInput(p.startsAt),
        endsAt: toShopInput(p.endsAt),
      })),
    };
    return doc as DocOf<K>;
  }

  const page = await db.page.findUnique({ where: { id: key.slice("page:".length) } });
  if (!page) return null;
  const doc: PageDoc = {
    title: page.title,
    slug: page.slug,
    content: cleanRichText(page.content) ?? emptyDoc(),
    seoTitle: page.seoTitle ?? "",
    seoDescription: page.seoDescription ?? "",
    published: page.published,
  };
  return doc as DocOf<K>;
}

// ── Drafts ──────────────────────────────────────────────────────

/** The saved draft, or null if there isn't one (or it no longer fits the editor). */
export async function loadDraft<K extends DocKey>(key: K): Promise<DocOf<K> | null> {
  const row = await prisma.contentDraft.findUnique({ where: { key } });
  if (!row) return null;
  const parsed = schemaFor(key).safeParse(row.data);
  return parsed.success ? (parsed.data as DocOf<K>) : null;
}

/** What the editor opens with: the draft if there is one, otherwise what's live. */
export async function loadForEditing<K extends DocKey>(key: K) {
  const [published, draftRow] = await Promise.all([loadPublished(key), prisma.contentDraft.findUnique({ where: { key } })]);
  const draft = draftRow ? schemaFor(key).safeParse(draftRow.data) : null;
  return {
    doc: (draft?.success ? draft.data : published) as DocOf<K> | null,
    draftSavedAt: draft?.success ? draftRow!.updatedAt : null,
  };
}

export async function saveDraft(key: DocKey, doc: unknown, userId: string) {
  const data = doc as Prisma.InputJsonValue;
  await prisma.contentDraft.upsert({ where: { key }, create: { key, data, updatedById: userId }, update: { data, updatedById: userId } });
}

export async function discardDraft(key: DocKey) {
  await prisma.contentDraft.deleteMany({ where: { key } });
}

// ── Checking before publishing ──────────────────────────────────

/** Everything that would stop this content from showing properly, in plain words. */
export async function problemsWith(key: DocKey, doc: unknown): Promise<string[]> {
  const problems: string[] = [];
  const link = (where: string, href: string) => {
    if (href && !isShopLink(href)) problems.push(`${where}: use a shop page like /sale or a full web address (https://…)`);
  };
  const schedule = (where: string, s: string, e: string) => {
    const p = scheduleProblem(s, e);
    if (p) problems.push(`${where}: ${p}`);
  };

  if (key === "home") {
    for (const section of (doc as HomeDoc).sections) {
      const result = checkSection(section);
      if ("problems" in result) problems.push(...result.problems);
    }
  } else if (key === "menu") {
    const menu = doc as MenuDoc;
    const all = [...menu.header, ...menu.footer].flatMap((l) => [l, ...l.children]);
    const ids = (type: LinkType) => all.filter((l) => l.linkType === type).map((l) => l.targetId);
    const [categories, collections, brands, pages] = await Promise.all([
      prisma.category.findMany({ where: { id: { in: ids("category") } }, select: { id: true } }),
      prisma.collection.findMany({ where: { id: { in: ids("collection") } }, select: { id: true } }),
      prisma.brand.findMany({ where: { id: { in: ids("brand") } }, select: { id: true } }),
      prisma.page.findMany({ where: { id: { in: ids("page") } }, select: { id: true } }),
    ]);
    const exists = new Set([...categories, ...collections, ...brands, ...pages].map((r) => r.id));
    const check = (l: MenuLinkDoc | Omit<MenuLinkDoc, "children">, where: string, headingOnly: boolean) => {
      if (l.linkType === "url") {
        if (!l.url && !headingOnly) problems.push(`${where} “${l.label}”: enter the link`);
        link(`${where} “${l.label}”`, l.url);
      } else if (!exists.has(l.targetId)) {
        problems.push(`${where} “${l.label}”: choose which ${LINK_TYPES[l.linkType].toLowerCase()} it goes to`);
      }
      if (l.image && !isShopImage(l.image)) problems.push(`${where} “${l.label}”: upload the picture through the admin`);
    };
    for (const l of menu.header) {
      check(l, "Header", false);
      l.children.forEach((c) => check(c, "Header", false));
    }
    for (const l of menu.footer) {
      check(l, "Footer column", true); // footer columns are headings; a link is optional
      l.children.forEach((c) => check(c, "Footer", false));
    }
  } else if (key === "announcements") {
    (doc as AnnouncementsDoc).items.forEach((a, i) => {
      link(`Message ${i + 1}`, a.link);
      schedule(`Message ${i + 1}`, a.startsAt, a.endsAt);
    });
  } else if (key === "popups") {
    (doc as PopupsDoc).items.forEach((p, i) => {
      const where = `Pop-up ${i + 1}${p.title ? ` “${p.title}”` : ""}`;
      if (!p.title && !p.body) problems.push(`${where}: add a heading or some text`);
      if (p.image && !isShopImage(p.image)) problems.push(`${where}: upload the picture through the admin`);
      if (p.buttonLabel && !p.buttonLink) problems.push(`${where}: the button needs a link`);
      link(where, p.buttonLink);
      schedule(where, p.startsAt, p.endsAt);
    });
  } else {
    const page = doc as PageDoc;
    const id = key.slice("page:".length);
    if (!cleanRichText(page.content)) problems.push("The page text couldn't be read — reload and try again");
    const clash = await prisma.page.findFirst({ where: { slug: page.slug, id: { not: id } }, select: { title: true } });
    if (clash) problems.push(`Web address: “${clash.title}” already uses /pages/${page.slug}`);
  }
  return problems;
}

// ── Publishing ──────────────────────────────────────────────────

async function write(key: DocKey, doc: unknown, db: Prisma.TransactionClient) {
  if (key === "home") {
    const { sections } = doc as HomeDoc;
    await db.homeSection.deleteMany({ where: { id: { notIn: sections.map((s) => s.id) } } });
    for (const [order, s] of sections.entries()) {
      const result = checkSection(s);
      const data = {
        type: s.type,
        title: s.title || null,
        config: ("config" in result ? result.config : s.config) as Prisma.InputJsonValue,
        order,
        active: s.active,
        startsAt: iso(s.startsAt),
        endsAt: iso(s.endsAt),
      };
      await db.homeSection.upsert({ where: { id: s.id }, create: { id: s.id, ...data }, update: data });
    }
  } else if (key === "menu") {
    const menu = doc as MenuDoc;
    const groups = [
      ["header", menu.header],
      ["footer", menu.footer],
    ] as const;
    const ids = groups.flatMap(([, links]) => links.flatMap((l) => [l.id, ...l.children.map((c) => c.id)]));
    await db.menuItem.deleteMany({ where: { id: { notIn: ids } } });
    const data = (l: Omit<MenuLinkDoc, "children">, location: string, order: number, parentId: string | null) => ({
      label: l.label,
      linkType: l.linkType,
      targetId: l.linkType === "url" ? null : l.targetId,
      url: l.linkType === "url" ? l.url || "#" : "#", // other links get their address when the shop loads them
      image: l.image || null,
      location,
      order,
      parentId,
    });
    for (const [location, links] of groups) {
      for (const [order, l] of links.entries()) {
        const top = data(l, location, order, null);
        await db.menuItem.upsert({ where: { id: l.id }, create: { id: l.id, ...top }, update: top });
        for (const [childOrder, c] of l.children.entries()) {
          const child = data(c, location, childOrder, l.id);
          await db.menuItem.upsert({ where: { id: c.id }, create: { id: c.id, ...child }, update: child });
        }
      }
    }
  } else if (key === "announcements") {
    const { items } = doc as AnnouncementsDoc;
    await db.banner.deleteMany({ where: { placement: "announcement", id: { notIn: items.map((a) => a.id) } } });
    for (const [order, a] of items.entries()) {
      const data = { title: a.text, link: a.link || null, placement: "announcement", active: a.active, order, startsAt: iso(a.startsAt), endsAt: iso(a.endsAt) };
      await db.banner.upsert({ where: { id: a.id }, create: { id: a.id, ...data }, update: data });
    }
  } else if (key === "popups") {
    const { items } = doc as PopupsDoc;
    await db.popup.deleteMany({ where: { id: { notIn: items.map((p) => p.id) } } });
    for (const [order, p] of items.entries()) {
      const data = {
        kind: p.kind,
        title: p.title || null,
        body: p.body || null,
        image: p.image || null,
        buttonLabel: p.buttonLabel || null,
        buttonLink: p.buttonLink || null,
        delaySeconds: p.delaySeconds,
        order,
        active: p.active,
        startsAt: iso(p.startsAt),
        endsAt: iso(p.endsAt),
      };
      await db.popup.upsert({ where: { id: p.id }, create: { id: p.id, ...data }, update: data });
    }
  } else {
    const page = doc as PageDoc;
    await db.page.update({
      where: { id: key.slice("page:".length) },
      data: {
        title: page.title,
        slug: page.slug,
        content: (cleanRichText(page.content) ?? emptyDoc()) as Prisma.InputJsonValue,
        seoTitle: page.seoTitle || null,
        seoDescription: page.seoDescription || null,
        published: page.published,
      },
    });
  }
}

/** Removes all but the newest KEEP_VERSIONS versions of one piece of content. */
export async function trimVersions(key: string, db: Db = prisma) {
  const old = await db.contentVersion.findMany({ where: { key }, orderBy: { createdAt: "desc" }, skip: KEEP_VERSIONS, select: { id: true } });
  if (old.length) await db.contentVersion.deleteMany({ where: { id: { in: old.map((v) => v.id) } } });
}

/**
 * Makes this the live content: writes it to the tables, keeps it as a version
 * (the first publish also keeps what was there before, so it can be undone)
 * and removes the draft. Check it with problemsWith() first.
 */
export async function publish(key: DocKey, doc: unknown, userId: string) {
  await prisma.$transaction(
    async (tx) => {
      if ((await tx.contentVersion.count({ where: { key } })) === 0) {
        const before = await loadPublished(key, tx);
        if (before) await tx.contentVersion.create({ data: { key, data: before as Prisma.InputJsonValue, createdAt: new Date(Date.now() - 1000) } });
      }
      await write(key, doc, tx);
      await tx.contentVersion.create({ data: { key, data: doc as Prisma.InputJsonValue, userId } });
      await trimVersions(key, tx);
      await tx.contentDraft.deleteMany({ where: { key } });
    },
    { timeout: 30_000 },
  );
}

export type VersionRow = { id: string; createdAt: Date; by: string | null };

/** Newest first; the first one is what's live now. */
export async function listVersions(key: string): Promise<VersionRow[]> {
  const rows = await prisma.contentVersion.findMany({
    where: { key },
    orderBy: { createdAt: "desc" },
    take: KEEP_VERSIONS,
    select: { id: true, createdAt: true, userId: true, user: { select: { name: true, email: true } } },
  });
  return rows.map((v) => ({ id: v.id, createdAt: v.createdAt, by: v.userId ? (v.user?.name ?? v.user?.email ?? "Removed user") : null }));
}
