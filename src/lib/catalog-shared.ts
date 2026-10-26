/**
 * Shop filters and sorting — shared by the server queries and the filter UI.
 * Everything lives in the URL (?price=0-20&colour=Gold&sort=price-asc) so
 * filtered pages can be shared, bookmarked and work without JavaScript.
 */

/**
 * A price range shoppers filter by, in dollars: min inclusive, max exclusive
 * (null = no top). In the URL as "20-50" or "200-" (200 and over).
 */
export type PriceRange = { min: number; max: number | null };

export const priceParam = (r: PriceRange) => `${r.min}-${r.max ?? ""}`;

export function priceLabel(r: PriceRange) {
  if (r.max === null) return `$${r.min}+`;
  if (r.min === 0) return `Under $${r.max}`;
  return `$${r.min} – $${r.max}`;
}

function parsePrice(text: string | undefined): PriceRange | null {
  const m = text?.match(/^(\d{1,6})-(\d{1,6})?$/);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] === undefined ? null : Number(m[2]);
  return max !== null && max <= min ? null : { min, max };
}

/** "Nice" price steps the automatic price filter picks its ranges from. */
const PRICE_STEPS = [10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 2000];

/**
 * Up to 5 price ranges that suit the prices given — so a page of $15 studs and
 * one of $150 watches each get sensible choices. Ranges with no products are dropped.
 */
export function priceRanges(prices: number[]): (PriceRange & { count: number })[] {
  if (prices.length === 0) return [];
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  let cuts = PRICE_STEPS.filter((s) => s > lo && s <= hi);
  // Too many? Keep 4 spread evenly.
  if (cuts.length > 4) cuts = [0, 1, 2, 3].map((i) => cuts[Math.round((i * (cuts.length - 1)) / 3)]);
  const edges = [0, ...new Set(cuts)];
  return edges
    .map((min, i) => {
      const max = edges[i + 1] ?? null;
      return { min, max, count: prices.filter((p) => p >= min && (max === null || p < max)).length };
    })
    .filter((r) => r.count > 0);
}

export const SORTS = {
  newest: "Newest",
  "best-selling": "Best selling",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
} as const;
export type Sort = keyof typeof SORTS | "relevance";

export type Filters = {
  price: PriceRange | null;
  /**
   * Brand, option and spec filters, by URL name: { brand: ["Southern Time"], colour: ["Navy"], "case-size": ["38 mm"] }.
   * The names come from each product type's options and filterable specs
   * (see filterKey in product-types.ts), so nothing here is product-specific.
   */
  attrs: Record<string, string[]>;
  sort: Sort;
  page: number;
};

/** URL params that aren't brand/option/spec filters. */
const RESERVED = new Set(["price", "sort", "page", "q", "variant", "fbclid", "gclid"]);

/** URL name of the brand filter. */
export const BRAND_KEY = "brand";

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
    price: parsePrice(price),
    attrs,
    sort: sort && (Object.hasOwn(SORTS, sort) || sort === "relevance") ? (sort as Sort) : defaultSort,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}

/** Number of active filters (not counting sort/page), for the "Filters (2)" label. */
export function activeFilterCount(f: Filters) {
  return (f.price ? 1 : 0) + Object.values(f.attrs).reduce((n, values) => n + values.length, 0);
}
