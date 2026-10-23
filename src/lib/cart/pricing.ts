import { MAX_QTY } from "@/lib/catalog-shared";
import { formatPrice } from "@/lib/format";

/**
 * The pricing rules for a bag: line prices, the best discount, shipping and
 * the total. Pure (no database), so it can be unit-tested — the server loads
 * the data and calls this through calculateTotals() in ./totals.ts.
 *
 * All maths is done in whole cents to avoid floating-point drift.
 */

// ── Inputs ──────────────────────────────────────────────────────

/**
 * What a bag stores: a product variant and how many. Never prices.
 * variantId can be null in bags saved before every product had variants —
 * it then means the product's only variant.
 */
export type BagItem = { productId: string; variantId: string | null; qty: number };

export type PricingProduct = {
  id: string;
  slug: string;
  name: string;
  /** False when the product has been taken off sale (DRAFT). */
  live: boolean;
  /** Its categories and every category above them (for category discounts). */
  categoryIds: string[];
  image: string | null;
  /** Every buyable combination — always at least one. Works the same for any product type. */
  variants: {
    id: string;
    /** e.g. "M / Navy"; null for a product with no options. */
    label: string | null;
    price: number;
    salePrice: number | null;
    stock: number;
    image: string | null;
  }[];
};

export type PricingDiscount = {
  id: string;
  /** null = automatic offer (no code needed). */
  code: string | null;
  type: "PERCENT" | "AMOUNT" | "FREE_SHIPPING" | "BUY_X_GET_Y";
  scope: "ALL" | "CATEGORY" | "PRODUCTS";
  value: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  minSpend: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  timesUsed: number;
  perCustomerLimit: number | null;
  firstOrderOnly: boolean;
  active: boolean;
  categoryId: string | null;
  productIds: string[];
};

export type PricingCustomer = {
  /** Past orders; null when we don't know who it is yet (guest before checkout). */
  orderCount: number | null;
  /** How many times this customer has used each discount, by discount id. */
  discountUses: Record<string, number>;
};

export type PricingInput = {
  items: BagItem[];
  /** Discount code the shopper entered, if any. */
  code: string | null;
  products: PricingProduct[];
  /** Automatic offers plus the discount matching `code` (if it exists). */
  discounts: PricingDiscount[];
  shipping: { freeShippingThreshold: number | null; flatShippingRate: number | null };
  customer: PricingCustomer;
  now: Date;
};

// ── Output ──────────────────────────────────────────────────────

export type LineIssue =
  | "sold-out" // none left — not counted in the total
  | "unavailable" // product/variant no longer sold — not counted
  | "reduced"; // fewer left than asked for — quantity lowered

export type BagLine = {
  key: string;
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  image: string | null;
  unitPrice: number;
  /** Original price, when the item is on sale. */
  compareAtPrice: number | null;
  qty: number;
  lineTotal: number;
  /** Most that can be ordered (stock, capped at MAX_QTY). */
  maxQty: number;
  issue: LineIssue | null;
};

export type AppliedDiscount = {
  id: string;
  code: string | null;
  label: string;
  /** Money off the items. */
  amount: number;
  freeShipping: boolean;
};

export type Totals = {
  lines: BagLine[];
  itemCount: number;
  /** Items at the prices shown (sale prices included), before discounts. */
  subtotal: number;
  discount: AppliedDiscount | null;
  /** The code the shopper entered and, if it can't be used, why. */
  code: { code: string; error: string | null; /** False when no such code exists (so don't save it). */ recognised: boolean } | null;
  shipping: number;
  freeShippingThreshold: number | null;
  /** How much more to spend for free shipping (0 = already free; null = no free-shipping offer). */
  freeShippingRemaining: number | null;
  /** Sale savings + discount + any shipping saved by a free-shipping code. */
  savings: number;
  total: number;
  /** False when the bag is empty or has sold-out/unavailable items to remove first. */
  canCheckout: boolean;
};

// ── Helpers ─────────────────────────────────────────────────────

const cents = (dollars: number) => Math.round(dollars * 100);
const dollars = (c: number) => c / 100;
export const lineKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? ""}`;
export const normalizeCode = (code: string) => code.trim().toUpperCase().slice(0, 40);

/** Combines repeated lines for the same product + variant and keeps quantities sensible. */
export function tidyItems(items: BagItem[]): BagItem[] {
  const merged = new Map<string, BagItem>();
  for (const item of items) {
    const qty = Math.floor(item.qty);
    if (!Number.isFinite(qty) || qty < 1) continue;
    const key = lineKey(item.productId, item.variantId);
    const prev = merged.get(key);
    merged.set(key, { ...item, qty: Math.min(MAX_QTY, (prev?.qty ?? 0) + qty) });
  }
  return [...merged.values()];
}

function label(d: PricingDiscount) {
  const what = (() => {
    switch (d.type) {
      case "PERCENT":
        return `${d.value ?? 0}% off`;
      case "AMOUNT":
        return `${formatPrice(d.value ?? 0)} off`;
      case "FREE_SHIPPING":
        return "Free shipping";
      case "BUY_X_GET_Y":
        return `Buy ${d.buyQuantity ?? 1}, get ${d.getQuantity ?? 1} free`;
    }
  })();
  return d.code ? `${d.code} · ${what}` : what;
}

type Counted = { productId: string; categoryIds: string[]; unitCents: number; qty: number };

/** Works out a discount on the counted lines, or says why it can't be used. */
function evaluate(
  d: PricingDiscount,
  lines: Counted[],
  subtotalCents: number,
  customer: PricingCustomer,
  now: Date,
): { amountCents: number; freeShipping: boolean } | { error: string } {
  if (!d.active) return { error: "This code isn't valid." };
  if (d.startsAt && d.startsAt > now) return { error: "This code isn't active yet." };
  if (d.endsAt && d.endsAt <= now) return { error: "This code has expired." };
  if (d.usageLimit !== null && d.timesUsed >= d.usageLimit) {
    return { error: "This code has been fully redeemed." };
  }
  if (d.firstOrderOnly && customer.orderCount !== null && customer.orderCount > 0) {
    return { error: "This code is for first orders only." };
  }
  if (d.perCustomerLimit !== null && (customer.discountUses[d.id] ?? 0) >= d.perCustomerLimit) {
    return { error: "You've already used this code." };
  }
  if (d.minSpend !== null && subtotalCents < cents(d.minSpend)) {
    return { error: `Spend ${formatPrice(d.minSpend)} or more to use this code.` };
  }

  const eligible = lines.filter((l) =>
    d.scope === "CATEGORY"
      ? d.categoryId !== null && l.categoryIds.includes(d.categoryId)
      : d.scope === "PRODUCTS"
        ? d.productIds.includes(l.productId)
        : true,
  );
  if (eligible.length === 0) return { error: "This code doesn't apply to the items in your bag." };
  const eligibleCents = eligible.reduce((n, l) => n + l.unitCents * l.qty, 0);

  switch (d.type) {
    case "PERCENT": {
      const pct = Math.min(100, Math.max(0, d.value ?? 0));
      return { amountCents: Math.round((eligibleCents * pct) / 100), freeShipping: false };
    }
    case "AMOUNT":
      return { amountCents: Math.min(cents(d.value ?? 0), eligibleCents), freeShipping: false };
    case "FREE_SHIPPING":
      return { amountCents: 0, freeShipping: true };
    case "BUY_X_GET_Y": {
      // For every X + Y eligible items, the cheapest Y are free.
      const buy = Math.max(1, d.buyQuantity ?? 1);
      const get = Math.max(1, d.getQuantity ?? 1);
      const units = eligible.flatMap((l) => Array<number>(l.qty).fill(l.unitCents)).sort((a, b) => a - b);
      const free = Math.floor(units.length / (buy + get)) * get;
      if (free === 0) {
        const more = buy + get - units.length;
        return { error: `Add ${more} more eligible ${more === 1 ? "item" : "items"} to use this offer.` };
      }
      return { amountCents: units.slice(0, free).reduce((a, b) => a + b, 0), freeShipping: false };
    }
  }
}

// ── The calculation ─────────────────────────────────────────────

export function priceBag(input: PricingInput): Totals {
  const products = new Map(input.products.map((p) => [p.id, p]));

  // Old bags may say "no variant" for a product with just one: use that one.
  const resolved = input.items.map((item) => {
    const p = products.get(item.productId);
    return !item.variantId && p?.variants.length === 1 ? { ...item, variantId: p.variants[0].id } : item;
  });

  // 1. Lines at today's prices and stock.
  const lines: BagLine[] = [];
  for (const item of tidyItems(resolved)) {
    const p = products.get(item.productId);
    if (!p) continue; // deleted product — drop it quietly

    // The exact variant must still exist (e.g. not deleted, and not a missing combination).
    const variant = item.variantId ? p.variants.find((v) => v.id === item.variantId) : undefined;
    const valid = p.live && !!variant;

    const price = variant?.price ?? 0;
    const sale = variant?.salePrice ?? null;
    const onSale = sale !== null && sale < price;
    const unitPrice = onSale ? sale : price;
    const stock = variant?.stock ?? 0;
    const maxQty = Math.max(0, Math.min(stock, MAX_QTY));

    let qty = item.qty;
    let issue: LineIssue | null = null;
    if (!valid) issue = "unavailable";
    else if (stock <= 0) issue = "sold-out";
    else if (qty > maxQty) {
      qty = maxQty;
      issue = "reduced";
    }
    const counted = issue === null || issue === "reduced";

    lines.push({
      key: lineKey(item.productId, item.variantId),
      productId: p.id,
      variantId: item.variantId,
      slug: p.slug,
      name: p.name,
      variantName: variant?.label ?? null,
      image: variant?.image ?? p.image,
      unitPrice,
      compareAtPrice: onSale ? price : null,
      qty,
      lineTotal: counted ? dollars(cents(unitPrice) * qty) : 0,
      maxQty,
      issue,
    });
  }

  const counted: Counted[] = lines
    .filter((l) => l.issue === null || l.issue === "reduced")
    .map((l) => ({
      productId: l.productId,
      categoryIds: products.get(l.productId)!.categoryIds,
      unitCents: cents(l.unitPrice),
      qty: l.qty,
    }));
  const subtotalCents = counted.reduce((n, l) => n + l.unitCents * l.qty, 0);
  const saleSavingsCents = lines
    .filter((l) => l.lineTotal > 0 && l.compareAtPrice !== null)
    .reduce((n, l) => n + (cents(l.compareAtPrice!) - cents(l.unitPrice)) * l.qty, 0);

  // 2. Shipping before any discount, used to value free-shipping offers.
  const { freeShippingThreshold: threshold, flatShippingRate: flat } = input.shipping;
  const shippingFor = (merchCents: number) =>
    counted.length === 0 || (threshold !== null && merchCents >= cents(threshold)) ? 0 : cents(flat ?? 0);

  // 3. Best discount: the entered code or an automatic offer, whichever saves more.
  const code = input.code ? normalizeCode(input.code) : null;
  type Option = { d: PricingDiscount; amountCents: number; freeShipping: boolean; value: number };
  const options: Option[] = [];
  let codeError: string | null = null;

  const codeDiscount = code
    ? input.discounts.find((x) => x.code !== null && normalizeCode(x.code) === code)
    : undefined;
  if (code) {
    const d = codeDiscount;
    if (!d) codeError = "We don't recognise that code.";
    else if (counted.length > 0) {
      const r = evaluate(d, counted, subtotalCents, input.customer, input.now);
      if ("error" in r) codeError = r.error;
      else options.push({ d, ...r, value: r.amountCents + (r.freeShipping ? shippingFor(subtotalCents) : 0) });
    }
  }
  for (const d of input.discounts.filter((x) => x.code === null)) {
    if (counted.length === 0) break;
    const r = evaluate(d, counted, subtotalCents, input.customer, input.now);
    if ("error" in r) continue;
    const value = r.amountCents + (r.freeShipping ? shippingFor(subtotalCents) : 0);
    if (value > 0) options.push({ d, ...r, value });
  }

  // On a tie, prefer the shopper's own code.
  const best =
    options.sort((a, b) => b.value - a.value || Number(!!b.d.code) - Number(!!a.d.code))[0] ?? null;
  if (code && !codeError && best && best.d.code === null) {
    codeError = "A better offer is already applied to your bag.";
  }

  // 4. Shipping and total.
  const discountCents = best?.amountCents ?? 0;
  const merchCents = subtotalCents - discountCents;
  const shippingCents = best?.freeShipping ? 0 : shippingFor(merchCents);
  const shippingSavedCents = best?.freeShipping ? shippingFor(subtotalCents) : 0;
  // Free shipping is judged on what's paid for the items, after discounts.
  const freeShippingRemaining = best?.freeShipping
    ? 0
    : threshold === null
      ? null
      : dollars(Math.max(0, cents(threshold) - merchCents));

  return {
    lines,
    itemCount: lines.reduce((n, l) => n + l.qty, 0),
    subtotal: dollars(subtotalCents),
    discount: best
      ? {
          id: best.d.id,
          code: best.d.code,
          label: label(best.d),
          amount: dollars(discountCents),
          freeShipping: best.freeShipping,
        }
      : null,
    code: code ? { code, error: codeError, recognised: !!codeDiscount } : null,
    shipping: dollars(shippingCents),
    freeShippingThreshold: threshold,
    freeShippingRemaining,
    savings: dollars(saleSavingsCents + discountCents + shippingSavedCents),
    total: dollars(merchCents + shippingCents),
    canCheckout: counted.length > 0 && lines.every((l) => l.issue === null || l.issue === "reduced"),
  };
}
