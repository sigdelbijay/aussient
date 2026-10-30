"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import type { Suggestion } from "@/lib/catalog";

/** Header search: shows up to 5 matching products as you type; Enter opens the full results page. */
export function SearchBox({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ q: string; items: Suggestion[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const q = query.trim();

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

  // Fetch suggestions 200ms after typing stops; drop responses for stale queries.
  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data: { results: Suggestion[] } = await res.json();
        setResults({ q, items: data.results });
      } catch {
        // aborted or offline — keep the previous results
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const loading = q.length >= 2 && results?.q !== q;
  const items = q.length >= 2 ? (results?.items ?? []) : [];

  function close() {
    setOpen(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!q) return;
    close();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className={cn(
          "grid size-10 place-items-center rounded-full transition-colors duration-200 hover:bg-white/15", // on the teal header
          className,
        )}
      >
        <Search className="size-5" />
      </button>

      {open && (
        // text-popover-foreground: the trigger sits on the teal header's white text.
        <div className="fixed inset-0 z-[60] text-popover-foreground">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close search"
            onClick={close}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Panel */}
          <div className="relative mx-auto max-w-2xl px-4 pt-[12vh]">
            <div className="overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
              <form
                onSubmit={onSubmit}
                role="search"
                className="flex items-center gap-2 border-b border-border p-3"
              >
                {loading ? (
                  <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <Search className="size-5 shrink-0 text-muted-foreground" />
                )}
                <Input
                  ref={inputRef}
                  type="search"
                  name="q"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products, brands…"
                  aria-label="Search products"
                  autoComplete="off"
                  className="h-9 border-0 shadow-none focus-visible:ring-0"
                />
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </form>

              {/* Results */}
              {q.length >= 2 && !loading && (
                <div className="max-h-[50vh] overflow-y-auto p-2" aria-live="polite">
                  {items.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No matches for “{q}”.
                    </p>
                  ) : (
                    <>
                      {items.map((p) => (
                        <Link
                          key={p.slug}
                          href={`/products/${p.slug}`}
                          onClick={close}
                          className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted"
                        >
                          <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                            {p.image && (
                              <Image src={p.image} alt="" fill sizes="48px" className="object-cover" />
                            )}
                          </span>
                          <span className="flex flex-1 flex-col">
                            <span className="text-sm font-medium">{p.name}</span>
                            <span className="text-xs text-muted-foreground">{p.category}</span>
                          </span>
                          <span className="text-sm font-semibold">{formatPrice(p.price)}</span>
                        </Link>
                      ))}
                      <Link
                        href={`/search?q=${encodeURIComponent(q)}`}
                        onClick={close}
                        className="mt-1 block rounded-md px-3 py-2.5 text-center text-sm font-semibold text-brand-accent hover:bg-muted"
                      >
                        See all results for “{q}” →
                      </Link>
                    </>
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
