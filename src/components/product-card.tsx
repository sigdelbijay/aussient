"use client";

import { useState } from "react";
import { Heart, Plus } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/placeholder-data";

const badgeLabel = {
  new: "New",
  sale: "Sale",
  low: "Low Stock",
} as const;

export function ProductCard({ product }: { product: Product }) {
  const [activeSwatch, setActiveSwatch] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [front, back] = product.images;

  const discount =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round((1 - product.price / product.compareAtPrice) * 100)
      : null;

  return (
    <div className="group/card flex flex-col">
      {/* Image area */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
        {/* Primary image */}
        <div
          className="absolute inset-0 transition-opacity duration-200 ease-snappy group-hover/card:opacity-0"
          style={{ background: front }}
          aria-hidden
        />
        {/* Second photo, revealed on hover */}
        <div
          className="absolute inset-0 scale-105 opacity-0 transition-all duration-200 ease-snappy group-hover/card:scale-100 group-hover/card:opacity-100"
          style={{ background: back }}
          aria-hidden
        />

        {/* Badge */}
        {product.badge && (
          <div className="absolute left-2.5 top-2.5 z-10">
            <Badge variant={product.badge}>
              {product.badge === "sale" && discount ? `-${discount}%` : badgeLabel[product.badge]}
            </Badge>
          </div>
        )}

        {/* Wishlist heart */}
        <button
          type="button"
          onClick={() => setWishlisted((v) => !v)}
          aria-pressed={wishlisted}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute right-2.5 top-2.5 z-10 grid size-9 place-items-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-all duration-200 ease-snappy hover:scale-110 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Heart
            className={cn(
              "size-4 transition-colors duration-200",
              wishlisted && "fill-brand-accent text-brand-accent",
            )}
          />
        </button>

        {/* Quick add — slides up on hover, always reachable via keyboard */}
        <div className="absolute inset-x-2.5 bottom-2.5 z-10 translate-y-[120%] opacity-0 transition-all duration-200 ease-snappy group-hover/card:translate-y-0 group-hover/card:opacity-100 focus-within:translate-y-0 focus-within:opacity-100">
          <Button size="lg" className="w-full font-heading font-bold uppercase">
            <Plus />
            Quick add
          </Button>
        </div>
      </div>

      {/* Details */}
      <div className="mt-3 flex flex-col gap-1.5">
        {/* Swatches */}
        <div className="flex items-center gap-1.5">
          {product.swatches.map((swatch, i) => (
            <button
              key={swatch.name}
              type="button"
              onClick={() => setActiveSwatch(i)}
              aria-label={swatch.name}
              aria-pressed={i === activeSwatch}
              title={swatch.name}
              className={cn(
                "size-4 rounded-full ring-1 ring-inset ring-black/10 transition-transform duration-200 ease-snappy hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === activeSwatch && "ring-2 ring-offset-2 ring-offset-background ring-foreground",
              )}
              style={{ background: swatch.color }}
            />
          ))}
        </div>

        <h3 className="text-sm font-medium leading-snug">{product.name}</h3>
        <p className="text-xs text-muted-foreground">
          {product.swatches[activeSwatch]?.name} · {product.collection}
        </p>

        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-semibold", discount && "text-brand-accent")}>
            {formatPrice(product.price)}
          </span>
          {product.compareAtPrice && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
