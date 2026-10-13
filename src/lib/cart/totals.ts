import "server-only";
import { prisma } from "@/lib/prisma";
import {
  normalizeCode,
  priceBag,
  type BagItem,
  type PricingCustomer,
  type PricingDiscount,
  type PricingProduct,
  type Totals,
} from "./pricing";

/**
 * THE price calculation for the shop. The bag, the cart page and checkout all
 * call this — never trust prices sent from the browser. It always reads live
 * prices, stock, discounts and shipping settings from the database (no cache).
 */
export async function calculateTotals(
  items: BagItem[],
  {
    code = null,
    customer = null,
  }: {
    code?: string | null;
    /** The signed-in shopper, or the email entered at checkout. */
    customer?: { userId?: string | null; email?: string | null } | null;
  } = {},
): Promise<Totals> {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const normalized = code ? normalizeCode(code) : null;

  const [products, discounts, settings, history] = await Promise.all([
    productIds.length ? loadProducts(productIds) : [],
    loadDiscounts(normalized),
    prisma.siteSettings.findUnique({
      where: { id: "singleton" },
      select: { freeShippingThreshold: true, flatShippingRate: true },
    }),
    loadCustomer(customer),
  ]);

  return priceBag({
    items,
    code: normalized,
    products,
    discounts,
    shipping: {
      freeShippingThreshold:
        settings?.freeShippingThreshold == null ? null : Number(settings.freeShippingThreshold),
      flatShippingRate: settings?.flatShippingRate == null ? null : Number(settings.flatShippingRate),
    },
    customer: history,
    now: new Date(),
  });
}

const firstImage = { where: { type: "IMAGE" as const }, orderBy: { order: "asc" as const }, take: 1 };

async function loadProducts(ids: string[]): Promise<PricingProduct[]> {
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: {
      media: { ...firstImage, where: { ...firstImage.where, variantId: null } },
      variants: { include: { media: firstImage } },
    },
  });
  const money = (d: { toString(): string } | null) => (d === null ? null : Number(d));
  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    live: p.status === "LIVE",
    categoryId: p.categoryId,
    price: Number(p.price),
    salePrice: money(p.salePrice),
    stock: p.stock,
    image: p.media[0]?.url ?? null,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: money(v.price),
      salePrice: money(v.salePrice),
      stock: v.stock,
      image: v.media[0]?.url ?? null,
    })),
  }));
}

/** Automatic offers, plus the discount for the entered code. Dates are checked in priceBag. */
async function loadDiscounts(code: string | null): Promise<PricingDiscount[]> {
  const rows = await prisma.discount.findMany({
    where: {
      OR: [
        { code: null, active: true },
        ...(code ? [{ code: { equals: code, mode: "insensitive" as const } }] : []),
      ],
    },
    include: { products: { select: { id: true } } },
  });
  return rows.map((d) => ({
    id: d.id,
    code: d.code,
    type: d.type,
    scope: d.scope,
    value: d.value === null ? null : Number(d.value),
    buyQuantity: d.buyQuantity,
    getQuantity: d.getQuantity,
    minSpend: d.minSpend === null ? null : Number(d.minSpend),
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    usageLimit: d.usageLimit,
    timesUsed: d.timesUsed,
    perCustomerLimit: d.perCustomerLimit,
    firstOrderOnly: d.firstOrderOnly,
    active: d.active,
    categoryId: d.categoryId,
    productIds: d.products.map((p) => p.id),
  }));
}

/** Past orders, for first-order-only and once-per-customer codes. */
async function loadCustomer(
  customer: { userId?: string | null; email?: string | null } | null,
): Promise<PricingCustomer> {
  const or = [
    ...(customer?.userId ? [{ userId: customer.userId }] : []),
    ...(customer?.email ? [{ email: customer.email.toLowerCase() }] : []),
  ];
  if (or.length === 0) return { orderCount: null, discountUses: {} };

  const orders = await prisma.order.findMany({
    where: { OR: or, status: { in: ["PAID", "SHIPPED"] } },
    select: { discountId: true },
  });
  const discountUses: Record<string, number> = {};
  for (const o of orders) if (o.discountId) discountUses[o.discountId] = (discountUses[o.discountId] ?? 0) + 1;
  return { orderCount: orders.length, discountUses };
}
