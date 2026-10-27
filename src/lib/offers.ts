import "server-only";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/lib/cache";
import { collectionProductIds } from "@/lib/catalog";
import { describeDiscount, discountCovers, offerBadge } from "@/lib/discounts";
import { formatPrice } from "@/lib/format";
import { isLive, rebuildAtNextChange, storefrontCache, type Scheduled } from "@/lib/storefront";

/**
 * Automatic offers (discounts with no code) as shoppers see them: a line in the
 * announcement bar and a badge on every product they cover. The money off is
 * always worked out again by calculateTotals() — this is only for display.
 */

export type Offer = Scheduled & {
  id: string;
  /** Announcement bar text, e.g. "Buy 3, get 1 free on Earrings". */
  text: string;
  /** Card badge, e.g. "Buy 3 get 1". */
  badge: string;
  /** The page listing what it covers, if there is one. */
  link: string | null;
  /** The live products it covers; null = every product. */
  productIds: string[] | null;
};

/** Offers that are switched on and not used up, including ones starting later (cached). */
const getOffers = storefrontCache(
  async (): Promise<Offer[]> => {
    const rows = await prisma.discount.findMany({
      where: { code: null, active: true, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
      orderBy: { createdAt: "asc" },
      include: {
        category: { select: { name: true, slug: true } },
        productType: { select: { name: true } },
        brand: { select: { name: true, slug: true } },
        collection: { select: { name: true, slug: true } },
        products: { select: { id: true } },
      },
    });
    const offers = rows.filter((d) => d.usageLimit === null || d.timesUsed < d.usageLimit);
    if (offers.length === 0) return [];

    // Every live product's facts, to work out which ones each offer covers.
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: { status: "LIVE" },
        select: { id: true, productTypeId: true, brandId: true, categories: { select: { id: true } } },
      }),
      prisma.category.findMany({ select: { id: true, parentId: true } }),
    ]);
    const withParents = (id: string) => {
      const out: string[] = [];
      for (let c = categories.find((x) => x.id === id); c && out.length < 5; c = categories.find((x) => x.id === c!.parentId)) {
        out.push(c.id);
      }
      return out;
    };
    const facts = products.map((p) => ({
      id: p.id,
      productTypeId: p.productTypeId,
      brandId: p.brandId,
      categoryIds: [...new Set(p.categories.flatMap((c) => withParents(c.id)))],
    }));

    return Promise.all(
      offers.map(async (d) => {
        const value = { type: d.type, value: d.value === null ? null : Number(d.value), buyQuantity: d.buyQuantity, getQuantity: d.getQuantity };
        const productIds =
          d.scope === "COLLECTION" ? (d.collectionId ? await collectionProductIds(d.collectionId) : []) : d.products.map((p) => p.id);
        const target = { scope: d.scope, categoryId: d.categoryId, productTypeId: d.productTypeId, brandId: d.brandId, productIds };

        // "on Earrings", "on Coastal Shade", "on T-shirts"…
        const group = d.category?.name ?? d.productType?.name ?? d.brand?.name ?? d.collection?.name ?? (d.scope === "PRODUCTS" ? "selected items" : null);
        const spend = d.minSpend === null ? "" : ` when you spend ${formatPrice(Number(d.minSpend))}`;
        const link = d.category
          ? `/collections/${d.category.slug}`
          : d.brand
            ? `/brands/${d.brand.slug}`
            : d.collection
              ? `/collections/${d.collection.slug}`
              : null;

        return {
          id: d.id,
          text: d.title ?? `${describeDiscount(value)}${group ? ` on ${group}` : ""}${spend}`,
          badge: offerBadge(value),
          link,
          productIds: d.scope === "ALL" ? null : facts.filter((p) => discountCovers(target, p)).map((p) => p.id),
          startsAt: d.startsAt?.toISOString() ?? null,
          endsAt: d.endsAt?.toISOString() ?? null,
        };
      }),
    );
  },
  ["offers"],
  // Discount saves refresh both tags; products/collections changing can change what's covered.
  { tags: [CACHE_TAGS.products] },
);

/** The automatic offers running right now (the page rebuilds when one starts or ends). */
export async function getLiveOffers(): Promise<Offer[]> {
  const now = Date.now();
  const offers = await getOffers();
  await rebuildAtNextChange(offers, now);
  // An offer covering nothing (e.g. an empty collection) isn't worth announcing.
  return offers.filter((o) => isLive(o, now) && (o.productIds === null || o.productIds.length > 0));
}
