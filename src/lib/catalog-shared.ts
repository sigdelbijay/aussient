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
  colours: string[];
  materials: string[];
  styles: string[];
  hypoallergenic: boolean;
  sort: Sort;
  page: number;
};

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
  return {
    price: price && price in PRICE_BUCKETS ? (price as PriceBucket) : null,
    colours: list(params.colour),
    materials: list(params.material),
    styles: list(params.style).map((s) => s.toLowerCase()),
    hypoallergenic: one("hypoallergenic") === "1",
    sort: sort && (sort in SORTS || sort === "relevance") ? (sort as Sort) : defaultSort,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}

/** Number of active filters (not counting sort/page), for the "Filters (2)" label. */
export function activeFilterCount(f: Filters) {
  return (
    (f.price ? 1 : 0) + f.colours.length + f.materials.length + f.styles.length + (f.hypoallergenic ? 1 : 0)
  );
}
