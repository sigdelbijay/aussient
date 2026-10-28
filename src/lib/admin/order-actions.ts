"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/format";
import { cleanTrackingUrl } from "@/lib/orders/format";
import { sendRefundEmail, sendShippedEmail } from "@/lib/orders/emails";
import { StripeError, refundInFull } from "@/lib/stripe";
import { recordChange } from "./activity";
import { fieldErrors, type AdminFormState } from "./form";

/**
 * What staff can do to an order:
 *   - Mark as shipped (STAFF and ADMIN) — emails the customer the tracking number.
 *   - Cancel and Refund (ADMIN only, as they give money back through Stripe).
 * Every action re-checks the order's status in the database, so pressing a
 * button twice, or two people at once, can't ship or refund twice.
 */

const shipSchema = z.object({
  orderId: z.string().min(1).max(64),
  trackingNumber: z.string().trim().min(3, "Enter the tracking number").max(60),
  trackingUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || cleanTrackingUrl(v) !== null, "Paste the courier's full tracking link (starting with https://), or leave it blank"),
  notify: z.string().optional(),
});

export async function shipOrderAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = await requireStaff();
  const parsed = shipSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { orderId, trackingNumber } = parsed.data;
  const trackingUrl = cleanTrackingUrl(parsed.data.trackingUrl);

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, number: true, status: true, trackingNumber: true } });
  if (!order) return { error: "That order doesn't exist." };

  let notify: boolean;
  if (order.status === "PAID") {
    // Only one press can move it from "to ship" to "shipped".
    const { count } = await prisma.order.updateMany({
      where: { id: orderId, status: "PAID" },
      data: { status: "SHIPPED", shippedAt: new Date(), trackingNumber, trackingUrl },
    });
    if (count === 0) return { error: "Someone else just changed this order — refresh the page." };
    notify = true;
  } else if (order.status === "SHIPPED") {
    // Fixing the tracking details of an order that's already gone.
    await prisma.order.update({ where: { id: orderId }, data: { trackingNumber, trackingUrl } });
    notify = parsed.data.notify === "on";
  } else {
    return { error: `This order is ${order.status.toLowerCase()}, so it can't be shipped.` };
  }

  const emailed = notify && (await sendShippedEmail(orderId));
  await recordChange(
    user,
    {
      action: order.status === "PAID" ? "order.ship" : "order.tracking",
      entity: "Order",
      entityId: orderId,
      detail: { number: order.number, trackingNumber, ...(order.trackingNumber && order.trackingNumber !== trackingNumber ? { was: order.trackingNumber } : {}) },
    },
    { refresh: [] },
  );
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  const what = order.status === "PAID" ? `${order.number} marked as shipped.` : "Tracking details saved.";
  if (!notify) return { message: what };
  return emailed ? { message: `${what} We've emailed the customer.` } : { message: `${what} The email to the customer couldn't be sent — check the email settings.` };
}

const moneyAction = z.object({ orderId: z.string().min(1).max(64), restock: z.string().optional() });

/** Cancels an order that hasn't shipped: refunds it in full and puts the items back in stock. */
export async function cancelOrderAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = await requireAdmin();
  const { orderId } = moneyAction.parse(Object.fromEntries(formData));
  return giveMoneyBack(user, orderId, { kind: "cancelled", restock: true });
}

/** Refunds an order in full (shipped or not). Ticking "back in stock" adds the items back (e.g. after a return). */
export async function refundOrderAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = await requireAdmin();
  const parsed = moneyAction.parse(Object.fromEntries(formData));
  return giveMoneyBack(user, parsed.orderId, { kind: "refunded", restock: parsed.restock === "on" });
}

async function giveMoneyBack(user: { id: string }, orderId: string, { kind, restock }: { kind: "cancelled" | "refunded"; restock: boolean }): Promise<AdminFormState> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: { select: { variantId: true, quantity: true } } } });
  if (!order) return { error: "That order doesn't exist." };
  const allowed = kind === "cancelled" ? ["PAID"] : ["PAID", "SHIPPED"];
  if (!allowed.includes(order.status)) {
    return {
      error:
        kind === "cancelled" && order.status === "SHIPPED"
          ? "This order has already shipped, so it can't be cancelled. Use Refund instead."
          : `This order is already ${order.status.toLowerCase()}.`,
    };
  }

  // 1. Give the money back through Stripe. The key is the order, so a second press gets the same refund, not another one.
  let refund;
  try {
    refund = await refundInFull({ paymentIntentId: order.stripePaymentIntentId, sessionId: order.stripeSessionId, key: `refund-${order.id}`, orderNumber: order.number });
  } catch (e) {
    const why = e instanceof StripeError ? e.message : "Stripe couldn't be reached.";
    console.error("Refund failed for", order.number, e);
    return { error: `The refund didn't go through, so nothing was changed. Stripe said: ${why}` };
  }
  if (refund.status === "failed" || refund.status === "canceled") {
    return { error: `Stripe couldn't refund this payment (refund ${refund.id} is ${refund.status}). Check it in the Stripe dashboard.` };
  }
  const refundTotal = refund.amount / 100;

  // 2. Save it. Only one press can change the status, and stock is only added back by that one.
  const now = new Date();
  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: { in: allowed as ("PAID" | "SHIPPED")[] } },
      data: {
        status: kind === "cancelled" ? "CANCELLED" : "REFUNDED",
        ...(kind === "cancelled" ? { cancelledAt: now } : {}),
        refundedAt: now,
        refundTotal,
        stripeRefundId: refund.id,
        stripePaymentIntentId: refund.paymentIntent,
      },
    });
    if (count === 0) return false;
    if (restock) {
      for (const item of order.items) {
        if (item.variantId) await tx.productVariant.updateMany({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
      }
    }
    return true;
  });
  if (!changed) return { error: "Someone else just changed this order — refresh the page." };

  const emailed = await sendRefundEmail(order.id, kind);
  await recordChange(
    user,
    {
      action: kind === "cancelled" ? "order.cancel" : "order.refund",
      entity: "Order",
      entityId: order.id,
      detail: { number: order.number, refund: refundTotal, stripeRefund: refund.id, restocked: restock },
    },
    // Stock went back up, so the shop's "sold out" labels need refreshing.
    { refresh: restock ? ["products"] : [] },
  );
  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");

  const done = `${kind === "cancelled" ? `${order.number} cancelled and` : `${order.number}:`} ${formatPrice(refundTotal)} refunded to the customer's card${restock ? ", items back in stock" : ""}.`;
  return { message: emailed ? `${done} We've emailed them.` : `${done} The email to the customer couldn't be sent.` };
}
