/**
 * Shop filters and sorting — shared by the server queries and the filter UI.
 * Everything lives in the URL (?price=under-20&colour=Gold&sort=price-asc) so
 * filtered pages can be shared, bookmarked and work without JavaScript.
 */

export const PRICE_BUCKETS = {
  "under-20": { label: "Under $20", min: 0, max: 20 },
  "20-30": { label: "$20 – $30", min: 20, max: 30 },
  "30-50": { label: "$30 – $50", min: 30, max: 50 },
  "50-plus": { label: "$50+", min: 50, max: Infinity },
} as const;
export type PriceBucket = keyof typeof PRICE_BUCKETS;

export const SORTS = {
  newest: "Newest",
  "best-selling": "Best selling",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
} as const;
export type Sort = keyof typeof SORTS | "relevance";

export type Filters = {
  price: PriceBucket | null;
  /**
   * Option and spec filters, by URL name: { colour: ["Navy"], "case-size": ["38 mm"] }.
   * The names come from each product type's options and filterable specs
   * (see filterKey in product-types.ts), so nothing here is product-specific.
   */
  attrs: Record<string, string[]>;
  sort: Sort;
  page: number;
};

/** URL params that aren't option/spec filters. */
const RESERVED = new Set(["price", "sort", "page", "q", "fbclid", "gclid"]);

export const PAGE_SIZE = 24;

/** At or below this many units we show LOW STOCK / "Only N left". */
export const LOW_STOCK = 5;

/** Most of one item a shopper can add to the bag at once. */
export const MAX_QTY = 20;

type Params = Record<string, string | string[] | undefined>;

const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? [v] : []).map((s) => s.trim()).filter(Boolean).slice(0, 20);

export function parseFilters(params: Params, defaultSort: Sort = "newest"): Filters {
  const one = (k: string) => list(params[k])[0];
  const price = one("price");
  const sort = one("sort");
  const page = Number.parseInt(one("page") ?? "1", 10);
  const attrs: Record<string, string[]> = {};
  for (const key of Object.keys(params).slice(0, 30)) {
    if (RESERVED.has(key) || !/^[a-z0-9-]{1,40}$/.test(key)) continue;
    const values = list(params[key]).map((v) => v.slice(0, 60));
    if (values.length) attrs[key] = values;
  }
  return {
    price: price && price in PRICE_BUCKETS ? (price as PriceBucket) : null,
    attrs,
    sort: sort && (sort in SORTS || sort === "relevance") ? (sort as Sort) : defaultSort,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}

/** Number of active filters (not counting sort/page), for the "Filters (2)" label. */
export function activeFilterCount(f: Filters) {
  return (f.price ? 1 : 0) + Object.values(f.attrs).reduce((n, values) => n + values.length, 0);
}
