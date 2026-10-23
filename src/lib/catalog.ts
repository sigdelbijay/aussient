import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/lib/cache";
import {
  BRAND_KEY,
  PAGE_SIZE,
  priceLabel,
  priceParam,
  priceRanges,
  SORTS,
  type Filters,
  type Sort,
} from "@/lib/catalog-shared";
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
 * The shop has a few hundred products, so listings load every product in a
 * category/collection/brand once (cached) and filter/sort in plain TypeScript
 * — simpler than building SQL for JSON specs and per-variant prices.
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
  | { kind: "brand"; slug: string }
  | { kind: "all" }
  | { kind: "search"; q: string };

/** Card data plus the extra facts needed to filter, sort and search. */
const itemInclude = {
  ...cardInclude,
  productType: { select: { name: true, optionNames: true, specFields: true } },
  categories: { select: { name: true } },
  _count: { select: { orderItems: true } },
} satisfies Prisma.ProductInclude;

type Attribute = { key: string; label: string; value: string; color: string | null; image: string | null; kind: "option" | "brand" | "spec" };

/** One product in a scope, ready to filter in memory (plain JSON, so it can be cached). */
type Item = {
  card: ProductCardData;
  createdAt: number;
  sold: number;
  /** Lowest price shoppers pay. */
  price: number;
  /** Brand, option values and filterable specs. */
  attrs: Attribute[];
  /** Lower-case text searched by the search box. */
  text: string;
};

function toItem(p: Prisma.ProductGetPayload<{ include: typeof itemInclude }>): Item {
  const card = toCard(p);
  const fields = readSpecFields(p.productType.specFields);
  const specs = readSpecs(p.specs);

  const attrs: Attribute[] = p.optionValues.map((o) => ({
    key: filterKey(o.option),
    label: o.option,
    value: o.value,
    color: o.swatchColor,
    image: o.swatchImage,
    kind: "option",
  }));
  if (p.brand) attrs.push({ key: BRAND_KEY, label: "Brand", value: p.brand.name, color: null, image: null, kind: "brand" });
  for (const field of fields) {
    const value = specs[field.label];
    if (!field.filterable || value === undefined || value === "" || value === false) continue;
    attrs.push({ key: filterKey(field.label), label: field.label, value: formatSpec(field, value), color: null, image: null, kind: "spec" });
  }

  // Name, description, type, brand, tags, categories, every spec and option value.
  const text = [
    p.name,
    p.description,
    p.productType.name,
    p.brand?.name,
    ...p.tags,
    ...p.categories.map((c) => c.name),
    // Yes/no specs match by their name ("hypoallergenic"), others by value ("quartz", "38 mm").
    ...fields.map((f) =>
      specs[f.label] === undefined || specs[f.label] === false ? "" : f.kind === "yes-no" ? f.label : formatSpec(f, specs[f.label]),
    ),
    ...p.optionValues.map((o) => o.value),
  ]
    .join(" ")
    .toLowerCase();

  return {
    card,
    createdAt: p.createdAt.getTime(),
    sold: p._count.orderItems,
    price: card.price,
    // A spec named "Brand" would clash with the brand filter, so the brand wins.
    attrs: attrs.filter((a) => a.kind === "brand" || a.key !== BRAND_KEY),
    text,
  };
}

/**
 * Every live product in a scope, loaded once and cached until a product changes.
 * Filters, sorting and paging then run in memory (the shop has a few hundred
 * products, so this is fast and much simpler than SQL over JSON specs).
 */
const getScopeItems = storefrontCache(
  async (scope: Exclude<Scope, { kind: "search" }>): Promise<Item[]> => {
    switch (scope.kind) {
      case "category": {
        const all = await getCategories();
        const category = all.find((c) => c.slug === scope.slug);
        if (!category) return [];
        return loadItems([{ categories: { some: { id: { in: withDescendants(all, category.id) } } } }]);
      }
      case "brand":
        return loadItems([{ brand: { slug: scope.slug } }]);
      case "collection": {
        const c = await prisma.collection.findUnique({ where: { slug: scope.slug } });
        if (!c) return [];
        if (c.type === "MANUAL") return loadItems([{ collections: { some: { id: c.id } } }]);
        return ruleItems({
          ...c,
          rulePriceUnder: c.rulePriceUnder === null ? null : Number(c.rulePriceUnder),
          rulePriceOver: c.rulePriceOver === null ? null : Number(c.rulePriceOver),
        });
      }
      default:
        return loadItems([]);
    }
  },
  ["scope-items"],
  { tags: [CACHE_TAGS.products] },
);

/** Live products (with at least one variant) matching every condition. */
async function loadItems(and: Prisma.ProductWhereInput[]): Promise<Item[]> {
  const rows = await prisma.product.findMany({ where: { AND: [live, { variants: { some: {} } }, ...and] }, include: itemInclude });
  return rows.map(toItem);
}

/** An automatic collection's rules. Blank rules are ignored. */
export type CollectionRules = {
  ruleCategoryId: string | null;
  ruleProductTypeId: string | null;
  ruleBrandId: string | null;
  ruleTag: string | null;
  ruleOnSale: boolean;
  rulePriceUnder: number | null;
  rulePriceOver: number | null;
};

/** Live products matching every rule that's set (no rules = every product). */
async function ruleItems(rules: CollectionRules): Promise<Item[]> {
  const and: Prisma.ProductWhereInput[] = [];
  if (rules.ruleCategoryId) {
    and.push({ categories: { some: { id: { in: withDescendants(await getCategories(), rules.ruleCategoryId) } } } });
  }
  if (rules.ruleProductTypeId) and.push({ productTypeId: rules.ruleProductTypeId });
  if (rules.ruleBrandId) and.push({ brandId: rules.ruleBrandId });
  if (rules.ruleTag) and.push({ tags: { has: rules.ruleTag.toLowerCase() } });
  if (rules.ruleOnSale) and.push(onSaleWhere);
  // "Price under $X" compares the price shoppers pay (sale price if lower).
  const { rulePriceUnder: under, rulePriceOver: over } = rules;
  return (await loadItems(and)).filter((i) => (under === null || i.price < under) && (over === null || i.price > over));
}

/** For the admin's live preview: how many products match some (unsaved) rules, plus the first few. */
export async function previewCollectionRules(rules: CollectionRules, sort: Sort) {
  const items = sortItems(await ruleItems(rules), sort, "");
  return { total: items.length, products: items.slice(0, 12).map((i) => i.card) };
}

/** Every search word must appear somewhere in the product's text. */
function matchesSearch(item: Item, q: string) {
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .every((w) => item.text.includes(w));
}

// ── Filters (built from the products shown — nothing hard-coded) ──

export type FilterGroup = {
  /** URL name, e.g. "strap-colour" (or "price"). */
  key: string;
  label: string;
  /** swatch = colour dots, chip = small buttons (sizes), list = checkboxes. */
  display: "swatch" | "chip" | "list";
  values: { value: string; label: string; count: number; color: string | null; image: string | null }[];
};

function filterGroups(items: Item[], scope: Scope): FilterGroup[] {
  const groups = new Map<string, { key: string; label: string; kind: Attribute["kind"]; values: Map<string, FilterGroup["values"][number]> }>();
  for (const item of items) {
    const seen = new Set<string>(); // count each product once per value
    for (const a of item.attrs) {
      if (a.kind === "brand" && scope.kind === "brand") continue; // every product is that brand
      const group = groups.get(a.key) ?? { key: a.key, label: a.label, kind: a.kind, values: new Map() };
      groups.set(a.key, group);
      const id = a.value.toLowerCase();
      const value = group.values.get(id) ?? { value: a.value, label: a.value, count: 0, color: a.color, image: a.image };
      group.values.set(id, value);
      if (!seen.has(`${a.key}:${id}`)) value.count++;
      seen.add(`${a.key}:${id}`);
    }
  }

  const order = { option: 0, brand: 1, spec: 2 }; // Size, Colour… then Brand, then specs
  const out: FilterGroup[] = [...groups.values()]
    .sort((a, b) => order[a.kind] - order[b.kind])
    .map((g) => {
      let values = [...g.values.values()];
      // Options keep the admin's order (S, M, L); others are sorted, numbers numerically.
      if (g.kind !== "option") values = values.sort((a, b) => a.value.localeCompare(b.value, "en", { numeric: true }));
      const display: FilterGroup["display"] = values.every((v) => v.color || v.image)
        ? "swatch"
        : g.kind === "option" && values.every((v) => v.value.length <= 5)
          ? "chip"
          : "list";
      return { key: g.key, label: g.label, display, values };
    });

  const prices = priceRanges(items.map((i) => i.price));
  out.unshift({
    key: "price",
    label: "Price",
    display: "list",
    values: prices.map((r) => ({ value: priceParam(r), label: priceLabel(r), count: r.count, color: null, image: null })),
  });

  // Only filters that would narrow the list: drop a group whose one value every product has.
  return out.filter((g) => g.values.length > 1 || (g.values.length === 1 && g.values[0].count < items.length));
}

function matchesFilters(item: Item, f: Filters, known: Set<string>) {
  if (f.price && (item.price < f.price.min || (f.price.max !== null && item.price >= f.price.max))) return false;
  for (const [key, wanted] of Object.entries(f.attrs)) {
    if (!known.has(key)) continue; // e.g. a tracking param — not a filter on this page
    const want = new Set(wanted.map((w) => w.toLowerCase()));
    if (!item.attrs.some((a) => a.key === key && want.has(a.value.toLowerCase()))) return false;
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

/** Sorts in place (and returns) items; `q` is the search text, for "relevance". */
function sortItems(items: Item[], sort: Sort, q: string) {
  return items.sort((a, b) => {
    switch (sort) {
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "best-selling":
        return b.sold - a.sold || b.createdAt - a.createdAt;
      case "relevance": {
        // Name matches first, then everything else by newest.
        const an = a.card.name.toLowerCase().includes(q) ? 0 : 1;
        const bn = b.card.name.toLowerCase().includes(q) ? 0 : 1;
        return an - bn || b.createdAt - a.createdAt;
      }
      default:
        return b.createdAt - a.createdAt;
    }
  });
}

export async function getListing(scope: Scope, filters: Filters): Promise<Listing> {
  const all =
    scope.kind === "search"
      ? (await getScopeItems({ kind: "all" })).filter((i) => matchesSearch(i, scope.q))
      : await getScopeItems(scope);
  const groups = filterGroups(all, scope);
  const known = new Set(groups.map((g) => g.key));
  const items = all.filter((i) => matchesFilters(i, filters, known));

  sortItems(items, filters.sort, scope.kind === "search" ? scope.q.toLowerCase() : "");

  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  return {
    products: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((i) => i.card),
    total: items.length,
    page,
    pages,
    filters: groups,
  };
}

/** A listing page's heading and where it sits in the shop. */
export type ListingPage = {
  name: string;
  image: string | null;
  description: string | null;
  scope: Scope;
  /** Default order (a collection's own sort). */
  sort: Sort;
  /** Category pages: the categories above it, and the ones inside it. */
  trail: { name: string; slug: string }[];
  children: { name: string; slug: string }[];
};

/** What /collections/[slug] shows: a category, or else a collection with that web address. */
export const getListingPage = storefrontCache(
  async (slug: string): Promise<ListingPage | null> => {
    const all = await getCategories();
    const category = all.find((c) => c.slug === slug);
    if (category) {
      return {
        name: category.name,
        image: category.image,
        description: null,
        scope: { kind: "category", slug },
        sort: "newest",
        trail: categoryTrail(all, category.id).slice(0, -1).map(({ name, slug }) => ({ name, slug })),
        children: all.filter((c) => c.parentId === category.id).map(({ name, slug }) => ({ name, slug })),
      };
    }
    const collection = await prisma.collection.findUnique({
      where: { slug },
      select: { name: true, image: true, description: true, sort: true },
    });
    if (!collection) return null;
    return {
      ...collection,
      scope: { kind: "collection", slug },
      sort: Object.hasOwn(SORTS, collection.sort) ? (collection.sort as Sort) : "newest",
      trail: [],
      children: [],
    };
  },
  ["listing-page"],
  { tags: [CACHE_TAGS.products] },
);

/** What /brands/[slug] shows. */
export const getBrandPage = storefrontCache(
  async (slug: string): Promise<(ListingPage & { logo: string | null }) | null> => {
    const brand = await prisma.brand.findUnique({ where: { slug }, select: { name: true, logo: true, description: true } });
    if (!brand) return null;
    return { ...brand, image: null, scope: { kind: "brand", slug }, sort: "newest", trail: [], children: [] };
  },
  ["brand-page"],
  { tags: [CACHE_TAGS.products] },
);

/** The first products of a collection, in its own order — for home page rows. */
export async function getCollectionRow(slug: string, limit: number): Promise<ProductCardData[]> {
  const page = await getListingPage(slug);
  if (!page || page.scope.kind !== "collection") return [];
  const listing = await getListing(page.scope, { price: null, attrs: {}, sort: page.sort, page: 1 });
  return listing.products.slice(0, limit);
}

/** Top-level categories (with a picture) — the home page's "Shop by category" tiles. */
export async function getTopCategories() {
  return (await getCategories()).filter((c) => c.parentId === null);
}

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
  //
  // `display` picks the control: colour swatches when every value has a swatch,
  // buttons for sizes (or other short values like "38"), a dropdown otherwise.
  const options = p.productType.optionNames
    .map((name, slot) => {
      const values = p.optionValues
        .filter((v) => v.option === name)
        .map((v) => ({ id: v.id, value: v.value, color: v.swatchColor, image: v.swatchImage }));
      const display: "swatch" | "button" | "select" = values.every((v) => v.color || v.image)
        ? "swatch"
        : /size/i.test(name) || values.every((v) => v.value.length <= 6)
          ? "button"
          : "select";
      return { name, slot, display, values };
    })
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
