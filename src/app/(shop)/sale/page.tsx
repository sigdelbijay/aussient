import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listingMetadata, ListingPageView } from "@/components/shop/listing-page";
import { getListingPage } from "@/lib/catalog";

// /sale shows the "sale" collection (name, description, rules and sort are set in the admin).
const SLUG = "sale";

export async function generateMetadata({ searchParams }: PageProps<"/sale">): Promise<Metadata> {
  const page = await getListingPage(SLUG);
  if (!page) return {};
  return listingMetadata(page, "/sale", await searchParams);
}

export default async function SalePage({ searchParams }: PageProps<"/sale">) {
  const page = await getListingPage(SLUG);
  if (!page) notFound();
  return <ListingPageView page={page} path="/sale" params={await searchParams} />;
}
