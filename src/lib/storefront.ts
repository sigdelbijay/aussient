import "server-only";
import { unstable_cache } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/lib/cache";
import type { ProductSource } from "@/lib/home-sections";
import { LOW_STOCK } from "@/lib/catalog-shared";

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
const CACHE_VERSION = 4;

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

// ── Site chrome: settings, announcement bar, menus ──────────────

export type MenuLink = { id: string; label: string; url: string; image: string | null };
export type MenuGroup = MenuLink & { children: MenuLink[] };

export type SiteChrome = {
  settings: {
    storeName: string;
    newsletterHeading: string;
    newsletterText: string;
    footerPerks: string[];
    freeShippingThreshold: number | null;
    flatShippingRate: number | null;
    socials: Partial<Record<"instagram" | "tiktok" | "youtube" | "threads", string>>;
  };
  announcements: (Scheduled & { id: string; text: string; link: string | null })[];
  headerMenu: MenuGroup[];
  footerMenu: MenuGroup[];
};

async function loadMenu(location: "header" | "footer"): Promise<MenuGroup[]> {
  const items = await prisma.menuItem.findMany({
    where: { location, parentId: null },
    orderBy: { order: "asc" },
    include: { children: { orderBy: { order: "asc" } } },
  });
  const pick = (m: { id: string; label: string; url: string; image: string | null }) => ({
    id: m.id,
    label: m.label,
    url: m.url,
    image: m.image,
  });
  return items.map((m) => ({ ...pick(m), children: m.children.map(pick) }));
}

export const getSiteChrome = storefrontCache(
  async (): Promise<SiteChrome> => {
    const [settings, banners, headerMenu, footerMenu] = await Promise.all([
      prisma.siteSettings.findUnique({ where: { id: "singleton" } }),
      prisma.banner.findMany({
        where: { placement: "announcement", active: true },
        orderBy: { order: "asc" },
      }),
      loadMenu("header"),
      loadMenu("footer"),
    ]);
    return {
      settings: {
        storeName: settings?.storeName ?? "Aussient",
        newsletterHeading: settings?.newsletterHeading ?? "Join the list",
        newsletterText: settings?.newsletterText ?? "",
        footerPerks: Array.isArray(settings?.footerPerks) ? (settings.footerPerks as string[]) : [],
        freeShippingThreshold:
          settings?.freeShippingThreshold == null ? null : Number(settings.freeShippingThreshold),
        flatShippingRate: settings?.flatShippingRate == null ? null : Number(settings.flatShippingRate),
        socials: (settings?.socials as SiteChrome["settings"]["socials"]) ?? {},
      },
      announcements: banners
        .filter((b) => b.title)
        .map((b) => ({
          id: b.id,
          text: b.title!,
          link: b.link,
          startsAt: b.startsAt?.toISOString() ?? null,
          endsAt: b.endsAt?.toISOString() ?? null,
        })),
      headerMenu,
      footerMenu,
    };
  },
  ["site-chrome"],
  { tags: [CACHE_TAGS.content] },
);

// ── Home sections ───────────────────────────────────────────────

export type HomeSectionRow = Scheduled & {
  id: string;
  type: string;
  title: string | null;
  config: unknown;
};

/** All switched-on sections in admin order, including ones scheduled for later. */
export const getHomeSections = storefrontCache(
  async (): Promise<HomeSectionRow[]> => {
    const rows = await prisma.homeSection.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      config: r.config,
      startsAt: r.startsAt?.toISOString() ?? null,
      endsAt: r.endsAt?.toISOString() ?? null,
    }));
  },
  ["home-sections"],
  { tags: [CACHE_TAGS.content] },
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
  /** Colour dots for the first option that has swatches (e.g. Colour). */
  swatches: {
    id: string;
    name: string;
    color: string | null;
    image: string | null;
    stock: number;
    /** The variant to add when this swatch alone decides it (one-option products), else null. */
    variantId: string | null;
    price: number;
    compareAtPrice: number | null;
  }[];
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
  const swatches = p.optionValues
    .filter((v) => v.option === swatchOption)
    .map((value) => {
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
      };
    });

  const general = p.media.filter((m) => !m.optionValueId);
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
    images: photos.map((m) => ({ url: m.url, alt: m.alt ?? p.name })),
    swatches,
    quickAddVariantId: p.variants.length === 1 ? p.variants[0].id : null,
    stock,
  };
}

export const live = { status: "LIVE" } satisfies Prisma.ProductWhereInput;

/** Has a variant whose price shoppers pay (sale price if set) is at most `max`. */
const pricedAtMost = (max: number): Prisma.ProductWhereInput => ({
  variants: { some: { OR: [{ salePrice: { lte: max } }, { salePrice: null, price: { lte: max } }] } },
});

export const onSaleWhere = { variants: { some: { salePrice: { not: null } } } } satisfies Prisma.ProductWhereInput;

async function loadProducts(source: ProductSource, limit: number, maxPrice?: number) {
  switch (source) {
    case "new":
      return prisma.product.findMany({
        where: live,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: cardInclude,
      });
    case "featured":
      return prisma.product.findMany({
        where: { ...live, featured: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: cardInclude,
      });
    case "sale":
      return prisma.product.findMany({
        where: { ...live, ...onSaleWhere },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: cardInclude,
      });
    case "under": {
      const rows = await prisma.product.findMany({
        where: { ...live, ...pricedAtMost(maxPrice ?? 20) },
        include: cardInclude,
      });
      // Cheapest first.
      return rows.sort((a, b) => cheapest(a.variants).price - cheapest(b.variants).price).slice(0, limit);
    }
    case "bestsellers": {
      const top = await prisma.orderItem.groupBy({
        by: ["productId"],
        where: { productId: { not: null }, order: { status: { in: ["PAID", "SHIPPED"] } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: limit,
      });
      const ids = top.map((t) => t.productId!);
      const sold = await prisma.product.findMany({
        where: { ...live, id: { in: ids } },
        include: cardInclude,
      });
      sold.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      // Not enough sales yet? Top up with featured items so the row is never empty.
      if (sold.length < limit) {
        const fill = await prisma.product.findMany({
          where: { ...live, id: { notIn: sold.map((p) => p.id) } },
          orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
          take: limit - sold.length,
          include: cardInclude,
        });
        sold.push(...fill);
      }
      return sold;
    }
  }
}

export const getProductRow = storefrontCache(
  async (source: ProductSource, limit: number, maxPrice?: number) =>
    (await loadProducts(source, limit, maxPrice)).map(toCard),
  ["product-row"],
  { tags: [CACHE_TAGS.products] },
);

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

/** Site chrome with only the announcements that are live now. */
export async function getLiveSiteChrome(): Promise<SiteChrome> {
  const now = Date.now();
  const chrome = await getSiteChrome();
  await rebuildAtNextChange(chrome.announcements, now);
  return { ...chrome, announcements: chrome.announcements.filter((a) => isLive(a, now)) };
}

/** Home sections that are switched on and within their start/end dates now. */
export async function getLiveHomeSections(): Promise<HomeSectionRow[]> {
  const now = Date.now();
  const rows = await getHomeSections();
  await rebuildAtNextChange(rows, now);
  return rows.filter((row) => isLive(row, now));
}
