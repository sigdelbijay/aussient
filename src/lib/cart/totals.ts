import "server-only";
import { collectionProductIds } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { variantLabel } from "@/lib/product-types";
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

const firstImage = { where: { type: "IMAGE" as const }, orderBy: { order: "asc" as const }, take: 1, select: { url: true } };
const optionValue = { select: { value: true, media: firstImage } };

async function loadProducts(ids: string[]): Promise<PricingProduct[]> {
  const [rows, categories] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids } },
      include: {
        categories: { select: { id: true } },
        media: { ...firstImage, where: { ...firstImage.where, optionValueId: null } },
        variants: { include: { option1: optionValue, option2: optionValue, option3: optionValue } },
      },
    }),
    prisma.category.findMany({ select: { id: true, parentId: true } }),
  ]);

  /** A category and the ones above it, e.g. Dresses → [Dresses, Clothing, Women]. */
  const withParents = (id: string) => {
    const out: string[] = [];
    for (let c = categories.find((x) => x.id === id); c && out.length < 5; c = categories.find((x) => x.id === c!.parentId)) {
      out.push(c.id);
    }
    return out;
  };

  const money = (d: { toString(): string } | null) => (d === null ? null : Number(d));
  return rows.map((p) => {
    const image = p.media[0]?.url ?? null;
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      live: p.status === "LIVE",
      productTypeId: p.productTypeId,
      brandId: p.brandId,
      categoryIds: [...new Set(p.categories.flatMap((c) => withParents(c.id)))],
      image,
      variants: p.variants.map((v) => {
        const values = [v.option1, v.option2, v.option3];
        return {
          id: v.id,
          label: variantLabel(values.map((o) => o?.value)),
          price: Number(v.price),
          salePrice: money(v.salePrice),
          stock: v.stock,
          // A photo of one of its option values (e.g. the Navy photo), else the main photo.
          image: values.map((o) => o?.media[0]?.url).find(Boolean) ?? image,
        };
      }),
    };
  });
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
  // A collection discount covers whatever is in the collection right now.
  const inCollection = new Map(
    await Promise.all(
      [...new Set(rows.flatMap((d) => (d.scope === "COLLECTION" && d.collectionId ? [d.collectionId] : [])))].map(
        async (cid) => [cid, await collectionProductIds(cid)] as const,
      ),
    ),
  );
  return rows.map((d) => ({
    id: d.id,
    code: d.code,
    title: d.title,
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
    productTypeId: d.productTypeId,
    brandId: d.brandId,
    productIds:
      d.scope === "COLLECTION" ? (d.collectionId ? (inCollection.get(d.collectionId) ?? []) : []) : d.products.map((p) => p.id),
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
