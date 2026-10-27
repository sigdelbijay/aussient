import { formatPrice } from "@/lib/format";

/**
 * Small discount helpers shared by the bag maths, the shop (offer badges) and
 * the admin list. Pure functions, safe to use anywhere.
 */

export type DiscountType = "PERCENT" | "AMOUNT" | "FREE_SHIPPING" | "BUY_X_GET_Y";
export type DiscountScope = "ALL" | "CATEGORY" | "PRODUCT_TYPE" | "BRAND" | "COLLECTION" | "PRODUCTS";

export const DISCOUNT_TYPES: Record<DiscountType, string> = {
  PERCENT: "Percent off",
  AMOUNT: "Dollar amount off",
  FREE_SHIPPING: "Free shipping",
  BUY_X_GET_Y: "Buy X get Y free",
};

export const DISCOUNT_SCOPES: Record<DiscountScope, string> = {
  ALL: "Whole store",
  CATEGORY: "A category",
  PRODUCT_TYPE: "A product type",
  BRAND: "A brand",
  COLLECTION: "A collection",
  PRODUCTS: "Chosen products",
};

/** Which products a discount covers. productIds is filled for PRODUCTS and COLLECTION. */
export type DiscountTarget = {
  scope: DiscountScope;
  categoryId: string | null;
  productTypeId: string | null;
  brandId: string | null;
  productIds: string[];
};

/** The facts about a product that decide whether a discount covers it. */
export type DiscountableProduct = {
  id: string;
  /** Its categories and every category above them. */
  categoryIds: string[];
  productTypeId: string;
  brandId: string | null;
};

export function discountCovers(d: DiscountTarget, p: DiscountableProduct): boolean {
  switch (d.scope) {
    case "ALL":
      return true;
    case "CATEGORY":
      return d.categoryId !== null && p.categoryIds.includes(d.categoryId);
    case "PRODUCT_TYPE":
      return d.productTypeId === p.productTypeId;
    case "BRAND":
      return d.brandId !== null && d.brandId === p.brandId;
    case "COLLECTION":
    case "PRODUCTS":
      return d.productIds.includes(p.id);
  }
}

type Describable = {
  type: DiscountType;
  value: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
};

/** "20% off", "$10.00 off", "Free shipping", "Buy 3, get 1 free". */
export function describeDiscount(d: Describable) {
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
}

/** Short text for the badge on product cards, e.g. "20% OFF", "BUY 3 GET 1". */
export function offerBadge(d: Describable) {
  switch (d.type) {
    case "PERCENT":
      return `${d.value ?? 0}% off`;
    case "AMOUNT":
      return `$${d.value ?? 0} off`;
    case "FREE_SHIPPING":
      return "Free shipping";
    case "BUY_X_GET_Y":
      return `Buy ${d.buyQuantity ?? 1} get ${d.getQuantity ?? 1}`;
  }
}

export type DiscountStatus = "off" | "scheduled" | "active" | "expired" | "used-up";

export const STATUS_LABELS: Record<DiscountStatus, string> = {
  off: "Off",
  scheduled: "Scheduled",
  active: "Active",
  expired: "Expired",
  "used-up": "Used up",
};

/** Where a discount is in its life right now. */
export function discountStatus(
  d: { active: boolean; startsAt: Date | null; endsAt: Date | null; usageLimit: number | null; timesUsed: number },
  now: Date,
): DiscountStatus {
  if (d.endsAt && d.endsAt <= now) return "expired";
  if (!d.active) return "off";
  if (d.usageLimit !== null && d.timesUsed >= d.usageLimit) return "used-up";
  if (d.startsAt && d.startsAt > now) return "scheduled";
  return "active";
}
