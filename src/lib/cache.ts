import "server-only";
import { updateTag } from "next/cache";

/**
 * Cache tags for storefront data. Pages built from this data stay cached
 * until one of these tags is cleared.
 *
 * Call refreshStorefront() at the end of every admin server action that
 * changes what shoppers see, e.g.:
 *   - home sections, banners, menus, site settings → refreshStorefront("content")
 *   - products, categories, reviews               → refreshStorefront("products")
 */
export const CACHE_TAGS = {
  content: "storefront-content",
  products: "storefront-products",
} as const;

export function refreshStorefront(...which: (keyof typeof CACHE_TAGS)[]) {
  for (const key of which.length
    ? which
    : (Object.keys(CACHE_TAGS) as (keyof typeof CACHE_TAGS)[])) {
    updateTag(CACHE_TAGS[key]);
  }
}
