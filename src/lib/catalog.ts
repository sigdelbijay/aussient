import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/lib/cache";
import { PAGE_SIZE, PRICE_BUCKETS, type Filters } from "@/lib/catalog-shared";
import {
  cardInclude,
  live,
  storefrontCache,
  swatchColor,
  toCard,
  type ProductCardData,
} from "@/lib/storefront";

/**
 * Product listing, product detail and search queries. All cached under the
 * products tag (cleared by refreshStorefront("products") after admin edits).
 */

// ── Scopes: which products a page lists before filters ──────────

export type Scope =
  | { kind: "category"; slug: string }
  | { kind: "all" }
  | { kind: "new" }
  | { kind: "sale" }
  | { kind: "search"; q: string };

function scopeWhere(scope: Scope): Prisma.ProductWhereInput {
  switch (scope.kind) {
    case "category":
      return { ...live, category: { slug: scope.slug } };
    case "sale":
      return { ...live, salePrice: { not: null } };
    case "search": {
      // Every word must appear somewhere: name, description, material, style or category.
      const words = scope.q.split(/\s+/).filter(Boolean).slice(0, 6);
      return {
        ...live,
        AND: words.map((w) => ({
          OR: [
            { name: { contains: w, mode: "insensitive" as const } },
            { description: { contains: w, mode: "insensitive" as const } },
            { material: { contains: w, mode: "insensitive" as const } },
            { style: { contains: w, mode: "insensitive" as const } },
            { category: { name: { contains: w, mode: "insensitive" as const } } },
          ],
        })),
      };
    }
    default:
      return live;
  }
}

/** Price shoppers pay (sale price if set) within [min, max). */
function priceRange(min: number, max: number): Prisma.ProductWhereInput {
  const range = { gte: min, ...(Number.isFinite(max) ? { lt: max } : {}) };
  return { OR: [{ salePrice: range }, { salePrice: null, price: range }] };
}

function filterWhere(f: Filters): Prisma.ProductWhereInput[] {
  const and: Prisma.ProductWhereInput[] = [];
  if (f.price) and.push(priceRange(PRICE_BUCKETS[f.price].min, PRICE_BUCKETS[f.price].max));
  if (f.colours.length) and.push({ variants: { some: { name: { in: f.colours } } } });
  if (f.materials.length) and.push({ material: { in: f.materials } });
  if (f.styles.length) and.push({ style: { in: f.styles } });
  if (f.hypoallergenic) and.push({ hypoallergenic: true });
  return and;
}

// ── Listing ─────────────────────────────────────────────────────

export type Listing = { products: ProductCardData[]; total: number; page: number; pages: number };

export const getListing = storefrontCache(
  async (scope: Scope, filters: Filters): Promise<Listing> => {
    const where: Prisma.ProductWhereInput = { AND: [scopeWhere(scope), ...filterWhere(filters)] };

    // Sort on light rows first (price sorting uses the sale price when there is
    // one, which the database can't order by directly), then load one page.
    const rows = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        price: true,
        salePrice: true,
        createdAt: true,
        _count: { select: { orderItems: true } },
      },
    });
    const paid = (r: (typeof rows)[number]) => Number(r.salePrice ?? r.price);
    const q = scope.kind === "search" ? scope.q.toLowerCase() : "";
    rows.sort((a, b) => {
      switch (filters.sort) {
        case "price-asc":
          return paid(a) - paid(b);
        case "price-desc":
          return paid(b) - paid(a);
        case "best-selling":
          return b._count.orderItems - a._count.orderItems || +b.createdAt - +a.createdAt;
        case "relevance": {
          // Name matches first, then everything else by newest.
          const an = a.name.toLowerCase().includes(q) ? 0 : 1;
          const bn = b.name.toLowerCase().includes(q) ? 0 : 1;
          return an - bn || +b.createdAt - +a.createdAt;
        }
        default:
          return +b.createdAt - +a.createdAt;
      }
    });

    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const page = Math.min(filters.page, pages);
    const ids = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => r.id);
    const products = await prisma.product.findMany({ where: { id: { in: ids } }, include: cardInclude });
    products.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

    return { products: products.map(toCard), total: rows.length, page, pages };
  },
  ["listing"],
  { tags: [CACHE_TAGS.products] },
);

export type FilterOptions = {
  colours: { value: string; color: string }[];
  materials: string[];
  styles: string[];
  hasHypoallergenic: boolean;
};

/** The filter choices that actually exist within a page's products. */
export const getFilterOptions = storefrontCache(
  async (scope: Scope): Promise<FilterOptions> => {
    const products = await prisma.product.findMany({
      where: scopeWhere(scope),
      select: { material: true, style: true, hypoallergenic: true, variants: { select: { name: true } } },
    });
    const uniq = (xs: (string | null)[]) =>
      [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
    return {
      colours: uniq(products.flatMap((p) => p.variants.map((v) => v.name))).map((value) => ({
        value,
        color: swatchColor(value),
      })),
      materials: uniq(products.map((p) => p.material)),
      styles: uniq(products.map((p) => p.style)),
      hasHypoallergenic: products.some((p) => p.hypoallergenic),
    };
  },
  ["filter-options"],
  { tags: [CACHE_TAGS.products] },
);

export const getCategory = storefrontCache(
  async (slug: string) =>
    prisma.category.findUnique({ where: { slug }, select: { name: true, slug: true, image: true } }),
  ["category"],
  { tags: [CACHE_TAGS.products] },
);

// ── Product detail ──────────────────────────────────────────────

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof loadProduct>>>;

async function loadProduct(slug: string) {
  const p = await prisma.product.findFirst({
    where: { slug, ...live },
    include: {
      category: { select: { name: true, slug: true } },
      media: { orderBy: { order: "asc" } },
      variants: { orderBy: { createdAt: "asc" } },
      completeTheLook: { where: live, include: cardInclude, take: 8 },
    },
  });
  if (!p) return null;

  const [reviews, rating] = await Promise.all([
    prisma.review.findMany({
      where: { productId: p.id, approved: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { name: true } } },
    }),
    prisma.review.aggregate({
      where: { productId: p.id, approved: true },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  const price = Number(p.price);
  const salePrice = p.salePrice === null ? null : Number(p.salePrice);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    details: p.details,
    care: p.care,
    material: p.material,
    style: p.style,
    hypoallergenic: p.hypoallergenic,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    category: p.category,
    categoryId: p.categoryId,
    price,
    salePrice,
    stock: p.stock,
    media: p.media.map((m) => ({
      id: m.id,
      url: m.url,
      type: m.type,
      alt: m.alt ?? p.name,
      variantId: m.variantId,
    })),
    // Variants without their own price use the product's price and sale price.
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      color: swatchColor(v.name),
      price: v.price === null ? price : Number(v.price),
      salePrice: v.price === null ? salePrice : v.salePrice === null ? null : Number(v.salePrice),
      stock: v.stock,
    })),
    completeTheLook: p.completeTheLook.map(toCard),
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      author: r.authorName ?? r.user?.name?.split(" ")[0] ?? "Verified buyer",
      createdAt: r.createdAt.toISOString(),
    })),
    rating: { average: rating._avg.rating ?? 0, count: rating._count },
  };
}

export const getProduct = storefrontCache(loadProduct, ["product"], { tags: [CACHE_TAGS.products] });

/** Same category (same style first), excluding the product and its look items. */
export const getRelatedProducts = storefrontCache(
  async (product: { id: string; categoryId: string; style: string | null }, exclude: string[]) => {
    const products = await prisma.product.findMany({
      where: { ...live, categoryId: product.categoryId, id: { notIn: [product.id, ...exclude] } },
      include: cardInclude,
      take: 24,
    });
    products.sort(
      (a, b) =>
        Number(b.style === product.style) - Number(a.style === product.style) ||
        Number(b.featured) - Number(a.featured),
    );
    return products.slice(0, 8).map(toCard);
  },
  ["related"],
  { tags: [CACHE_TAGS.products] },
);

/** Live product slugs, for pre-building product pages. */
export async function getAllProductSlugs() {
  const rows = await prisma.product.findMany({ where: live, select: { slug: true } });
  return rows.map((r) => r.slug);
}

// ── Search suggestions (header search box) ──────────────────────

export type Suggestion = { slug: string; name: string; category: string; price: number; image: string | null };

export async function searchSuggestions(q: string): Promise<Suggestion[]> {
  const listing = await getListing(
    { kind: "search", q },
    { price: null, colours: [], materials: [], styles: [], hypoallergenic: false, sort: "relevance", page: 1 },
  );
  return listing.products.slice(0, 5).map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.collection,
    price: p.price,
    image: p.images[0]?.url ?? null,
  }));
}
