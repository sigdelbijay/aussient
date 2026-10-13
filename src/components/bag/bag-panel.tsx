"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, ShoppingBag, X } from "lucide-react";
import { cn } from "cn";
import { closeBag, useBag } from "@/lib/bag-store";
import { BagLineItem, BagSummary, CheckoutButton, CodeForm, FreeShippingBar } from "./bag-parts";

/** Slide-out bag. Opens when something is added or the header bag icon is clicked. */
export function BagPanel() {
  const { totals, open, pending, count } = useBag();
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Close when navigating to another page.
  useEffect(() => {
    closeBag();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeBag();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={cn("fixed inset-0 z-[65]", !open && "pointer-events-none")} inert={!open}>
      <button
        type="button"
        aria-label="Close bag"
        tabIndex={-1}
        onClick={closeBag}
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your bag"
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-background shadow-2xl transition-transform duration-300 ease-snappy",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-heading text-lg font-extrabold uppercase">
            Your bag{count > 0 && <span className="text-muted-foreground"> ({count})</span>}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={closeBag}
            aria-label="Close bag"
            className="grid size-10 place-items-center rounded-full hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </header>

        {!totals ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : totals.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Your bag is empty.</p>
            <Link href="/new-in" onClick={closeBag} className="text-sm font-semibold underline">
              Shop new in
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              <div className="pt-4">
                <FreeShippingBar totals={totals} />
              </div>
              <ul className="divide-y divide-border">
                {totals.lines.map((line) => (
                  <BagLineItem key={line.key} line={line} />
                ))}
              </ul>
            </div>
            <footer className="grid gap-4 border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <CodeForm totals={totals} />
              <BagSummary totals={totals} pending={pending > 0} />
              <CheckoutButton totals={totals} />
              <Link href="/cart" onClick={closeBag} className="text-center text-sm font-medium underline">
                View bag
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
