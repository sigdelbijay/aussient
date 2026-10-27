import "server-only";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/lib/cache";

/**
 * Adds a paid order to its discount's "times used" count.
 *
 * Call this ONLY once payment is confirmed (from the Stripe webhook, after the
 * order is saved as PAID) — a code typed into the bag, or a checkout that was
 * abandoned, never counts.
 *
 * Safe to call more than once for the same order (Stripe can resend webhooks):
 * the order is marked as counted in the same transaction, so it's only added once.
 */
export async function countDiscountUse(orderId: string): Promise<void> {
  const usedUp = await prisma.$transaction(async (tx) => {
    // Claim the order: only one call can switch discountCountedAt from empty to now.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, discountId: { not: null }, discountCountedAt: null, status: { in: ["PAID", "SHIPPED"] } },
      data: { discountCountedAt: new Date() },
    });
    if (claimed.count === 0) return false; // no discount, not paid, or already counted

    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { discountId: true } });
    const d = await tx.discount.update({
      where: { id: order.discountId! },
      data: { timesUsed: { increment: 1 } },
      select: { timesUsed: true, usageLimit: true },
    });
    return d.usageLimit !== null && d.timesUsed >= d.usageLimit;
  });

  // An automatic offer that just ran out comes off the announcement bar and product badges.
  if (usedUp) revalidateTag(CACHE_TAGS.products, "max");
}
