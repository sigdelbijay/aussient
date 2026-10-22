import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { getListing, type Scope } from "@/lib/catalog";
import { activeFilterCount, type Filters } from "@/lib/catalog-shared";
import { FilterForm, SortSelect } from "./filter-form";

type Params = Record<string, string | string[] | undefined>;

/** Rebuilds the current URL with one param changed (used for page links). */
function hrefWith(basePath: string, params: Params, change: Record<string, string | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    for (const item of Array.isArray(v) ? v : v ? [v] : []) if (item) sp.append(k, item);
  }
  for (const [k, v] of Object.entries(change)) {
    sp.delete(k);
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Product grid with filters, sorting and paging — used by collections, new-in, sale and search. */
export async function ProductListing({
  title,
  intro,
  scope,
  filters,
  params,
  basePath,
  keep,
}: {
  title: string;
  intro?: React.ReactNode;
  scope: Scope;
  filters: Filters;
  params: Params;
  basePath: string;
  keep?: Record<string, string>;
}) {
  const listing = await getListing(scope, filters);
  const active = activeFilterCount(filters);
  const clearHref = keep ? `${basePath}?${new URLSearchParams(keep)}` : basePath;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display text-3xl sm:text-5xl">{title}</h1>
          {intro && <div className="mt-2 max-w-2xl text-sm text-muted-foreground">{intro}</div>}
          <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
            {listing.total} {listing.total === 1 ? "product" : "products"}
            {active > 0 && (
              <>
                {" · "}
                <Link href={clearHref} className="font-medium text-foreground underline">
                  Clear filters
                </Link>
              </>
            )}
          </p>
        </div>
        <SortSelect value={filters.sort} includeRelevance={scope.kind === "search"} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[13rem_1fr] lg:gap-10">
        <aside aria-label="Filters">
          <FilterForm
            basePath={basePath}
            options={listing.filters}
            filters={filters}
            activeCount={active}
            keep={keep}
          />
        </aside>

        <div>
          {listing.products.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
              Nothing matches those filters.{" "}
              <Link href={clearHref} className="font-semibold text-foreground underline">
                Clear filters
              </Link>
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
              {listing.products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {listing.pages > 1 && (
            <nav aria-label="Pages" className="mt-10 flex items-center justify-center gap-1">
              {Array.from({ length: listing.pages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={hrefWith(basePath, params, { page: n === 1 ? null : String(n) })}
                  aria-current={n === listing.page ? "page" : undefined}
                  className={
                    n === listing.page
                      ? "grid size-9 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
                      : "grid size-9 place-items-center rounded-md text-sm hover:bg-muted"
                  }
                >
                  {n}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
