"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Minus, Plus, Tag, Trash2, Truck, X } from "lucide-react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyCode, closeBag, removeCode, removeLine, setQuantity } from "@/lib/bag-store";
import type { BagLine, Totals } from "@/lib/cart/pricing";
import { formatPrice } from "@/lib/format";

/** Pieces shared by the slide-out bag and the /cart page. */

export function BagLineItem({ line, size = "sm" }: { line: BagLine; size?: "sm" | "lg" }) {
  const href = `/products/${line.slug}`;
  const blocked = line.issue === "sold-out" || line.issue === "unavailable";

  return (
    <li className="flex gap-4 py-4">
      <Link
        href={href}
        onClick={closeBag}
        className={cn(
          "relative shrink-0 overflow-hidden rounded-md bg-muted",
          size === "lg" ? "aspect-[4/5] w-24 sm:w-28" : "aspect-[4/5] w-20",
          blocked && "opacity-50",
        )}
      >
        {line.image && <Image src={line.image} alt="" fill sizes="112px" className="object-cover" />}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={href} onClick={closeBag} className="text-sm font-medium hover:underline">
              {line.name}
            </Link>
            {line.variantName && <p className="text-xs text-muted-foreground">{line.variantName}</p>}
          </div>
          <p className="shrink-0 text-right text-sm">
            <span className="font-semibold">{formatPrice(blocked ? line.unitPrice * line.qty : line.lineTotal)}</span>
            {line.compareAtPrice && !blocked && (
              <span className="block text-xs text-muted-foreground line-through">
                {formatPrice(line.compareAtPrice * line.qty)}
              </span>
            )}
          </p>
        </div>

        {line.issue && (
          <p className="text-xs font-medium text-brand-accent">
            {line.issue === "sold-out"
              ? "Sold out — please remove it to check out."
              : line.issue === "unavailable"
                ? "No longer available — please remove it to check out."
                : `Only ${line.maxQty} left — we've updated your quantity.`}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-1">
          {blocked ? (
            <span />
          ) : (
            <div className="flex h-9 items-center rounded-md border border-border" role="group" aria-label={`Quantity of ${line.name}`}>
              <button
                type="button"
                onClick={() => setQuantity(line, line.qty - 1)}
                aria-label="Decrease quantity"
                className="grid size-9 place-items-center disabled:opacity-40"
              >
                <Minus className="size-3.5" />
              </button>
              <output className="w-7 text-center text-sm font-semibold" aria-live="polite">
                {line.qty}
              </output>
              <button
                type="button"
                onClick={() => setQuantity(line, line.qty + 1)}
                disabled={line.qty >= line.maxQty}
                aria-label="Increase quantity"
                className="grid size-9 place-items-center disabled:opacity-40"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => removeLine(line)}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <Trash2 className="size-3.5" />
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

export function FreeShippingBar({ totals }: { totals: Totals }) {
  const { freeShippingRemaining: remaining, freeShippingThreshold: threshold } = totals;
  if (remaining === null || totals.lines.length === 0) return null;
  const progress = threshold ? Math.min(1, 1 - remaining / threshold) : 1;

  return (
    <div className="grid gap-2 rounded-lg bg-muted px-4 py-3">
      <p className="flex items-center gap-2 text-sm" aria-live="polite">
        <Truck className="size-4 shrink-0" />
        {remaining > 0 ? (
          <span>
            You&apos;re <span className="font-semibold">{formatPrice(remaining)}</span> away from free shipping
          </span>
        ) : (
          <span className="font-semibold">You&apos;ve unlocked free shipping!</span>
        )}
      </p>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-background"
        role="progressbar"
        aria-label="Progress to free shipping"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className="h-full rounded-full bg-brand-accent transition-[width] duration-300 ease-snappy"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

export function CodeForm({ totals }: { totals: Totals }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const applied = totals.code && !totals.code.error ? totals.code.code : null;
  // A saved code that can't be used right now (e.g. minimum spend not reached).
  const waiting = totals.code?.error && totals.code.recognised ? totals.code : null;

  if (applied || waiting) {
    return (
      <div className="grid gap-1">
        <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm">
          <span className="flex items-center gap-2 font-semibold">
            <Tag className="size-4" />
            {(applied ?? waiting!.code).toUpperCase()}
          </span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              void removeCode();
            }}
            aria-label="Remove discount code"
            className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        {waiting && <p className="text-xs text-brand-accent">{waiting.error}</p>}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        start(async () => {
          const problem = await applyCode(value);
          setError(problem);
          if (!problem) setValue("");
        });
      }}
      className="grid gap-1"
    >
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Discount code"
          aria-label="Discount code"
          autoCapitalize="characters"
          maxLength={40}
          className="h-10 uppercase placeholder:normal-case"
        />
        <Button type="submit" variant="outline" disabled={pending || !value.trim()} className="h-10 px-4 font-semibold">
          {pending ? <Loader2 className="animate-spin" /> : "Apply"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

export function BagSummary({ totals, pending }: { totals: Totals; pending: boolean }) {
  return (
    <dl className={cn("grid gap-2 text-sm transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <Row label="Subtotal" value={formatPrice(totals.subtotal)} />
      {totals.discount && (totals.discount.amount > 0 || !totals.discount.freeShipping) && (
        <Row label={totals.discount.label} value={`−${formatPrice(totals.discount.amount)}`} accent />
      )}
      <Row
        label="Shipping"
        value={
          totals.shipping === 0
            ? totals.discount?.freeShipping && totals.discount.amount === 0
              ? `Free (${totals.discount.label})`
              : "Free"
            : formatPrice(totals.shipping)
        }
      />
      <div className="mt-1 flex items-baseline justify-between border-t border-border pt-3">
        <dt className="font-heading text-base font-bold uppercase">Total</dt>
        <dd className="flex items-center gap-2 text-lg font-bold">
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Updating" />}
          {formatPrice(totals.total)}
        </dd>
      </div>
      {totals.savings > 0 && (
        <p className="text-right text-sm font-semibold text-brand-accent">
          You&apos;re saving {formatPrice(totals.savings)}
        </p>
      )}
    </dl>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", accent && "text-brand-accent")}>
      <dt>{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export function CheckoutButton({ totals }: { totals: Totals }) {
  const blocked = !totals.canCheckout;
  return (
    <div className="grid gap-2">
      {blocked ? (
        <Button disabled className="h-12 w-full font-heading font-bold uppercase tracking-wide">
          Checkout
        </Button>
      ) : (
        <Link
          href="/checkout"
          onClick={closeBag}
          className={cn(buttonVariants(), "h-12 w-full font-heading font-bold uppercase tracking-wide")}
        >
          Checkout
        </Link>
      )}
      <p className="text-center text-xs text-muted-foreground">
        or 4 interest-free payments of {formatPrice(Math.ceil(Math.round(totals.total * 100) / 4) / 100)} with Afterpay
      </p>
    </div>
  );
}
