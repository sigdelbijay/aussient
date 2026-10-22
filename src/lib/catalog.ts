import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/lib/cache";
import { PAGE_SIZE, PRICE_BUCKETS, type Filters } from "@/lib/catalog-shared";
import {
  filterKey,
  formatSpec,
  paidPrice,
  readSizeTable,
  readSpecFields,
  readSpecs,
  variantLabel,
} from "@/lib/product-types";
import {
  cardInclude,
  live,
  onSaleWhere,
  storefrontCache,
  toCard,
  type ProductCardData,
} from "@/lib/storefront";

/**
 * Product listing, product detail and search queries. All cached under the
 * products tag (cleared by refreshStorefront("products") after admin edits).
 *
 * The shop has a few hundred products, so listings load every product in
 * scope as a light row and filter/sort in plain TypeScript — simpler than
 * building SQL for JSON specs and per-variant prices.
 */

// ── Categories (a tree, up to 3 levels) ─────────────────────────

export type CategoryNode = { id: string; name: string; slug: string; image: string | null; parentId: string | null };

export const getCategories = storefrontCache(
  async (): Promise<CategoryNode[]> =>
    prisma.category.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, image: true, parentId: true },
    }),
  ["categories"],
  { tags: [CACHE_TAGS.products] },
);

/** A category plus every category inside it (children, grandchildren). */
export function withDescendants(all: CategoryNode[], id: string): string[] {
  const ids = [id];
  for (let i = 0; i < ids.length; i++) {
    for (const c of all) if (c.parentId === ids[i] && !ids.includes(c.id)) ids.push(c.id);
  }
  return ids;
}

/** Top-level → this category, e.g. [Women, Clothing, Dresses]. */
export function categoryTrail(all: CategoryNode[], id: string): CategoryNode[] {
  const trail: CategoryNode[] = [];
  let current = all.find((c) => c.id === id);
  while (current && trail.length < 5) {
    trail.unshift(current);
    current = all.find((c) => c.id === current!.parentId);
  }
  return trail;
}

// ── Scopes: which products a page lists before filters ──────────

export type Scope =
  | { kind: "category"; slug: string }
  | { kind: "collection"; slug: string }
  | { kind: "all" }
  | { kind: "new" }
  | { kind: "sale" }
  | { kind: "search"; q: string };

const rowSelect = {
  id: true,
  name: true,
  description: true,
  tags: true,
  specs: true,
  createdAt: true,
  productType: { select: { name: true, specFields: true } },
  brand: { select: { name: true } },
  categories: { select: { name: true } },
  optionValues: {
    orderBy: { order: "asc" },
    select: { option: true, value: true, swatchColor: true, swatchImage: true },
  },
  variants: { select: { price: true, salePrice: true } },
  _count: { select: { orderItems: true } },
} satisfies Prisma.ProductSelect;

type Row = Prisma.ProductGetPayload<{ select: typeof rowSelect }>;

/** The price shoppers pay for the cheapest variant. */
const lowestPrice = (r: Row) =>
  Math.min(...r.variants.map((v) => paidPrice({ price: Number(v.price), salePrice: v.salePrice === null ? null : Number(v.salePrice) })));

/** Every search word must appear somewhere: name, description, tags, brand, type, categories, specs or options. */
function matchesSearch(r: Row, q: string) {
  const text = [
    r.name,
    r.description,
    r.productType.name,
    r.brand?.name,
    ...r.tags,
    ...r.categories.map((c) => c.name),
    ...Object.values(readSpecs(r.specs)).map(String),
    ...r.optionValues.map((o) => o.value),
  ]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .every((w) => text.includes(w));
}

async function scopeRows(scope: Scope): Promise<Row[]> {
  const and: Prisma.ProductWhereInput[] = [live];
  let keep: (r: Row) => boolean = () => true;

  switch (scope.kind) {
    case "category": {
      const all = await getCategories();
      const category = all.find((c) => c.slug === scope.slug);
      if (!category) return [];
      and.push({ categories: { some: { id: { in: withDescendants(all, category.id) } } } });
      break;
    }
    case "collection": {
      const c = await prisma.collection.findUnique({ where: { slug: scope.slug } });
      if (!c) return [];
      if (c.type === "MANUAL") {
        and.push({ collections: { some: { id: c.id } } });
        break;
      }
      // Automatic: every rule that's set must match.
      if (c.ruleCategoryId) {
        and.push({ categories: { some: { id: { in: withDescendants(await getCategories(), c.ruleCategoryId) } } } });
      }
      if (c.ruleProductTypeId) and.push({ productTypeId: c.ruleProductTypeId });
      if (c.ruleBrandId) and.push({ brandId: c.ruleBrandId });
      if (c.ruleTag) and.push({ tags: { has: c.ruleTag.toLowerCase() } });
      if (c.ruleOnSale) and.push(onSaleWhere);
      const under = c.rulePriceUnder === null ? null : Number(c.rulePriceUnder);
      const over = c.rulePriceOver === null ? null : Number(c.rulePriceOver);
      keep = (r) => (under === null || lowestPrice(r) < under) && (over === null || lowestPrice(r) > over);
      break;
    }
    case "sale":
      and.push(onSaleWhere);
      break;
    case "search":
      keep = (r) => matchesSearch(r, scope.q);
      break;
  }

  const rows = await prisma.product.findMany({ where: { AND: and }, select: rowSelect });
  return rows.filter((r) => r.variants.length > 0 && keep(r));
}

// ── Filters (built from product types — nothing hard-coded) ─────

export type FilterGroup = {
  /** URL name, e.g. "strap-colour". */
  key: string;
  label: string;
  values: { value: string; color: string | null; image: string | null }[];
};

type Attribute = { key: string; label: string; value: string; color: string | null; image: string | null; option: boolean };

/** A product's filterable values: every option value, plus specs marked "filterable". */
function attributes(r: Row): Attribute[] {
  const out: Attribute[] = r.optionValues.map((o) => ({
    key: filterKey(o.option),
    label: o.option,
    value: o.value,
    color: o.swatchColor,
    image: o.swatchImage,
    option: true,
  }));
  const specs = readSpecs(r.specs);
  for (const field of readSpecFields(r.productType.specFields)) {
    const value = specs[field.label];
    if (!field.filterable || value === undefined || value === "" || value === false) continue;
    out.push({ key: filterKey(field.label), label: field.label, value: formatSpec(field, value), color: null, image: null, option: false });
  }
  return out;
}

function filterGroups(rows: Row[]): FilterGroup[] {
  const groups = new Map<string, FilterGroup & { option: boolean; seen: Set<string> }>();
  for (const row of rows) {
    for (const a of attributes(row)) {
      const group = groups.get(a.key) ?? { key: a.key, label: a.label, values: [], option: a.option, seen: new Set<string>() };
      groups.set(a.key, group);
      if (group.seen.has(a.value.toLowerCase())) continue;
      group.seen.add(a.value.toLowerCase());
      group.values.push({ value: a.value, color: a.color, image: a.image });
    }
  }
  return [...groups.values()]
    .sort((a, b) => Number(b.option) - Number(a.option)) // options (Size, Colour…) before specs
    .map(({ key, label, values, option }) => ({
      key,
      label,
      // Options keep the admin's order; spec values are sorted (numbers numerically).
      values: option ? values : values.sort((a, b) => a.value.localeCompare(b.value, "en", { numeric: true })),
    }));
}

function matchesFilters(r: Row, f: Filters, known: Set<string>) {
  if (f.price) {
    const { min, max } = PRICE_BUCKETS[f.price];
    const price = lowestPrice(r);
    if (price < min || price >= max) return false;
  }
  const mine = attributes(r);
  for (const [key, wanted] of Object.entries(f.attrs)) {
    if (!known.has(key)) continue; // e.g. a tracking param — not a filter on this page
    const want = new Set(wanted.map((w) => w.toLowerCase()));
    if (!mine.some((a) => a.key === key && want.has(a.value.toLowerCase()))) return false;
  }
  return true;
}

// ── Listing ─────────────────────────────────────────────────────

export type Listing = {
  products: ProductCardData[];
  total: number;
  page: number;
  pages: number;
  /** The filter choices that exist within this page's products. */
  filters: FilterGroup[];
};

export const getListing = storefrontCache(
  async (scope: Scope, filters: Filters): Promise<Listing> => {
    const all = await scopeRows(scope);
    const groups = filterGroups(all);
    const known = new Set(groups.map((g) => g.key));
    const rows = all.filter((r) => matchesFilters(r, filters, known));

    const q = scope.kind === "search" ? scope.q.toLowerCase() : "";
    rows.sort((a, b) => {
      switch (filters.sort) {
        case "price-asc":
          return lowestPrice(a) - lowestPrice(b);
        case "price-desc":
          return lowestPrice(b) - lowestPrice(a);
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

    return { products: products.map(toCard), total: rows.length, page, pages, filters: groups };
  },
  ["listing"],
  { tags: [CACHE_TAGS.products] },
);

/** What /collections/[slug] shows: a category, or else a collection with that web address. */
export const getListingPage = storefrontCache(
  async (slug: string) => {
    const category = (await getCategories()).find((c) => c.slug === slug);
    if (category) {
      return { name: category.name, image: category.image, description: null, scope: { kind: "category", slug } as Scope };
    }
    const collection = await prisma.collection.findUnique({
      where: { slug },
      select: { name: true, image: true, description: true },
    });
    if (collection) return { ...collection, scope: { kind: "collection", slug } as Scope };
    return null;
  },
  ["listing-page"],
  { tags: [CACHE_TAGS.products] },
);

// ── Product detail ──────────────────────────────────────────────

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof loadProduct>>>;

const money = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

async function loadProduct(slug: string) {
  const p = await prisma.product.findFirst({
    where: { slug, ...live },
    include: {
      productType: { include: { sizeGuide: true } },
      brand: { select: { name: true, slug: true, logo: true } },
      categories: { select: { id: true } },
      media: { orderBy: { order: "asc" } },
      optionValues: { orderBy: { order: "asc" } },
      variants: { orderBy: { createdAt: "asc" } },
      completeTheLook: { where: live, include: cardInclude, take: 8 },
    },
  });
  if (!p || p.variants.length === 0) return null;

  const [reviews, rating, allCategories] = await Promise.all([
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
    getCategories(),
  ]);

  // Options shoppers pick, in the product type's order. `slot` says which of a
  // variant's option1/2/3 holds the value (only options this product uses are shown).
  const options = p.productType.optionNames
    .map((name, slot) => ({
      name,
      slot,
      values: p.optionValues
        .filter((v) => v.option === name)
        .map((v) => ({ id: v.id, value: v.value, color: v.swatchColor, image: v.swatchImage })),
    }))
    .filter((o) => o.values.length > 0);
  const valueName = new Map(p.optionValues.map((v) => [v.id, v.value]));

  const fields = readSpecFields(p.productType.specFields);
  const specs = readSpecs(p.specs);

  // Breadcrumb: the deepest category the product is in.
  const trails = p.categories.map((c) => categoryTrail(allCategories, c.id)).sort((a, b) => b.length - a.length);
  const guide = p.productType.sizeGuide;

  const variants = p.variants.map((v) => {
    const optionIds = [v.option1Id, v.option2Id, v.option3Id];
    return {
      id: v.id,
      sku: v.sku,
      optionIds,
      label: variantLabel(optionIds.map((id) => (id ? valueName.get(id) : null))),
      price: Number(v.price),
      salePrice: money(v.salePrice),
      stock: v.stock,
    };
  });

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    details: p.details,
    care: p.care,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    productTypeId: p.productTypeId,
    productType: p.productType.name,
    brand: p.brand,
    categoryIds: p.categories.map((c) => c.id),
    breadcrumb: (trails[0] ?? []).map((c) => ({ name: c.name, slug: c.slug })),
    /** Lowest price shoppers pay (for page titles and share previews). */
    fromPrice: Math.min(...variants.map(paidPrice)),
    specs: fields
      .filter((f) => specs[f.label] !== undefined && specs[f.label] !== "")
      .map((f) => ({ label: f.label, value: formatSpec(f, specs[f.label]) })),
    sizeGuide: guide ? { name: guide.name, notes: guide.notes, ...readSizeTable(guide.table) } : null,
    options,
    variants,
    media: p.media.map((m) => ({
      id: m.id,
      url: m.url,
      type: m.type,
      alt: m.alt ?? p.name,
      optionValueId: m.optionValueId,
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

/** Products sharing a category (same product type first), excluding the product and its look items. */
export const getRelatedProducts = storefrontCache(
  async (product: { id: string; categoryIds: string[]; productTypeId: string }, exclude: string[]) => {
    const products = await prisma.product.findMany({
      where: {
        ...live,
        id: { notIn: [product.id, ...exclude] },
        OR: [{ categories: { some: { id: { in: product.categoryIds } } } }, { productTypeId: product.productTypeId }],
      },
      include: cardInclude,
      take: 24,
    });
    products.sort(
      (a, b) =>
        Number(b.productTypeId === product.productTypeId) - Number(a.productTypeId === product.productTypeId) ||
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
  const listing = await getListing({ kind: "search", q }, { price: null, attrs: {}, sort: "relevance", page: 1 });
  return listing.products.slice(0, 5).map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.subtitle,
    price: p.price,
    image: p.images[0]?.url ?? null,
  }));
}
