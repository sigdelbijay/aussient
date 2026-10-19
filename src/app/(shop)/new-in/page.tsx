import type { Metadata } from "next";
import { ProductListing } from "@/components/shop/product-listing";
import { activeFilterCount, parseFilters } from "@/lib/catalog-shared";
import { pageMetadata } from "@/lib/seo";

const description = "The latest drops from Aussient — new earrings, necklaces and rings every week.";

export async function generateMetadata({ searchParams }: PageProps<"/new-in">): Promise<Metadata> {
  const filtered = activeFilterCount(parseFilters(await searchParams)) > 0;
  return pageMetadata({ title: "New In", description, path: "/new-in", noindex: filtered });
}

export default async function NewInPage({ searchParams }: PageProps<"/new-in">) {
  const sp = await searchParams;
  return (
    <ProductListing
      title="New In"
      intro="Fresh drops every week."
      scope={{ kind: "new" }}
      filters={parseFilters(sp, "newest")}
      params={sp}
      basePath="/new-in"
    />
  );
}
