import "server-only";
import { unstable_cache } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/lib/cache";
import { LOW_STOCK } from "@/lib/catalog-shared";
import { fromShopInput } from "@/lib/admin/dates";
import type { DocKey, MenuLinkDoc } from "@/lib/content/docs";
import { isPreview, previewDoc } from "@/lib/content/preview";
import { cleanRichText, type RichDoc } from "@/lib/content/rich-text";
import { loadPublished, type DocOf } from "@/lib/content/store";

/**
 * Cached reads for the public storefront (layout chrome + home page).
 *
 * Everything here goes through unstable_cache with a tag, so pages built from
 * it are served from cache until an admin change clears the tag (see
 * src/lib/cache.ts). Cached values are JSON, so dates come back as ISO strings
 * and money as plain numbers.
 *
 * In development the cache is skipped, so edits made outside the admin (the
 * seed, Prisma Studio) show up on the next refresh.
 */

// The data cache outlives deploys, so bump this whenever the shape of cached
// data changes (e.g. a field is added to ProductCardData); old entries are then ignored.
const CACHE_VERSION = 9;

export const storefrontCache: typeof unstable_cache =
  process.env.NODE_ENV === "development"
    ? (fn) => fn
    : (fn, keyParts, options) => unstable_cache(fn, [...(keyParts ?? []), `v${CACHE_VERSION}`], options);

// ── Scheduling ──────────────────────────────────────────────────

export type Scheduled = { startsAt: string | null; endsAt: string | null };

/** Is a scheduled item visible right now? */
export function isLive(item: Scheduled, now = Date.now()) {
  return (
    (!item.startsAt || Date.parse(item.startsAt) <= now) &&
    (!item.endsAt || Date.parse(item.endsAt) > now)
  );
}

/**
 * Makes the current page rebuild when the next scheduled start/end time passes.
 * A cached entry with `revalidate` shortens the page's own cache lifetime to
 * match, so a sale banner appears (or disappears) on time without the admin
 * doing anything. With nothing upcoming, the page stays cached until an edit.
 */
export async function rebuildAtNextChange(items: Scheduled[], now = Date.now()) {
  const upcoming = items
    .flatMap((i) => [i.startsAt, i.endsAt])
    .map((d) => (d ? Date.parse(d) : NaN))
    .filter((t) => t > now);
  if (upcoming.length === 0) return;
  const next = Math.min(...upcoming);
  const seconds = Math.max(1, Math.ceil((next - now) / 1000));
  await unstable_cache(async () => next, ["schedule", String(next)], { revalidate: seconds })();
}

// ── Site chrome: settings, announcement bar, menus, pop-ups ─────

export type MenuLink = { id: string; label: string; url: string; image: string | null; children?: MenuLink[] };
export type MenuGroup = MenuLink & { children: MenuLink[] };

export type PopupData = Scheduled & {
  id: string;
  kind: "newsletter" | "sale";
  title: string | null;
  body: string | null;
  image: string | null;
  buttonLabel: string | null;
  buttonLink: string | null;
  delaySeconds: number;
};

export type SiteChrome = {
  settings: {
    storeName: string;
    logo: string | null;
    /** Brand accent colour (#rrggbb), or null for the built-in pink. */
    accentColor: string | null;
    tagline: string | null;
    metaDescription: string | null;
    supportEmail: string | null;
    contactPhone: string | null;
    abn: string | null;
    deliveryInfo: string | null;
    returnsInfo: string | null;
    newsletterHeading: string;
    newsletterText: string;
    footerPerks: string[];
    freeShippingThreshold: number | null;
    flatShippingRate: number | null;
    expressShippingRate: number | null;
    socials: Partial<Record<"instagram" | "tiktok" | "youtube" | "threads" | "facebook" | "pinterest", string>>;
  };
  announcements: (Scheduled & { id: string; text: string; link: string | null })[];
  headerMenu: MenuGroup[];
  footerMenu: MenuGroup[];
  popups: PopupData[];
};

const isoOf = (shopTime: string) => fromShopInput(shopTime)?.toISOString() ?? null;

/** Reads a content document: the published one, or (in Preview) the draft. */
function contentDoc<K extends DocKey>(key: K, preview: boolean): Promise<DocOf<K> | null> {
  return preview ? previewDoc(key) : loadPublished(key);
}

/**
 * Turns the menu document into links. Links that point at a category,
 * collection, brand or page get its current web address (so renaming one never
 * breaks the menu); ones whose target was deleted are left out. A header link
 * to a category also lists its sub-categories in the mega menu.
 */
async function resolveMenus(header: MenuLinkDoc[], footer: MenuLinkDoc[], preview: boolean) {
  const [categories, collections, brands, pages] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, image: true, parentId: true },
    }),
    prisma.collection.findMany({ select: { id: true, slug: true } }),
    prisma.brand.findMany({ select: { id: true, slug: true } }),
    prisma.page.findMany({ select: { id: true, slug: true, published: true } }),
  ]);
  const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const cats = byId(categories);
  const cols = byId(collections);
  const brs = byId(brands);
  const pgs = byId(pages);

  const urlOf = (l: Omit<MenuLinkDoc, "children">): string | null => {
    switch (l.linkType) {
      case "url":
        return l.url || "#";
      case "category": {
        const c = cats.get(l.targetId);
        return c ? `/collections/${c.slug}` : null;
      }
      case "collection": {
        const c = cols.get(l.targetId);
        return c ? `/collections/${c.slug}` : null;
      }
      case "brand": {
        const b = brs.get(l.targetId);
        return b ? `/brands/${b.slug}` : null;
      }
      case "page": {
        const p = pgs.get(l.targetId);
        return p && (p.published || preview) ? `/pages/${p.slug}` : null;
      }
    }
  };
  const one = (l: Omit<MenuLinkDoc, "children">): MenuLink | null => {
    const url = urlOf(l);
    return url ? { id: l.id, label: l.label, url, image: l.image || null } : null;
  };
  const many = (links: Omit<MenuLinkDoc, "children">[]) => links.map(one).filter((l): l is MenuLink => l !== null);

  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);
  const catLink = (c: (typeof categories)[number]): MenuLink => ({ id: c.id, label: c.name, url: `/collections/${c.slug}`, image: c.image });

  const headerMenu = header.flatMap((l): MenuGroup[] => {
    const top = one(l);
    if (!top) return [];
    const category = l.linkType === "category" ? cats.get(l.targetId) : undefined;
    const subTree = category ? childrenOf(category.id).map((mid) => ({ ...catLink(mid), children: childrenOf(mid.id).map(catLink) })) : [];
    return [{ ...top, image: top.image ?? category?.image ?? null, children: [...subTree, ...many(l.children)] }];
  });
  const footerMenu = footer.flatMap((l): MenuGroup[] => {
    const top = one(l);
    return top ? [{ ...top, children: many(l.children) }] : [];
  });
  return { headerMenu, footerMenu };
}

/** Builds the chrome from the database; `preview` uses drafts instead of what's published. */
async function loadSiteChrome(preview: boolean): Promise<SiteChrome> {
  const [settings, announcements, menu, popups] = await Promise.all([
    prisma.siteSettings.findUnique({ where: { id: "singleton" } }),
    contentDoc("announcements", preview),
    contentDoc("menu", preview),
    contentDoc("popups", preview),
  ]);
  const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));
  return {
    settings: {
      storeName: settings?.storeName ?? "Aussient",
      logo: settings?.logo ?? null,
      accentColor: settings?.accentColor ?? null,
      tagline: settings?.tagline ?? null,
      metaDescription: settings?.metaDescription ?? null,
      supportEmail: settings?.supportEmail ?? null,
      contactPhone: settings?.contactPhone ?? null,
      abn: settings?.abn ?? null,
      deliveryInfo: settings?.deliveryInfo ?? null,
      returnsInfo: settings?.returnsInfo ?? null,
      newsletterHeading: settings?.newsletterHeading ?? "Join the list",
      newsletterText: settings?.newsletterText ?? "",
      footerPerks: Array.isArray(settings?.footerPerks) ? (settings.footerPerks as string[]) : [],
      freeShippingThreshold: num(settings?.freeShippingThreshold),
      flatShippingRate: num(settings?.flatShippingRate),
      expressShippingRate: num(settings?.expressShippingRate),
      socials: (settings?.socials as SiteChrome["settings"]["socials"]) ?? {},
    },
    announcements: (announcements?.items ?? [])
      .filter((a) => a.active && a.text)
      .map((a) => ({ id: a.id, text: a.text, link: a.link || null, startsAt: isoOf(a.startsAt), endsAt: isoOf(a.endsAt) })),
    ...(await resolveMenus(menu?.header ?? [], menu?.footer ?? [], preview)),
    popups: (popups?.items ?? [])
      .filter((p) => p.active)
      .map((p) => ({
        id: p.id,
        kind: p.kind,
        title: p.title || null,
        body: p.body || null,
        image: p.image || null,
        buttonLabel: p.buttonLabel || null,
        buttonLink: p.buttonLink || null,
        delaySeconds: p.delaySeconds,
        startsAt: isoOf(p.startsAt),
        endsAt: isoOf(p.endsAt),
      })),
  };
}

export const getSiteChrome = storefrontCache(
  () => loadSiteChrome(false),
  ["site-chrome"],
  // Categories, collections and brands (menu links) are cleared with products.
  { tags: [CACHE_TAGS.content, CACHE_TAGS.products] },
);

// ── Home sections ───────────────────────────────────────────────

export type HomeSectionRow = Scheduled & {
  id: string;
  type: string;
  title: string | null;
  config: unknown;
};

/** Switched-on sections in admin order, including ones scheduled for later. */
async function loadHomeSections(preview: boolean): Promise<HomeSectionRow[]> {
  const doc = await contentDoc("home", preview);
  return (doc?.sections ?? [])
    .filter((r) => r.active)
    .map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title || null,
      config: r.config,
      startsAt: isoOf(r.startsAt),
      endsAt: isoOf(r.endsAt),
    }));
}

export const getHomeSections = storefrontCache(() => loadHomeSections(false), ["home-sections"], { tags: [CACHE_TAGS.content] });

// ── Pages (About, FAQ, …) ───────────────────────────────────────

export type ShopPage = { id: string; slug: string; title: string; content: RichDoc; seoTitle: string | null; seoDescription: string | null };

export const getPublishedPage = storefrontCache(
  async (slug: string): Promise<ShopPage | null> => {
    const p = await prisma.page.findFirst({ where: { slug, published: true } });
    if (!p) return null;
    return { id: p.id, slug: p.slug, title: p.title, content: cleanRichText(p.content) ?? { type: "doc", content: [] }, seoTitle: p.seoTitle, seoDescription: p.seoDescription };
  },
  ["page"],
  { tags: [CACHE_TAGS.content] },
);

/** A page by its web address. In Preview, drafts count too (including unpublished pages). */
export async function getLivePage(slug: string): Promise<ShopPage | null> {
  if (!(await isPreview())) return getPublishedPage(slug);
  for (const p of await prisma.page.findMany({ select: { id: true } })) {
    const doc = await previewDoc(`page:${p.id}`);
    if (doc?.slug === slug) {
      return { id: p.id, slug, title: doc.title, content: cleanRichText(doc.content) ?? { type: "doc", content: [] }, seoTitle: doc.seoTitle || null, seoDescription: doc.seoDescription || null };
    }
  }
  return null;
}

// ── Redirects ───────────────────────────────────────────────────

/** Every redirect as { "/old-path": "/new-path" }. */
export const getRedirects = storefrontCache(
  async (): Promise<Record<string, string>> => {
    const rows = await prisma.redirect.findMany({ select: { from: true, to: true } });
    return Object.fromEntries(rows.map((r) => [r.from, r.to]));
  },
  ["redirects"],
  // Products add redirects when their web address changes.
  { tags: [CACHE_TAGS.content, CACHE_TAGS.products] },
);

// ── Products ────────────────────────────────────────────────────

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  /** Small line under the name: the brand, or the product type (e.g. "Watch"). */
  subtitle: string;
  /** The lowest price shoppers pay across its variants. */
  price: number;
  compareAtPrice: number | null;
  /** True when variants cost different amounts (shown as "From $X"). */
  priceVaries: boolean;
  /** Shown in this order: SALE, LOW STOCK, NEW. */
  badges: ("sale" | "low" | "new")[];
  images: { url: string; alt: string }[];
  /** Short hints under the name, e.g. "3 colours", "More sizes". */
  hints: string[];
  /** Colour dots for the first option that has swatches (e.g. Colour). */
  swatches: {
    id: string;
    name: string;
    color: string | null;
    image: string | null;
    stock: number;
    /** The variant to add when this swatch alone decides it (one-option products), else null. */
    variantId: string | null;
    /** Cheapest price for this colour (and the price to cross out when that's a sale price). */
    price: number;
    compareAtPrice: number | null;
    /** True when this colour's variants cost different amounts ("From $X"). */
    priceVaries: boolean;
    /** Photos of this colour (then general photos); empty = use the product's photos. */
    images: { url: string; alt: string }[];
  }[];
  /** Which colour dot to open on, set by filtered listings (e.g. Lens = Brown → the colour sold with Brown). */
  startSwatch?: number;
  /** For products with a single variant: the one to add straight to the bag. */
  quickAddVariantId: string | null;
  /** Units available across all variants. */
  stock: number;
};

export const cardInclude = {
  productType: { select: { name: true, optionNames: true } },
  brand: { select: { name: true } },
  // A few photos in order; general (not option-specific) ones are used first.
  media: { where: { type: "IMAGE" }, orderBy: { order: "asc" }, take: 6, select: { url: true, alt: true, optionValueId: true } },
  optionValues: {
    orderBy: { order: "asc" },
    select: { id: true, option: true, value: true, swatchColor: true, swatchImage: true },
  },
  variants: {
    select: { id: true, price: true, salePrice: true, stock: true, option1Id: true, option2Id: true, option3Id: true },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.ProductInclude;

export type CardProduct = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

const NEW_DAYS = 30;

type Money = Prisma.Decimal | null;

/** What shoppers pay, plus the original price to cross out when it's on sale. */
export function pricing(price: Prisma.Decimal | number, salePrice: Money | number) {
  const full = Number(price);
  const sale = salePrice === null ? null : Number(salePrice);
  const onSale = sale !== null && sale < full;
  return { price: onSale ? sale : full, compareAtPrice: onSale ? full : null };
}

/** The cheapest variant's price (sale price if it has one). */
function cheapest(variants: { price: Prisma.Decimal; salePrice: Money }[]) {
  const priced = variants.map((v) => pricing(v.price, v.salePrice)).sort((a, b) => a.price - b.price);
  return priced[0] ?? { price: 0, compareAtPrice: null };
}

export const variantOptionIds = (v: { option1Id: string | null; option2Id: string | null; option3Id: string | null }) =>
  [v.option1Id, v.option2Id, v.option3Id].filter((x): x is string => !!x);

/** "Size" → "sizes", "Strap colour" → "strap colours", "Finish" → "finishes". */
function plural(option: string) {
  const word = option.toLowerCase();
  if (/(s|x|ch|sh)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

export function toCard(p: CardProduct): ProductCardData {
  const base = cheapest(p.variants);
  const prices = new Set(p.variants.map((v) => pricing(v.price, v.salePrice).price));
  const onSale = p.variants.some((v) => pricing(v.price, v.salePrice).compareAtPrice !== null);
  const isNew = Date.now() - p.createdAt.getTime() < NEW_DAYS * 24 * 60 * 60 * 1000;
  const stock = p.variants.reduce((n, v) => n + v.stock, 0);

  // Swatches: the first option (in the product type's order) whose values have a colour or picture.
  const optionsUsed = p.productType.optionNames.filter((name) => p.optionValues.some((v) => v.option === name));
  const swatchOption = optionsUsed.find((name) =>
    p.optionValues.some((v) => v.option === name && (v.swatchColor || v.swatchImage)),
  );
  const general = p.media.filter((m) => !m.optionValueId);
  const photo = (m: { url: string; alt: string | null }) => ({ url: m.url, alt: m.alt ?? p.name });

  const swatches = p.optionValues
    .filter((v) => v.option === swatchOption)
    .map((value) => {
      const own = p.media.filter((m) => m.optionValueId === value.id);
      const mine = p.variants.filter((v) => variantOptionIds(v).includes(value.id));
      // With only this one option, picking the swatch picks the variant.
      const exact = optionsUsed.length === 1 && mine.length === 1 ? mine[0] : null;
      return {
        id: value.id,
        name: value.value,
        color: value.swatchColor,
        image: value.swatchImage,
        stock: mine.reduce((n, v) => n + v.stock, 0),
        variantId: exact?.id ?? null,
        ...(mine.length ? cheapest(mine) : base),
        priceVaries: new Set(mine.map((v) => pricing(v.price, v.salePrice).price)).size > 1,
        images: own.length ? [...own, ...general].slice(0, 2).map(photo) : [],
      };
    });

  // "3 colours" for the swatch option, "More sizes" for other options with a choice.
  const hints = optionsUsed.flatMap((name) => {
    const count = p.optionValues.filter((v) => v.option === name).length;
    if (count < 2) return [];
    return name === swatchOption ? [`${count} ${plural(name)}`] : [`More ${plural(name)}`];
  });

  const photos = (general.length ? general : p.media).slice(0, 2);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    subtitle: p.brand?.name ?? p.productType.name,
    ...base,
    priceVaries: prices.size > 1,
    badges: [
      ...(onSale ? (["sale"] as const) : []),
      ...(stock > 0 && stock <= LOW_STOCK ? (["low"] as const) : []),
      ...(isNew ? (["new"] as const) : []),
    ],
    images: photos.map(photo),
    hints,
    swatches,
    quickAddVariantId: p.variants.length === 1 ? p.variants[0].id : null,
    stock,
  };
}

export const live = { status: "LIVE" } satisfies Prisma.ProductWhereInput;

export const onSaleWhere = { variants: { some: { salePrice: { not: null } } } } satisfies Prisma.ProductWhereInput;

// ── Reviews ─────────────────────────────────────────────────────

export type ReviewCardData = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  author: string;
  product: { name: string; slug: string };
};

export const getApprovedReviews = storefrontCache(
  async (limit: number): Promise<ReviewCardData[]> => {
    const reviews = await prisma.review.findMany({
      where: { approved: true, product: live },
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        product: { select: { name: true, slug: true } },
        user: { select: { name: true } },
      },
    });
    return reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      author: r.authorName ?? r.user?.name?.split(" ")[0] ?? "Verified buyer",
      product: r.product,
    }));
  },
  ["approved-reviews"],
  { tags: [CACHE_TAGS.products] },
);

// ── What's showing right now ────────────────────────────────────

/** Site chrome with only the announcements and pop-ups that are live now (drafts in Preview). */
export async function getLiveSiteChrome(): Promise<SiteChrome & { preview: boolean }> {
  const now = Date.now();
  const preview = await isPreview();
  const chrome = preview ? await loadSiteChrome(true) : await getSiteChrome();
  await rebuildAtNextChange([...chrome.announcements, ...chrome.popups], now);
  return {
    ...chrome,
    preview,
    announcements: chrome.announcements.filter((a) => isLive(a, now)),
    popups: chrome.popups.filter((p) => isLive(p, now)),
  };
}

/** Home sections that are switched on and within their start/end dates now (drafts in Preview). */
export async function getLiveHomeSections(): Promise<HomeSectionRow[]> {
  const now = Date.now();
  const rows = (await isPreview()) ? await loadHomeSections(true) : await getHomeSections();
  await rebuildAtNextChange(rows, now);
  return rows.filter((row) => isLive(row, now));
}
