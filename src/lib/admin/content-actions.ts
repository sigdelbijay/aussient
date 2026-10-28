"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/dal";
import { isDocKey, schemaFor, type DocKey, type PageDoc } from "@/lib/content/docs";
import { cleanRichText, emptyDoc } from "@/lib/content/rich-text";
import { discardDraft, loadPublished, problemsWith, publish, saveDraft } from "@/lib/content/store";
import { addRedirect, normalizePath } from "@/lib/redirects";
import { recordChange } from "./activity";
import { formatShopDate } from "./dates";
import { uniqueSlug } from "./slug";

/**
 * Save draft / publish / undo for everything under /admin/content (home page,
 * menus, announcement bar, pop-ups, pages). STAFF and ADMIN can use these.
 * Publishing refreshes the cached shop pages straight away.
 */

export type ContentState =
  | {
      error?: string;
      message?: string;
      problems?: string[];
      /** After discarding a draft or restoring a version: what the editor should show now. */
      doc?: unknown;
      /** False once published (no draft left), true after saving a draft. */
      hasDraft?: boolean;
    }
  | undefined;

const NAMES: Record<string, string> = { home: "Home page", menu: "Menus", announcements: "Announcement bar", popups: "Pop-ups" };
const nameOf = (key: DocKey, doc?: unknown) => NAMES[key] ?? `Page “${(doc as PageDoc | undefined)?.title ?? ""}”`;

/** Checks the key and the shape of the document sent from the browser. */
function parse(key: string, doc: unknown): { key: DocKey; doc: unknown } | { error: string } {
  if (!isDocKey(key)) return { error: "Unknown content." };
  const parsed = schemaFor(key).safeParse(doc);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `Please check: ${issue.message}` };
  }
  const data = parsed.data;
  // Page text is cleaned to what the shop can show.
  if (key.startsWith("page:")) (data as PageDoc).content = cleanRichText((data as PageDoc).content) ?? emptyDoc();
  return { key, doc: data };
}

/** The admin's content pages show draft status, so reload them. */
const refreshAdmin = () => revalidatePath("/admin/content", "layout");

export async function saveDraftAction(key: string, doc: unknown): Promise<ContentState> {
  const user = await requireStaff();
  const p = parse(key, doc);
  if ("error" in p) return { error: p.error };
  if (p.key.startsWith("page:") && !(await prisma.page.findUnique({ where: { id: p.key.slice(5) } }))) return { error: "This page was deleted." };
  await saveDraft(p.key, p.doc, user.id);
  refreshAdmin();
  return { hasDraft: true, message: `Draft saved ${formatShopDate(new Date())}. Only you and other staff can see it in Preview.` };
}

export async function discardDraftAction(key: string): Promise<ContentState> {
  await requireStaff();
  if (!isDocKey(key)) return { error: "Unknown content." };
  await discardDraft(key);
  refreshAdmin();
  return { hasDraft: false, doc: await loadPublished(key), message: "Draft thrown away — showing what's live." };
}

/** Makes the content live. Problems (a missing picture, a broken link…) stop it, listed in plain words. */
export async function publishAction(key: string, doc: unknown): Promise<ContentState> {
  const user = await requireStaff();
  const p = parse(key, doc);
  if ("error" in p) return { error: p.error };
  const problems = await problemsWith(p.key, p.doc);
  if (problems.length) return { error: "Fix these before publishing:", problems };

  // A published page that moves to a new web address leaves a redirect behind.
  let moved: { from: string; to: string } | null = null;
  if (p.key.startsWith("page:")) {
    const before = await loadPublished(p.key as `page:${string}`);
    if (!before) return { error: "This page was deleted." };
    const after = p.doc as PageDoc;
    if (before.published && before.slug !== after.slug) moved = { from: `/pages/${before.slug}`, to: `/pages/${after.slug}` };
  }

  await publish(p.key, p.doc, user.id);
  if (moved) await addRedirect(moved.from, moved.to);
  await recordChange(
    user,
    { action: "content.publish", entity: "Content", entityId: p.key, detail: { name: nameOf(p.key, p.doc), ...(moved && { redirect: `${moved.from} → ${moved.to}` }) } },
    { refresh: ["content"] },
  );
  refreshAdmin();
  return { hasDraft: false, message: `${nameOf(p.key, p.doc)} published — the shop shows it now.` };
}

/** Undo: puts an earlier version back live. */
export async function restoreVersionAction(versionId: string): Promise<ContentState> {
  const user = await requireStaff();
  const version = await prisma.contentVersion.findUnique({ where: { id: z.string().max(64).parse(versionId) } });
  if (!version || version.key === "settings") return { error: "That version no longer exists." };
  const p = parse(version.key, version.data);
  if ("error" in p) return { error: "That version can't be restored any more — the editor has changed since." };
  const problems = await problemsWith(p.key, p.doc);
  if (problems.length) return { error: "That version can't go back live as it is:", problems };
  if (p.key.startsWith("page:")) {
    const before = await loadPublished(p.key as `page:${string}`);
    const after = p.doc as PageDoc;
    if (before?.published && before.slug !== after.slug) await addRedirect(`/pages/${before.slug}`, `/pages/${after.slug}`);
  }
  await publish(p.key, p.doc, user.id);
  await recordChange(
    user,
    { action: "content.restore", entity: "Content", entityId: p.key, detail: { name: nameOf(p.key, p.doc), restored: formatShopDate(version.createdAt) } },
    { refresh: ["content"] },
  );
  refreshAdmin();
  return { hasDraft: false, doc: p.doc, message: `Restored the version from ${formatShopDate(version.createdAt)}. It's live now.` };
}

// ── Pages ───────────────────────────────────────────────────────

export async function createPageAction(formData: FormData) {
  const user = await requireStaff();
  const title = z.string().trim().min(1).max(100).catch("New page").parse(formData.get("title"));
  const slug = await uniqueSlug(title.slice(0, 50), async (s) => !!(await prisma.page.findUnique({ where: { slug: s } })));
  const page = await prisma.page.create({ data: { title, slug, content: emptyDoc(), published: false } });
  await recordChange(user, { action: "page.create", entity: "Page", entityId: page.id, detail: { name: title } }, { refresh: ["content"] });
  redirect(`/admin/content/pages/${page.id}`);
}

export async function deletePageAction(pageId: string): Promise<ContentState> {
  const user = await requireStaff();
  const page = await prisma.page.findUnique({ where: { id: z.string().max(64).parse(pageId) } });
  if (!page) redirect("/admin/content/pages");
  const key = `page:${page.id}`;
  await prisma.$transaction([
    // Menu links to it would go nowhere.
    prisma.menuItem.deleteMany({ where: { linkType: "page", targetId: page.id } }),
    prisma.contentDraft.deleteMany({ where: { key } }),
    prisma.contentVersion.deleteMany({ where: { key } }),
    prisma.page.delete({ where: { id: page.id } }),
  ]);
  await recordChange(user, { action: "page.delete", entity: "Page", entityId: page.id, detail: { name: page.title, slug: page.slug } }, { refresh: ["content"] });
  redirect("/admin/content/pages");
}

// ── Redirects ───────────────────────────────────────────────────

const RESERVED = /^\/(admin|api|_next)(\/|$)/;

export async function saveRedirectAction(_prev: ContentState, formData: FormData): Promise<ContentState> {
  const user = await requireStaff();
  const fromRaw = String(formData.get("from") ?? "").trim();
  const toRaw = String(formData.get("to") ?? "").trim();
  // Someone may paste a full link to this shop; keep just the path.
  const pathOf = (v: string) => {
    try {
      const u = new URL(v);
      return u.host === new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").host ? u.pathname : v;
    } catch {
      return v;
    }
  };
  const from = fromRaw ? normalizePath(pathOf(fromRaw)) : "";
  const toPath = pathOf(toRaw);
  const to = toPath.startsWith("/") ? normalizePath(toPath) : toPath;

  if (!from || from === "/" || /\s/.test(from) || from.startsWith("//") || from.length > 300) return { error: "Enter the old link, e.g. /products/old-name" };
  if (RESERVED.test(from)) return { error: "Admin and system links can't be redirected." };
  if (!(to.startsWith("/") && !to.startsWith("//")) && !/^https:\/\//.test(to)) return { error: "Enter the new link: a shop page like /sale, or a full https:// address" };
  if (to.length > 500 || /\s/.test(to)) return { error: "The new link looks wrong — check for spaces." };
  if (from === to) return { error: "The old and new links are the same." };

  await addRedirect(from, to);
  await recordChange(user, { action: "redirect.save", entity: "Redirect", entityId: from, detail: { from, to } }, { refresh: ["content"] });
  revalidatePath("/admin/content/redirects");
  return { message: `${from} now goes to ${to}.` };
}

export async function deleteRedirectAction(id: string): Promise<ContentState> {
  const user = await requireStaff();
  const r = await prisma.redirect.findUnique({ where: { id: z.string().max(64).parse(id) } });
  if (!r) return { message: "Already removed." };
  await prisma.redirect.delete({ where: { id: r.id } });
  await recordChange(user, { action: "redirect.delete", entity: "Redirect", entityId: r.from, detail: { from: r.from, to: r.to } }, { refresh: ["content"] });
  revalidatePath("/admin/content/redirects");
  return { message: `Removed ${r.from}.` };
}
