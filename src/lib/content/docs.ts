import { z } from "zod";
import { fromShopInput } from "@/lib/admin/dates";
import { sectionSchemas, type SectionType } from "@/lib/home-sections";
import { safeHref } from "./rich-text";
import { SECTION_LABELS } from "./section-fields";

/**
 * The shop content edited under /admin/content, as "documents": each editor
 * loads one, saves it as a draft (seen only in Preview), then publishes it.
 * Publishing writes it to the real tables (see src/lib/content/store.ts) and
 * keeps a copy so the change can be undone.
 *
 *   "home"          → HomeSection rows
 *   "menu"          → MenuItem rows (header and footer)
 *   "announcements" → Banner rows with placement "announcement"
 *   "popups"        → Popup rows
 *   "page:<id>"     → one Page row
 *
 * Dates are kept as Sydney time text ("2026-11-01T09:00", or "" for none),
 * exactly as the admin's date boxes show them.
 */

export type DocKey = "home" | "menu" | "announcements" | "popups" | `page:${string}`;

export const isDocKey = (key: string): key is DocKey =>
  ["home", "menu", "announcements", "popups"].includes(key) || /^page:[A-Za-z0-9_-]{1,40}$/.test(key);

/** Ids for new rows are made in the browser, so a draft and the published row share one id. */
const itemId = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, "Bad id");
const when = z.string().max(20);
const shortText = (max: number) => z.string().trim().max(max);

// ── Home page ───────────────────────────────────────────────────

export const homeSectionDoc = z.object({
  id: itemId,
  type: z.enum(Object.keys(sectionSchemas) as [SectionType, ...SectionType[]]),
  title: shortText(80),
  active: z.boolean(),
  startsAt: when,
  endsAt: when,
  // Each type's settings; only checked in full when publishing (a draft can be half-done).
  config: z.record(z.string(), z.unknown()),
});
export const homeDoc = z.object({ sections: z.array(homeSectionDoc).max(40) });
export type HomeDoc = z.infer<typeof homeDoc>;
export type HomeSectionDoc = z.infer<typeof homeSectionDoc>;

// ── Menus ───────────────────────────────────────────────────────

export const LINK_TYPES = {
  category: "Category",
  collection: "Collection",
  brand: "Brand",
  page: "Page",
  url: "Custom link",
} as const;
export type LinkType = keyof typeof LINK_TYPES;

const menuLinkFields = {
  id: itemId,
  label: shortText(60).min(1, "Every link needs a label"),
  linkType: z.enum(Object.keys(LINK_TYPES) as [LinkType, ...LinkType[]]),
  targetId: z.string().max(64), // the category/collection/brand/page id
  url: z.string().trim().max(300), // the custom link
  image: z.string().max(500), // header only: the mega-menu promo picture
};
const menuLink = z.object({ ...menuLinkFields, children: z.array(z.object(menuLinkFields)).max(30) });
export const menuDoc = z.object({ header: z.array(menuLink).max(15), footer: z.array(menuLink).max(8) });
export type MenuDoc = z.infer<typeof menuDoc>;
export type MenuLinkDoc = z.infer<typeof menuLink>;

// ── Announcement bar ────────────────────────────────────────────

export const announcementsDoc = z.object({
  items: z
    .array(
      z.object({
        id: itemId,
        text: shortText(120).min(1, "Every message needs some text"),
        link: z.string().trim().max(300),
        active: z.boolean(),
        startsAt: when,
        endsAt: when,
      }),
    )
    .max(20),
});
export type AnnouncementsDoc = z.infer<typeof announcementsDoc>;

// ── Pop-ups ─────────────────────────────────────────────────────

export const popupsDoc = z.object({
  items: z
    .array(
      z.object({
        id: itemId,
        kind: z.enum(["newsletter", "sale"]),
        title: shortText(80),
        body: shortText(400),
        image: z.string().max(500),
        buttonLabel: shortText(30),
        buttonLink: z.string().trim().max(300),
        delaySeconds: z.number().int().min(0, "0 to 120 seconds").max(120, "0 to 120 seconds"),
        active: z.boolean(),
        startsAt: when,
        endsAt: when,
      }),
    )
    .max(10),
});
export type PopupsDoc = z.infer<typeof popupsDoc>;

// ── Pages ───────────────────────────────────────────────────────

export const pageDoc = z.object({
  title: shortText(100).min(1, "Give the page a title"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes, e.g. shipping-info")
    .max(60),
  content: z.unknown(), // Tiptap document, cleaned by cleanRichText
  seoTitle: shortText(70),
  seoDescription: shortText(170),
  published: z.boolean(),
});
export type PageDoc = z.infer<typeof pageDoc>;

export function schemaFor(key: DocKey) {
  if (key === "home") return homeDoc;
  if (key === "menu") return menuDoc;
  if (key === "announcements") return announcementsDoc;
  if (key === "popups") return popupsDoc;
  return pageDoc;
}

// ── Checks shared by the editors and publishing ─────────────────

/** Pictures must come from the media library (Cloudinary), so the shop can resize them. */
export function isShopImage(url: string) {
  return /^https:\/\/(res\.cloudinary\.com|placehold\.co)\//.test(url);
}

/** A shop link: a page on this site (/sale) or a full web address. */
export function isShopLink(href: string) {
  return safeHref(href) !== null;
}

/** Problems with a start/end pair, in words ("" if fine). */
export function scheduleProblem(startsAt: string, endsAt: string) {
  const s = fromShopInput(startsAt);
  const e = fromShopInput(endsAt);
  if (s && Number.isNaN(s.getTime())) return "the start date isn't a date";
  if (e && Number.isNaN(e.getTime())) return "the end date isn't a date";
  if (s && e && e <= s) return "the end must be after the start";
  return "";
}

/** Blank boxes in a section's settings are left out (so optional ones stay optional). */
export function cleanConfig(value: unknown): unknown {
  if (typeof value === "string") return value.trim() === "" ? undefined : value.trim();
  if (Array.isArray(value)) return value.map(cleanConfig).filter((v) => v !== undefined);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const c = cleanConfig(v);
      if (c !== undefined) out[k] = c;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

/** Calls visit(path, key, text) for every bit of text in a section's settings. */
function walk(value: unknown, path: string, key: string, visit: (path: string, key: string, v: string) => void) {
  if (typeof value === "string") visit(path, key, value);
  else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path} ${i + 1}`, key, visit));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, path ? `${path} ${k}` : k, k, visit);
}

/**
 * A home section ready to publish: its settings checked against its type.
 * Returns the cleaned settings, or a list of problems in plain words.
 */
export function checkSection(section: HomeSectionDoc): { config: unknown } | { problems: string[] } {
  const name = section.title || SECTION_LABELS[section.type];
  const problems: string[] = [];
  const config = cleanConfig(section.config) ?? {};
  const parsed = sectionSchemas[section.type].safeParse(config);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const where = issue.path.map((p) => (typeof p === "number" ? p + 1 : String(p))).join(" ") || "settings";
      problems.push(`${name}: ${where} — ${issue.code === "invalid_type" ? "required" : issue.message}`);
    }
  }
  walk(config, "", "", (path, key, v) => {
    if (["image", "src", "video"].includes(key) && !isShopImage(v)) problems.push(`${name}: ${path} — upload it through the admin`);
    if (["href", "url"].includes(key) && !isShopLink(v)) problems.push(`${name}: ${path} — use a shop page like /sale or a full web address`);
  });
  const when = scheduleProblem(section.startsAt, section.endsAt);
  if (when) problems.push(`${name}: ${when}`);
  return problems.length ? { problems } : { config: parsed.success ? parsed.data : config };
}

/** A random id for a new row (made in the browser or on the server). */
export function newId() {
  return `c${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}
