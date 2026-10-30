import type { Metadata } from "next";
import { ProductListing } from "@/components/shop/product-listing";
import { scopeHasProducts, type ListingPage } from "@/lib/catalog";
import { activeFilterCount, parseFilters } from "@/lib/catalog-shared";
import { pageMetadata, snippet } from "@/lib/seo";

type Params = Record<string, string | string[] | undefined>;

/**
 * Shared by the category/collection, brand, New In and Sale pages: title and
 * description from the database, filtered variations kept out of Google.
 */
export async function listingMetadata(page: ListingPage & { logo?: string | null }, path: string, params: Params): Promise<Metadata> {
  const image = page.image ?? page.logo ?? null;
  // Pages with nothing live in them (e.g. a department taken off the shop) stay out of Google.
  const empty = !(await scopeHasProducts(page.scope));
  return pageMetadata({
    title: page.name,
    description: snippet(page.description || `Shop ${page.name}.`),
    path,
    image: image ? { url: image, alt: page.name } : null,
    noindex: empty || activeFilterCount(parseFilters(params)) > 0,
  });
}

export function ListingPageView({
  page,
  path,
  params,
}: {
  page: ListingPage & { logo?: string | null };
  path: string;
  params: Params;
}) {
  return (
    <ProductListing
      title={page.name}
      intro={page.description ?? undefined}
      logo={page.logo}
      trail={page.trail}
      subcategories={page.children}
      scope={page.scope}
      filters={parseFilters(params, page.sort)}
      defaultSort={page.sort}
      params={params}
      basePath={path}
    />
  );
}
