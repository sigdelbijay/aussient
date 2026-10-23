"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus, Ruler, ShoppingBag, X } from "lucide-react";
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
type Option = Detail["options"][number];

/** The first variant in stock (or just the first) — what the page starts on. */
const startVariant = (p: Detail) => p.variants.find((v) => v.stock > 0) ?? p.variants[0];

/**
 * The top of the product page: gallery + everything needed to buy. Shoppers
 * pick a value for each option (e.g. Size, then Colour); that picks one
 * variant, whose photos, price and stock are shown.
 */
export function ProductView({
  product,
  sizeGuide,
  children,
}: {
  product: ProductDetail;
  /** The product type's size guide table, shown in a pop-up. */
  sizeGuide?: React.ReactNode;
  /** Description / specifications / delivery / returns, rendered under the buy box. */
  children: React.ReactNode;
}) {
  // The chosen value id for each option slot (option1/2/3).
  const [picked, setPicked] = useState<(string | null)[]>(() => startVariant(product).optionIds);
  const guide = useRef<HTMLDialogElement>(null);

  // A shared link like ?variant=… opens on that variant. (Read after loading so
  // the page itself can stay a fast, pre-built static page.)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("variant");
    const v = product.variants.find((x) => x.id === id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the URL once on load
    if (v) setPicked(v.optionIds);
  }, [product.variants]);
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
    // Remember the choice in the URL (shareable; no page reload).
    const chosen = product.variants.find((v) => matches(v, next));
    const url = new URL(window.location.href);
    if (chosen && product.variants.length > 1) url.searchParams.set("variant", chosen.id);
    else url.searchParams.delete("variant");
    window.history.replaceState(null, "", url);
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
          {product.brand && (
            <Link
              href={`/brands/${product.brand.slug}`}
              className="mb-1 inline-block text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              {product.brand.name}
            </Link>
          )}
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

        {/* Options: colour swatches, size buttons, or a dropdown */}
        {product.options.map((option) => {
          const chosen = option.values.find((v) => v.id === picked[option.slot]);
          // The size guide link sits by the first button-style option (usually Size).
          const showGuide = !!sizeGuide && option === (product.options.find((o) => o.display === "button") ?? product.options[0]);
          return (
            <fieldset key={option.name}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <legend className="text-sm">
                  <span className="font-semibold">{option.name}:</span> {chosen?.value ?? "Choose"}
                </legend>
                {showGuide && <SizeGuideButton onClick={() => guide.current?.showModal()} />}
              </div>
              <OptionPicker
                option={option}
                chosenId={picked[option.slot]}
                available={(id) => inStock(option.slot, id)}
                onChoose={(id) => choose(option.slot, id)}
              />
            </fieldset>
          );
        })}
        {sizeGuide && product.options.length === 0 && (
          <SizeGuideButton onClick={() => guide.current?.showModal()} />
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

      {sizeGuide && (
        <dialog
          ref={guide}
          aria-labelledby="size-guide-title"
          // Clicking the dark backdrop (outside the box) closes it.
          onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
          className="m-auto w-[min(40rem,calc(100%-2rem))] rounded-xl bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50"
        >
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 id="size-guide-title" className="font-heading text-lg font-extrabold uppercase">
                Size guide
              </h2>
              <button
                type="button"
                onClick={() => guide.current?.close()}
                aria-label="Close size guide"
                className="grid size-9 place-items-center rounded-full hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>
            {sizeGuide}
          </div>
        </dialog>
      )}
    </div>
  );
}

function SizeGuideButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-fit items-center gap-1.5 text-sm underline underline-offset-2 hover:text-brand-accent"
    >
      <Ruler className="size-4" /> Size guide
    </button>
  );
}

/** Choosing one option's value, shaped to suit the option. */
function OptionPicker({
  option,
  chosenId,
  available,
  onChoose,
}: {
  option: Option;
  chosenId: string | null;
  available: (valueId: string) => boolean;
  onChoose: (valueId: string) => void;
}) {
  // Dropdown: for options with long names, e.g. "Pack of 3".
  if (option.display === "select") {
    return (
      <select
        aria-label={option.name}
        value={chosenId ?? ""}
        onChange={(e) => onChoose(e.target.value)}
        className="h-12 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium"
      >
        {option.values.map((v) => (
          <option key={v.id} value={v.id}>
            {v.value}
            {!available(v.id) && " — sold out"}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={option.name}>
      {option.values.map((v) => {
        const isChosen = v.id === chosenId;
        const soldOut = !available(v.id);
        const label = soldOut ? `${v.value} (sold out)` : v.value;

        // Colour swatches: round, with a slash through sold-out colours.
        if (option.display === "swatch") {
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={isChosen}
              aria-label={label}
              title={label}
              onClick={() => onChoose(v.id)}
              className={cn(
                "relative grid size-10 place-items-center overflow-hidden rounded-full transition-shadow duration-200",
                isChosen ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "hover:ring-1 hover:ring-foreground/40 hover:ring-offset-2",
              )}
            >
              <span
                className={cn("size-8 rounded-full bg-cover bg-center ring-1 ring-inset ring-black/15", soldOut && "opacity-40")}
                style={v.image ? { backgroundImage: `url("${v.image}")` } : { background: v.color ?? undefined }}
              />
              {soldOut && <Slash />}
            </button>
          );
        }

        // Size buttons: sold-out sizes greyed out and crossed through.
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={isChosen}
            aria-label={label}
            onClick={() => onChoose(v.id)}
            className={cn(
              "relative h-11 min-w-12 overflow-hidden rounded-md border px-3 text-sm font-medium transition-colors duration-200",
              isChosen
                ? "border-foreground bg-foreground text-background"
                : soldOut
                  ? "border-border bg-muted text-muted-foreground"
                  : "border-border hover:border-foreground",
            )}
          >
            {v.value}
            {soldOut && <Slash />}
          </button>
        );
      })}
    </div>
  );
}

/** A diagonal line across a sold-out choice. */
function Slash() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top_right,transparent_calc(50%-0.5px),currentColor,transparent_calc(50%+0.5px))] opacity-60"
    />
  );
}
