"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { navCategories, products } from "@/lib/placeholder-data";

export function SearchBox({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the field when the panel opens; close on Escape.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();

  // Live, as-you-type results. Swapped for a real search query later.
  const productResults = useMemo(() => {
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.collection.toLowerCase().includes(q))
      .slice(0, 5);
  }, [q]);

  const categoryResults = useMemo(() => {
    if (!q) return [];
    return navCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [q]);

  const hasResults = productResults.length > 0 || categoryResults.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className={cn(
          "grid size-10 place-items-center rounded-full transition-colors duration-200 hover:bg-muted",
          className,
        )}
      >
        <Search className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close search"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Panel */}
          <div className="relative mx-auto max-w-2xl px-4 pt-[12vh]">
            <div className="overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
              <div className="flex items-center gap-2 border-b border-border p-3">
                <Search className="size-5 shrink-0 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for earrings, necklaces, rings…"
                  className="h-9 border-0 shadow-none focus-visible:ring-0"
                />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Results */}
              {q && (
                <div className="max-h-[50vh] overflow-y-auto p-2">
                  {!hasResults && (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No matches for “{query}”.
                    </p>
                  )}

                  {categoryResults.length > 0 && (
                    <div className="mb-1">
                      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Categories
                      </p>
                      {categoryResults.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                        >
                          <span
                            className="size-8 rounded-md"
                            style={{ background: c.image }}
                            aria-hidden
                          />
                          <span className="font-medium">{c.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {productResults.length > 0 && (
                    <div>
                      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Products
                      </p>
                      {productResults.map((p) => (
                        <Link
                          key={p.id}
                          href={`/product/${p.id}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted"
                        >
                          <span
                            className="size-10 rounded-md"
                            style={{ background: p.images[0] }}
                            aria-hidden
                          />
                          <span className="flex flex-1 flex-col">
                            <span className="text-sm font-medium">{p.name}</span>
                            <span className="text-xs text-muted-foreground">{p.collection}</span>
                          </span>
                          <span className="text-sm font-semibold">{formatPrice(p.price)}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
