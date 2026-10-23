import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listingMetadata, ListingPageView } from "@/components/shop/listing-page";
import { getListingPage } from "@/lib/catalog";

// /new-in shows the "new-in" collection (name, description, rules and sort are set in the admin).
const SLUG = "new-in";

export async function generateMetadata({ searchParams }: PageProps<"/new-in">): Promise<Metadata> {
  const page = await getListingPage(SLUG);
  if (!page) return {};
  return listingMetadata(page, "/new-in", await searchParams);
}

export default async function NewInPage({ searchParams }: PageProps<"/new-in">) {
  const page = await getListingPage(SLUG);
  if (!page) notFound();
  return <ListingPageView page={page} path="/new-in" params={await searchParams} />;
}
