import "server-only";
import { unstable_cache } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/lib/cache";
import type { ProductSource } from "@/lib/home-sections";

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

const storefrontCache: typeof unstable_cache =
  process.env.NODE_ENV === "development" ? (fn) => fn : unstable_cache;

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
  collection: string;
  price: number;
  compareAtPrice: number | null;
  badge: "new" | "sale" | "low" | null;
  images: { url: string; alt: string }[];
  swatches: { name: string; color: string }[];
};

const SWATCH_COLORS: Record<string, string> = {
  gold: "oklch(0.82 0.085 85)",
  silver: "oklch(0.85 0.005 280)",
  "rose gold": "oklch(0.78 0.08 30)",
  black: "oklch(0.2 0.02 280)",
};

const cardInclude = {
  category: { select: { name: true } },
  media: { where: { type: "IMAGE" }, orderBy: { order: "asc" }, take: 2 },
  variants: { select: { name: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.ProductInclude;

type CardProduct = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

const NEW_DAYS = 30;

function toCard(p: CardProduct): ProductCardData {
  const onSale = p.salePrice !== null && Number(p.salePrice) < Number(p.price);
  const isNew = Date.now() - p.createdAt.getTime() < NEW_DAYS * 24 * 60 * 60 * 1000;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    collection: p.category.name,
    price: Number(onSale ? p.salePrice : p.price),
    compareAtPrice: onSale ? Number(p.price) : null,
    badge: onSale ? "sale" : p.stock > 0 && p.stock <= 5 ? "low" : isNew ? "new" : null,
    images: p.media.map((m) => ({ url: m.url, alt: m.alt ?? p.name })),
    swatches: p.variants.map((v) => ({
      name: v.name,
      color: SWATCH_COLORS[v.name.toLowerCase()] ?? "oklch(0.7 0 0)",
    })),
  };
}

const live = { status: "LIVE" } satisfies Prisma.ProductWhereInput;

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
        where: { ...live, salePrice: { not: null } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: cardInclude,
      });
    case "under": {
      const max = maxPrice ?? 20;
      return prisma.product.findMany({
        // The price shoppers pay: the sale price if there is one, otherwise the price.
        where: {
          ...live,
          OR: [{ salePrice: { lte: max } }, { salePrice: null, price: { lte: max } }],
        },
        orderBy: { price: "asc" },
        take: limit,
        include: cardInclude,
      });
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
