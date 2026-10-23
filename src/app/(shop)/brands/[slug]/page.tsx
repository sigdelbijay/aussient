import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listingMetadata, ListingPageView } from "@/components/shop/listing-page";
import { getBrandPage } from "@/lib/catalog";

/** Every product from one brand, with the same filters as category pages. */
export async function generateMetadata({ params, searchParams }: PageProps<"/brands/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getBrandPage(slug);
  if (!page) return {};
  return listingMetadata(page, `/brands/${slug}`, await searchParams);
}

export default async function BrandPage({ params, searchParams }: PageProps<"/brands/[slug]">) {
  const { slug } = await params;
  const page = await getBrandPage(slug);
  if (!page) notFound();
  return <ListingPageView page={page} path={`/brands/${slug}`} params={await searchParams} />;
}
