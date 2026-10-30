import { fulfilCheckout } from "@/lib/checkout/fulfil";
import { orderPlaced } from "@/lib/orders/placed";
import { verifyWebhook } from "@/lib/stripe";

/**
 * Stripe calls this when a payment finishes (set it up in Stripe → Developers →
 * Webhooks, see ADMIN-GUIDE.md). It makes the order, takes the stock and sends
 * the confirmation and "new order" emails.
 *
 * Answering with an error makes Stripe try again later (for up to 3 days), so
 * a database hiccup never loses an order.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.text();
  const event = verifyWebhook(body, request.headers.get("stripe-signature"));
  if (!event) return new Response("Invalid signature", { status: 400 });

  // "completed" = card payments; "async_payment_succeeded" = methods that confirm later.
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    try {
      const orderId = await fulfilCheckout(event.data.object.id);
      if (orderId) await orderPlaced(orderId);
    } catch (e) {
      console.error("Stripe webhook failed", event.id, e);
      return new Response("Couldn't save the order — please retry", { status: 500 });
    }
  }
  return Response.json({ received: true });
}
