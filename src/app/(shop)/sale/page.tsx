import type { Metadata } from "next";
import { ProductListing } from "@/components/shop/product-listing";
import { activeFilterCount, parseFilters } from "@/lib/catalog-shared";
import { pageMetadata } from "@/lib/seo";

const description = "Fashion jewellery on sale at Aussient — earrings, necklaces and rings at their lowest prices.";

export async function generateMetadata({ searchParams }: PageProps<"/sale">): Promise<Metadata> {
  const filtered = activeFilterCount(parseFilters(await searchParams)) > 0;
  return pageMetadata({ title: "Sale", description, path: "/sale", noindex: filtered });
}

export default async function SalePage({ searchParams }: PageProps<"/sale">) {
  const sp = await searchParams;
  return (
    <ProductListing
      title="Sale"
      intro="Last chance styles at their lowest prices."
      scope={{ kind: "sale" }}
      filters={parseFilters(sp)}
      params={sp}
      basePath="/sale"
    />
  );
}
