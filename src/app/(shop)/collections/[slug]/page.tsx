import type { Metadata } from "next";
import { redirectOrNotFound } from "@/lib/redirects";
import { listingMetadata, ListingPageView } from "@/components/shop/listing-page";
import { getListingPage, type ListingPage } from "@/lib/catalog";

/** A category, or else a collection (e.g. "Gifts under $50") with this web address. */
async function load(slug: string): Promise<ListingPage | null> {
  const page = await getListingPage(slug);
  // /collections/all lists everything, even before an "all" collection is set up.
  if (!page && slug === "all") {
    return { name: "Shop all", image: null, description: null, scope: { kind: "all" }, sort: "newest", trail: [], children: [] };
  }
  return page;
}

export async function generateMetadata({ params, searchParams }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) return {};
  return listingMetadata(page, `/collections/${slug}`, await searchParams);
}

export default async function CollectionPage({ params, searchParams }: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) return redirectOrNotFound(`/collections/${slug}`);
  return <ListingPageView page={page} path={`/collections/${slug}`} params={await searchParams} />;
}
