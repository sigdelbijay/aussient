import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListing } from "@/components/shop/product-listing";
import { getCategory, type Scope } from "@/lib/catalog";
import { activeFilterCount, parseFilters } from "@/lib/catalog-shared";
import { pageMetadata } from "@/lib/seo";

async function load(slug: string) {
  if (slug === "all") return { name: "Shop all", image: null, scope: { kind: "all" } as Scope };
  const category = await getCategory(slug);
  if (!category) return null;
  return { name: category.name, image: category.image, scope: { kind: "category", slug } as Scope };
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const collection = await load(slug);
  if (!collection) return {};
  const filtered = activeFilterCount(parseFilters(await searchParams)) > 0;
  return pageMetadata({
    title: collection.name,
    description: `Shop ${collection.name.toLowerCase()} at Aussient — trend-led fashion jewellery with free shipping over $50 and 30-day returns.`,
    path: `/collections/${slug}`,
    image: collection.image ? { url: collection.image, alt: collection.name } : null,
    // Filtered variations are for shoppers, not for Google's index.
    noindex: filtered,
  });
}

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const collection = await load(slug);
  if (!collection) notFound();
  const sp = await searchParams;

  return (
    <ProductListing
      title={collection.name}
      scope={collection.scope}
      filters={parseFilters(sp)}
      params={sp}
      basePath={`/collections/${slug}`}
    />
  );
}
