"use client";

import { useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WishlistButton } from "@/components/wishlist-button";
import { addToBag } from "@/lib/bag-store";
import { LOW_STOCK, MAX_QTY } from "@/lib/catalog-shared";
import { formatPrice } from "@/lib/format";
import type { ProductDetail } from "@/lib/catalog";
import { Gallery } from "./gallery";
import { NotifyForm } from "./notify-form";
import { Stars } from "./stars";

type Detail = ProductDetail;
type Variant = Detail["variants"][number];

/** The first variant in stock (or just the first) — what the page starts on. */
const startVariant = (p: Detail) => p.variants.find((v) => v.stock > 0) ?? p.variants[0];

/**
 * The top of the product page: gallery + everything needed to buy. Shoppers
 * pick a value for each option (e.g. Size, then Colour); that picks one
 * variant, whose photos, price and stock are shown.
 */
export function ProductView({
  product,
  children,
}: {
  product: ProductDetail;
  /** Description / details / care / shipping, rendered under the buy box. */
  children: React.ReactNode;
}) {
  // The chosen value id for each option slot (option1/2/3).
  const [picked, setPicked] = useState<(string | null)[]>(() => startVariant(product).optionIds);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const slots = product.options.map((o) => o.slot);
  const matches = (v: Variant, choice: (string | null)[]) => slots.every((s) => v.optionIds[s] === choice[s]);
  // null = that combination isn't sold (e.g. no XL in Navy).
  const variant = product.variants.find((v) => matches(v, picked)) ?? null;

  const { price, salePrice, stock } = variant ?? { ...startVariant(product), stock: 0 };
  const onSale = salePrice !== null && salePrice < price;
  const pay = onSale ? salePrice : price;
  const soldOut = stock <= 0;
  const maxQty = Math.max(1, Math.min(stock, MAX_QTY));

  // Photos of the chosen values (e.g. the Navy photos) first, then the general ones.
  const own = product.media.filter((m) => m.optionValueId && picked.includes(m.optionValueId));
  const general = product.media.filter((m) => !m.optionValueId);
  const media = own.length || general.length ? [...own, ...general] : product.media;

  /** Picks a value; if that combination doesn't exist, jumps to the closest one that does. */
  function choose(slot: number, valueId: string) {
    let next = [...picked];
    next[slot] = valueId;
    if (!product.variants.some((v) => matches(v, next))) {
      const withValue = product.variants.filter((v) => v.optionIds[slot] === valueId);
      const score = (v: Variant) => slots.filter((s) => v.optionIds[s] === next[s]).length + (v.stock > 0 ? 10 : 0);
      const best = withValue.sort((a, b) => score(b) - score(a))[0];
      if (best) next = [...best.optionIds];
    }
    setPicked(next);
    setQty(1);
    setAdded(false);
  }

  /** Is this value buyable with the other choices as they are? */
  function inStock(slot: number, valueId: string) {
    const choice = [...picked];
    choice[slot] = valueId;
    return product.variants.some((v) => matches(v, choice) && v.stock > 0);
  }

  function add() {
    if (!variant) return;
    addToBag(
      {
        productId: product.id,
        variantId: variant.id,
        slug: product.slug,
        name: product.name,
        variantName: variant.label,
        price: pay,
        compareAtPrice: onSale ? price : null,
        image: media.find((m) => m.type === "IMAGE")?.url ?? null,
      },
      qty,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
      <div className="lg:sticky lg:top-24 lg:self-start">
        {/* Remount when the chosen photos change so the gallery starts at the first one. */}
        <Gallery key={own.map((m) => m.id).join() || "all"} media={media} />
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-display text-3xl sm:text-4xl">{product.name}</h1>
            <WishlistButton productId={product.id} className="shrink-0 border border-border" />
          </div>
          {product.rating.count > 0 && (
            <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm hover:underline">
              <Stars rating={product.rating.average} />
              <span className="text-muted-foreground">
                {product.rating.average.toFixed(1)} ({product.rating.count}{" "}
                {product.rating.count === 1 ? "review" : "reviews"})
              </span>
            </a>
          )}
        </div>

        {/* Price */}
        <div>
          <p className="flex flex-wrap items-center gap-3">
            <span className={cn("text-2xl font-bold", onSale && "text-brand-accent")}>
              {formatPrice(pay)}
            </span>
            {onSale && (
              <>
                <span className="text-lg text-muted-foreground line-through">
                  <span className="sr-only">Was </span>
                  {formatPrice(price)}
                </span>
                <Badge variant="sale">Sale</Badge>
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or 4 interest-free payments of{" "}
            <span className="font-semibold text-foreground">{formatPrice(Math.ceil(Math.round(pay * 100) / 4) / 100)}</span>{" "}
            with <span className="font-semibold text-foreground">Afterpay</span>
          </p>
        </div>

        {/* Options, e.g. Size and Colour */}
        {product.options.map((option) => {
          const chosen = option.values.find((v) => v.id === picked[option.slot]);
          return (
            <fieldset key={option.name}>
              <legend className="mb-2 text-sm">
                <span className="font-semibold">{option.name}:</span> {chosen?.value}
              </legend>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {option.values.map((v) => {
                  const available = inStock(option.slot, v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={v.id === picked[option.slot]}
                      onClick={() => choose(option.slot, v.id)}
                      className={cn(
                        "flex min-h-9 min-w-11 items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors duration-200",
                        v.id === picked[option.slot]
                          ? "border-foreground bg-foreground/5 font-semibold"
                          : "border-border hover:border-foreground/50",
                        !available && "text-muted-foreground",
                      )}
                    >
                      {(v.color || v.image) && (
                        <span
                          className="size-4 rounded-full bg-cover bg-center ring-1 ring-inset ring-black/10"
                          style={v.image ? { backgroundImage: `url("${v.image}")` } : { background: v.color ?? undefined }}
                        />
                      )}
                      <span className={cn(!available && "line-through")}>{v.value}</span>
                      {!available && <span className="sr-only">(sold out)</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
        {product.sizeGuide && (
          <a
            href="#size-guide"
            onClick={() => document.getElementById("size-guide")?.setAttribute("open", "")}
            className="-mt-2 w-fit text-sm underline underline-offset-2"
          >
            Size guide
          </a>
        )}

        {/* Stock */}
        <p className="text-sm font-medium" aria-live="polite">
          {!variant ? (
            <span className="text-muted-foreground">This combination isn&apos;t available</span>
          ) : soldOut ? (
            <span className="text-muted-foreground">Sold out</span>
          ) : stock <= LOW_STOCK ? (
            <span className="text-brand-accent">Only {stock} left — order soon</span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <Check className="size-4" /> In stock, ready to ship
            </span>
          )}
        </p>

        {/* Quantity + add */}
        <div className="flex gap-3">
          <div className="flex h-12 items-center rounded-lg border border-border" role="group" aria-label="Quantity">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={soldOut || qty <= 1}
              aria-label="Decrease quantity"
              className="grid size-11 place-items-center disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <output className="w-8 text-center text-sm font-semibold" aria-live="polite">
              {qty}
            </output>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              disabled={soldOut || qty >= maxQty}
              aria-label="Increase quantity"
              className="grid size-11 place-items-center disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <Button
            onClick={add}
            disabled={soldOut}
            className="h-12 flex-1 font-heading text-sm font-bold uppercase tracking-wide"
          >
            {added ? <Check /> : <ShoppingBag />}
            {!variant ? "Unavailable" : soldOut ? "Sold out" : added ? "Added to bag" : "Add to bag"}
          </Button>
        </div>

        {variant && soldOut && <NotifyForm key={variant.id} productId={product.id} variantId={variant.id} />}

        <div className="mt-2 divide-y divide-border border-y border-border">{children}</div>
      </div>
    </div>
  );
}
