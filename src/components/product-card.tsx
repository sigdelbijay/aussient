"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { addToBag } from "@/lib/bag-store";
import { formatPrice } from "@/lib/format";
import type { ProductCardData } from "@/lib/storefront";
import { WishlistButton } from "@/components/wishlist-button";
import { useOffers } from "@/components/offers-provider";

const badgeLabel = {
  new: "New",
  sale: "Sale",
  low: "Low Stock",
} as const;

// Card widths: 2-up on phones, ~4-up on desktop rows/grids.
const SIZES = "(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw";

// Every card uses the same 4:5 frame. Photos are fitted whole ("contain") so
// square shots (watches, earrings) and tall ones (clothing) both show fully;
// "multiply" blends white photo backgrounds into the grey frame.
const PHOTO = "object-contain mix-blend-multiply dark:mix-blend-normal";

/** Colour dots shown before "+N". */
const MAX_DOTS = 5;

export function ProductCard({ product }: { product: ProductCardData }) {
  // Open on the colour a filtered listing asks for; otherwise a colour that's
  // on sale (its price is the one shown and sorted by), else the first in stock.
  const [activeSwatch, setActiveSwatch] = useState(() => {
    if (product.startSwatch !== undefined) return product.startSwatch;
    const onSale = product.swatches.findIndex((s) => s.stock > 0 && s.compareAtPrice !== null);
    const inStock = product.swatches.findIndex((s) => s.stock > 0);
    return Math.max(0, onSale >= 0 ? onSale : inStock);
  });
  const [added, setAdded] = useState(false);
  const href = `/products/${product.slug}`;

  // The picked colour decides the photos, price and SALE badge.
  const swatch = product.swatches[activeSwatch];
  const [front, back] = swatch?.images.length ? swatch.images : product.images;
  const badges = product.badges.filter((b) => b !== "sale" || !swatch || swatch.compareAtPrice !== null);
  // An automatic offer covering it (e.g. "Buy 3 get 1"); one is enough on a small card.
  const offer = useOffers(product.id)[0]?.badge;
  const soldOut = product.stock <= 0;
  const swatchSoldOut = swatch ? swatch.stock <= 0 : soldOut;
  // The selected swatch may have its own price.
  const { price, compareAtPrice } = swatch ?? product;
  const fromPrice = swatch ? !swatch.variantId && swatch.priceVaries : product.priceVaries;
  // Quick add needs one exact variant: the only one, or the one the swatch picks.
  // Otherwise (e.g. a T-shirt needing a size) the button opens the product page.
  const variantId = swatch?.variantId ?? product.quickAddVariantId;

  function quickAdd() {
    if (!variantId) return;
    addToBag({
      productId: product.id,
      variantId,
      slug: product.slug,
      name: product.name,
      variantName: swatch?.variantId ? swatch.name : null,
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
    <div className="group/card flex h-full flex-col">
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
              className={cn(PHOTO, "transition-opacity duration-200 ease-snappy group-hover/card:opacity-0")}
            />
          )}
          {/* Second photo, revealed on hover */}
          {back && (
            <Image
              src={back.url}
              alt=""
              fill
              sizes={SIZES}
              className={cn(PHOTO, "scale-105 opacity-0 transition-all duration-200 ease-snappy group-hover/card:scale-100 group-hover/card:opacity-100")}
            />
          )}
        </Link>

        {/* Badges: SALE / offer / LOW STOCK / NEW (or just "Sold out") */}
        {(soldOut || badges.length > 0 || offer) && (
          <div className="absolute left-2.5 top-2.5 z-10 flex flex-col items-start gap-1">
            {soldOut ? (
              <Badge variant="outline">Sold out</Badge>
            ) : (
              <>
                {badges.includes("sale") && <Badge variant="sale">{badgeLabel.sale}</Badge>}
                {offer && <Badge variant="neutral">{offer}</Badge>}
                {badges
                  .filter((b) => b !== "sale")
                  .map((b) => (
                    <Badge key={b} variant={b}>
                      {badgeLabel[b]}
                    </Badge>
                  ))}
              </>
            )}
          </div>
        )}

        <WishlistButton productId={product.id} className="absolute right-2.5 top-2.5 z-10" />

        {/* Quick add — slides up on hover (still reachable by keyboard)… */}
        <div className="absolute inset-x-2.5 bottom-2.5 z-10 hidden translate-y-[120%] opacity-0 transition-all duration-200 ease-snappy group-hover/card:translate-y-0 group-hover/card:opacity-100 focus-within:translate-y-0 focus-within:opacity-100 [@media(hover:hover)]:block">
          {variantId ? (
            <Button
              size="lg"
              onClick={quickAdd}
              disabled={swatchSoldOut}
              className="w-full font-heading font-bold uppercase"
            >
              {added ? <Check /> : <Plus />}
              {swatchSoldOut ? "Sold out" : added ? "Added" : "Quick add"}
            </Button>
          ) : (
            <Link
              href={href}
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full font-heading font-bold uppercase",
              )}
            >
              {soldOut ? "Sold out" : "Choose options"}
            </Link>
          )}
        </div>
        {/* …and is always shown as a round button on touch screens, which can't hover. */}
        {variantId && (
          <button
            type="button"
            onClick={quickAdd}
            disabled={swatchSoldOut}
            aria-label={swatchSoldOut ? `${product.name} is sold out` : `Quick add ${product.name}`}
            className={cn(
              "absolute bottom-2.5 right-2.5 z-10 grid size-9 place-items-center rounded-full shadow-sm transition-colors duration-200 disabled:opacity-50 [@media(hover:hover)]:hidden",
              added
                ? "bg-brand-accent text-brand-accent-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            {added ? <Check className="size-4" /> : <Plus className="size-4" />}
          </button>
        )}
      </div>

      {/* Details — fixed-height rows so every card in a grid lines up. */}
      <div className="mt-3 flex flex-1 flex-col gap-1.5">
        {/* Swatches (always takes its row, even when empty) */}
        <div className="-ml-1 flex h-6 items-center">
          {product.swatches.slice(0, MAX_DOTS).map((swatch, i) => (
            // A 24px button (easy to tap on a phone) around a 16px colour dot.
            <button
              key={swatch.id}
              type="button"
              onClick={() => setActiveSwatch(i)}
              aria-label={swatch.stock > 0 ? swatch.name : `${swatch.name} (sold out)`}
              aria-pressed={i === activeSwatch}
              title={swatch.stock > 0 ? swatch.name : `${swatch.name} — sold out`}
              className="group/dot grid size-6 place-items-center rounded-full focus-visible:outline-none"
            >
              <span
                className={cn(
                  "size-4 rounded-full bg-cover bg-center ring-1 ring-inset ring-black/10 transition-transform duration-200 ease-snappy group-hover/dot:scale-110 group-focus-visible/dot:ring-2 group-focus-visible/dot:ring-ring",
                  i === activeSwatch && "ring-2 ring-offset-2 ring-offset-background ring-foreground",
                  swatch.stock <= 0 && "opacity-40",
                )}
                style={
                  swatch.image
                    ? { backgroundImage: `url("${swatch.image}")` }
                    : { background: swatch.color ?? undefined }
                }
              />
            </button>
          ))}
          {product.swatches.length > MAX_DOTS && (
            <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">
              +{product.swatches.length - MAX_DOTS}
            </Link>
          )}
        </div>

        <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{product.subtitle}</p>
        <h3 className="line-clamp-2 min-h-[2lh] text-sm font-medium leading-snug">
          <Link href={href} className="hover:underline">
            {product.name}
          </Link>
        </h3>

        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-semibold", discount && "text-brand-accent")}>
            {fromPrice && "From "}
            {formatPrice(price)}
          </span>
          {compareAtPrice && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(compareAtPrice)}
            </span>
          )}
        </div>

        {/* "3 colours · More sizes" (like THE ICONIC) */}
        <p className="min-h-[1lh] truncate text-xs text-muted-foreground">{product.hints.join(" · ")}</p>
      </div>
    </div>
  );
}
