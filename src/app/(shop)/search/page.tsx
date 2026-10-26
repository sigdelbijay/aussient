import type { Metadata } from "next";
import Form from "next/form";
import { Search } from "lucide-react";
import { ProductListing } from "@/components/shop/product-listing";
import { Input } from "@/components/ui/input";
import { parseFilters } from "@/lib/catalog-shared";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const q = String((await searchParams).q ?? "").trim();
  return pageMetadata({
    title: q ? `Search: ${q}` : "Search",
    description: "Search products, brands and categories.",
    path: "/search",
    // Search results pages shouldn't appear in Google.
    noindex: true,
  });
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = String(Array.isArray(sp.q) ? sp.q[0] : (sp.q ?? "")).trim().slice(0, 80);

  const searchForm = (
    <Form action="/search" className="mt-4 flex max-w-lg gap-2" role="search">
      <Input type="search" name="q" defaultValue={q} placeholder="Search products, brands…" aria-label="Search products" className="h-11" />
      <button type="submit" aria-label="Search" className="grid size-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
        <Search className="size-5" />
      </button>
    </Form>
  );

  if (!q) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <h1 className="text-display text-3xl sm:text-5xl">Search</h1>
        {searchForm}
      </div>
    );
  }

  return (
    <ProductListing
      title={`“${q}”`}
      intro={searchForm}
      scope={{ kind: "search", q }}
      filters={parseFilters(sp, "relevance")}
      defaultSort="relevance"
      params={sp}
      basePath="/search"
      keep={{ q }}
    />
  );
}
