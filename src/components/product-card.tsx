"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addToBag } from "@/lib/bag-store";
import { formatPrice } from "@/lib/format";
import type { ProductCardData } from "@/lib/storefront";
import { WishlistButton } from "@/components/wishlist-button";

const badgeLabel = {
  new: "New",
  sale: "Sale",
  low: "Low Stock",
} as const;

// Card widths: 2-up on phones, ~4-up on desktop rows/grids.
const SIZES = "(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw";

export function ProductCard({ product }: { product: ProductCardData }) {
  // Start on the first finish that's in stock.
  const [activeSwatch, setActiveSwatch] = useState(() =>
    Math.max(0, product.swatches.findIndex((s) => s.stock > 0)),
  );
  const [added, setAdded] = useState(false);
  const [front, back] = product.images;
  const href = `/products/${product.slug}`;

  const swatch = product.swatches[activeSwatch];
  const soldOut = product.stock <= 0;
  const swatchSoldOut = swatch ? swatch.stock <= 0 : soldOut;
  // The selected finish may have its own price.
  const { price, compareAtPrice } = swatch ?? product;

  function quickAdd() {
    addToBag({
      productId: product.id,
      variantId: swatch?.id ?? null,
      slug: product.slug,
      name: product.name,
      variantName: swatch?.name ?? null,
      price,
      compareAtPrice,
      image: front?.url ?? null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  const discount =
    compareAtPrice && compareAtPrice > price
      ? Math.round((1 - price / compareAtPrice) * 100)
      : null;

  return (
    <div className="group/card flex flex-col">
      {/* Image area */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
        <Link href={href} className="absolute inset-0" aria-label={product.name}>
          {/* Primary image */}
          {front && (
            <Image
              src={front.url}
              alt={front.alt}
              fill
              sizes={SIZES}
              className="object-cover transition-opacity duration-200 ease-snappy group-hover/card:opacity-0"
            />
          )}
          {/* Second photo, revealed on hover */}
          {back && (
            <Image
              src={back.url}
              alt=""
              fill
              sizes={SIZES}
              className="scale-105 object-cover opacity-0 transition-all duration-200 ease-snappy group-hover/card:scale-100 group-hover/card:opacity-100"
            />
          )}
        </Link>

        {/* Badges: SALE / LOW STOCK / NEW (or just "Sold out") */}
        {(soldOut || product.badges.length > 0) && (
          <div className="absolute left-2.5 top-2.5 z-10 flex flex-col items-start gap-1">
            {soldOut ? (
              <Badge variant="outline">Sold out</Badge>
            ) : (
              product.badges.map((b) => (
                <Badge key={b} variant={b}>
                  {badgeLabel[b]}
                </Badge>
              ))
            )}
          </div>
        )}

        <WishlistButton productId={product.id} className="absolute right-2.5 top-2.5 z-10" />

        {/* Quick add — slides up on hover (still reachable by keyboard)… */}
        <div className="absolute inset-x-2.5 bottom-2.5 z-10 hidden translate-y-[120%] opacity-0 transition-all duration-200 ease-snappy group-hover/card:translate-y-0 group-hover/card:opacity-100 focus-within:translate-y-0 focus-within:opacity-100 [@media(hover:hover)]:block">
          <Button
            size="lg"
            onClick={quickAdd}
            disabled={swatchSoldOut}
            className="w-full font-heading font-bold uppercase"
          >
            {added ? <Check /> : <Plus />}
            {swatchSoldOut ? "Sold out" : added ? "Added" : "Quick add"}
          </Button>
        </div>
        {/* …and is always shown as a round button on touch screens, which can't hover. */}
        <button
          type="button"
          onClick={quickAdd}
          disabled={swatchSoldOut}
          aria-label={swatchSoldOut ? `${product.name} is sold out` : `Quick add ${product.name}`}
          className={cn(
            "absolute bottom-2.5 right-2.5 z-10 grid size-9 place-items-center rounded-full shadow-sm transition-colors duration-200 disabled:opacity-50 [@media(hover:hover)]:hidden",
            added ? "bg-brand-accent text-brand-accent-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {added ? <Check className="size-4" /> : <Plus className="size-4" />}
        </button>
      </div>

      {/* Details */}
      <div className="mt-3 flex flex-col gap-1.5">
        {/* Swatches */}
        <div className="flex items-center gap-1.5">
          {product.swatches.map((swatch, i) => (
            <button
              key={swatch.id}
              type="button"
              onClick={() => setActiveSwatch(i)}
              aria-label={swatch.stock > 0 ? swatch.name : `${swatch.name} (sold out)`}
              aria-pressed={i === activeSwatch}
              title={swatch.stock > 0 ? swatch.name : `${swatch.name} — sold out`}
              className={cn(
                "size-4 rounded-full ring-1 ring-inset ring-black/10 transition-transform duration-200 ease-snappy hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === activeSwatch && "ring-2 ring-offset-2 ring-offset-background ring-foreground",
                swatch.stock <= 0 && "opacity-40",
              )}
              style={{ background: swatch.color }}
            />
          ))}
        </div>

        <h3 className="text-sm font-medium leading-snug">
          <Link href={href} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="text-xs text-muted-foreground">
          {[product.swatches[activeSwatch]?.name, product.collection].filter(Boolean).join(" · ")}
        </p>

        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-semibold", discount && "text-brand-accent")}>
            {formatPrice(price)}
          </span>
          {compareAtPrice && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
