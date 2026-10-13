"use client";

import Link from "next/link";
import { Loader2, ShoppingBag } from "lucide-react";
import { useBag } from "@/lib/bag-store";
import { BagLineItem, BagSummary, CheckoutButton, CodeForm, FreeShippingBar } from "./bag-parts";

/** The full /cart page: items on the left, order summary on the right. */
export function CartView() {
  const { totals, pending, count } = useBag();

  if (!totals) {
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading your bag" />
      </div>
    );
  }

  if (totals.lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-16 text-center">
        <ShoppingBag className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">Your bag is empty.</p>
        <Link href="/new-in" className="font-semibold underline">
          Shop new in
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
      <section aria-label="Items in your bag">
        <p className="mb-3 text-sm text-muted-foreground">
          {count} {count === 1 ? "item" : "items"}
        </p>
        <FreeShippingBar totals={totals} />
        <ul className="divide-y divide-border border-b border-border">
          {totals.lines.map((line) => (
            <BagLineItem key={line.key} line={line} size="lg" />
          ))}
        </ul>
      </section>

      <aside className="grid h-fit gap-5 rounded-xl border border-border p-5 lg:sticky lg:top-24">
        <h2 className="font-heading text-lg font-extrabold uppercase">Order summary</h2>
        <CodeForm totals={totals} />
        <BagSummary totals={totals} pending={pending > 0} />
        <CheckoutButton totals={totals} />
      </aside>
    </div>
  );
}
