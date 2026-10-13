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

/**
 * The top of the product page: gallery + everything needed to buy. Picking a
 * finish swaps the photos, price and stock to that finish.
 */
export function ProductView({
  product,
  children,
}: {
  product: ProductDetail;
  /** Description / details / care / shipping, rendered under the buy box. */
  children: React.ReactNode;
}) {
  const [variantId, setVariantId] = useState(
    () => (product.variants.find((v) => v.stock > 0) ?? product.variants[0])?.id ?? null,
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const price = variant ? variant.price : product.price;
  const salePrice = variant ? variant.salePrice : product.salePrice;
  const onSale = salePrice !== null && salePrice < price;
  const pay = onSale ? salePrice : price;
  const stock = variant ? variant.stock : product.stock;
  const soldOut = stock <= 0;
  const maxQty = Math.max(1, Math.min(stock, MAX_QTY));

  // This finish's own photos first, then the general ones.
  const general = product.media.filter((m) => !m.variantId);
  const own = variant ? product.media.filter((m) => m.variantId === variant.id) : [];
  const media = [...own, ...general];

  function choose(id: string) {
    setVariantId(id);
    setQty(1);
    setAdded(false);
  }

  function add() {
    addToBag(
      {
        productId: product.id,
        variantId: variant?.id ?? null,
        slug: product.slug,
        name: product.name,
        variantName: variant?.name ?? null,
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
        {/* Remount on finish change so the gallery starts at that finish's first photo. */}
        <Gallery key={variantId ?? "all"} media={media} />
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

        {/* Finish / colour */}
        {product.variants.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm">
              <span className="font-semibold">Finish:</span> {variant?.name}
            </legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={v.id === variantId}
                  onClick={() => choose(v.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors duration-200",
                    v.id === variantId
                      ? "border-foreground bg-foreground/5 font-semibold"
                      : "border-border hover:border-foreground/50",
                    v.stock <= 0 && "text-muted-foreground",
                  )}
                >
                  <span
                    className="size-4 rounded-full ring-1 ring-inset ring-black/10"
                    style={{ background: v.color }}
                  />
                  <span className={cn(v.stock <= 0 && "line-through")}>{v.name}</span>
                  {v.stock <= 0 && <span className="sr-only">(sold out)</span>}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {/* Stock */}
        <p className="text-sm font-medium" aria-live="polite">
          {soldOut ? (
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
            {soldOut ? "Sold out" : added ? "Added to bag" : "Add to bag"}
          </Button>
        </div>

        {soldOut && <NotifyForm key={variantId ?? "product"} productId={product.id} variantId={variantId} />}

        <div className="mt-2 divide-y divide-border border-y border-border">{children}</div>
      </div>
    </div>
  );
}
