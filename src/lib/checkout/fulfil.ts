import "server-only";
import { revalidateTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { CACHE_TAGS } from "@/lib/cache";
import type { ItemOption } from "@/lib/orders/format";
import { prisma } from "@/lib/prisma";
import { getCheckoutSession, type CheckoutSessionData } from "@/lib/stripe";

/** One priced line saved when the shopper pressed Checkout. */
export type CheckoutLine = {
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string | null;
  options: ItemOption[];
  unitPrice: number;
  qty: number;
  lineTotal: number;
  image: string | null;
};

/**
 * Makes the order for a paid Stripe Checkout session and returns its id (or
 * null if it isn't paid yet). Called by the Stripe webhook AND the "thank
 * you" page — whichever comes first makes the order; the other finds it.
 * Stripe can also send the same webhook twice: still only one order.
 *
 * Doesn't send emails — call orderPlaced(orderId) afterwards.
 */
export async function fulfilCheckout(stripeSessionId: string): Promise<string | null> {
  const existing = await prisma.order.findUnique({
    where: { stripeSessionId },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Always ask Stripe directly: what it says was paid is the truth.
  const session = await getCheckoutSession(stripeSessionId);
  if (session.payment_status !== "paid") return null;

  const record = await prisma.checkoutSession.findUnique({ where: { stripeSessionId } });
  if (!record) throw new Error(`No checkout saved for Stripe session ${stripeSessionId}`);

  const lines = record.lines as CheckoutLine[];
  const address = shippingAddress(session);
  const email = (session.customer_details?.email ?? record.email ?? "").toLowerCase();
  const paidCents = session.amount_total ?? 0;
  const shippingCents = session.shipping_cost?.amount_total ?? 0;

  // Stripe charged exactly the prices we sent, so this only trips if something is badly wrong.
  const expectedCents =
    Math.round((Number(record.subtotal) - Number(record.discountTotal)) * 100) + shippingCents;
  if (paidCents !== expectedCents) {
    console.error(
      `Order total mismatch for ${stripeSessionId}: paid ${paidCents}, expected ${expectedCents}`,
    );
  }

  const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_number_seq') AS n`;
  const oversold: string[] = [];

  try {
    const order = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          number: `AUS-${n}`,
          userId: record.userId,
          email,
          name: address.fullName || session.customer_details?.name || email,
          phone: session.customer_details?.phone ?? null,
          shippingAddress: address,
          subtotal: record.subtotal,
          discountTotal: record.discountTotal,
          shippingTotal: shippingCents / 100,
          total: paidCents / 100,
          discountId: record.discountId,
          status: "PAID",
          stripeSessionId,
          stripePaymentIntentId: session.payment_intent,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              name: l.name,
              variantName: l.variantName,
              sku: l.sku,
              options: l.options,
              unitPrice: l.unitPrice,
              quantity: l.qty,
              lineTotal: l.lineTotal,
            })),
          },
        },
      });
      await tx.checkoutSession.update({
        where: { id: record.id },
        data: { orderId: order.id, completedAt: new Date() },
      });

      // Take the stock. If two people bought the last one at the same moment,
      // stock stops at 0 and the admin is told (see the activity log).
      for (const l of lines) {
        if (!l.variantId) continue;
        const took = await tx.productVariant.updateMany({
          where: { id: l.variantId, stock: { gte: l.qty } },
          data: { stock: { decrement: l.qty } },
        });
        if (took.count === 0) {
          await tx.productVariant.updateMany({ where: { id: l.variantId }, data: { stock: 0 } });
          oversold.push(`${l.name}${l.sku ? ` (${l.sku})` : ""}`);
        }
      }
      if (oversold.length) {
        await tx.activityLog.create({
          data: {
            action: "order.oversold",
            entity: "Order",
            entityId: order.id,
            detail: { number: order.number, items: oversold },
          },
        });
      }

      // Empty the paid items out of a signed-in shopper's bag.
      if (record.userId) {
        await tx.cartItem.deleteMany({
          where: {
            cart: { userId: record.userId },
            OR: lines.map((l) => ({ productId: l.productId, variantId: l.variantId })),
          },
        });
        await tx.cart.updateMany({
          where: { userId: record.userId },
          data: { discountCode: null },
        });
      }
      return order;
    });

    // Stock changed, so product pages and "only 2 left" badges must refresh.
    revalidateTag(CACHE_TAGS.products, "max");
    return order.id;
  } catch (e) {
    // The webhook and the thank-you page raced, and the other one won: use its order.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const won = await prisma.order.findUnique({
        where: { stripeSessionId },
        select: { id: true },
      });
      if (won) return won.id;
    }
    throw e;
  }
}

/** The delivery address the shopper typed on Stripe's page, in the shape orders keep. */
function shippingAddress(s: CheckoutSessionData) {
  const ship = s.collected_information?.shipping_details ?? s.shipping_details;
  const a = ship?.address;
  return {
    fullName: ship?.name ?? s.customer_details?.name ?? "",
    line1: a?.line1 ?? "",
    line2: a?.line2 ?? null,
    city: a?.city ?? "",
    state: a?.state ?? "",
    postcode: a?.postal_code ?? "",
    country: a?.country === "AU" || !a?.country ? "Australia" : a.country,
    phone: s.customer_details?.phone ?? null,
  };
}
