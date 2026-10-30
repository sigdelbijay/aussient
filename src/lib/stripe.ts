import "server-only";
import { checkStripeSignature, formFields } from "./stripe-sign";

/**
 * The few Stripe calls the shop needs, made straight to Stripe's web API with
 * fetch (no extra library). Uses STRIPE_SECRET_KEY from .env — a test key
 * (sk_test_…) while building, the live key in production.
 */

const API = "https://api.stripe.com/v1";

export class StripeError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

type Params = Record<string, string>;

async function call<T>(method: "GET" | "POST", path: string, params: Params = {}, idempotencyKey?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Stripe isn't set up — add STRIPE_SECRET_KEY to the environment.");
  const query = new URLSearchParams(params).toString();
  const res = await fetch(method === "GET" && query ? `${API}${path}?${query}` : `${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      // Pressing a button twice (or a retry) can't refund twice: Stripe returns the first result.
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" ? query : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: string } }).error;
    throw new StripeError(err?.message ?? `Stripe error (${res.status})`, err?.code);
  }
  return json as T;
}

type Refund = { id: string; status: string; amount: number };

/** The payment behind a Checkout session. */
async function paymentIntentFor(sessionId: string) {
  const session = await call<{ payment_intent: string | null }>("GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`);
  if (!session.payment_intent) throw new StripeError("Stripe has no payment for this order.");
  return session.payment_intent;
}

/**
 * Refunds a payment in full and returns the refund (amount in cents).
 * `key` should be unique to the order, so a repeat press gives back the same refund.
 */
export async function refundInFull(opts: { paymentIntentId?: string | null; sessionId?: string | null; key: string; orderNumber: string }) {
  const paymentIntent = opts.paymentIntentId || (opts.sessionId ? await paymentIntentFor(opts.sessionId) : null);
  if (!paymentIntent) throw new StripeError("This order has no Stripe payment to refund.");
  try {
    const refund = await call<Refund>("POST", "/refunds", { payment_intent: paymentIntent, "metadata[order]": opts.orderNumber }, opts.key);
    return { ...refund, paymentIntent };
  } catch (e) {
    // Already refunded in the Stripe dashboard? Use that refund.
    if (e instanceof StripeError && e.code === "charge_already_refunded") {
      const list = await call<{ data: Refund[] }>("GET", "/refunds", { payment_intent: paymentIntent, limit: "1" });
      if (list.data[0]) return { ...list.data[0], paymentIntent };
    }
    throw e;
  }
}

// ── Checkout ───────────────────────────────────────────────────

export type CheckoutSessionData = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  payment_intent: string | null;
  amount_subtotal: number | null;
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, string> | null;
  customer_details: { email: string | null; name: string | null; phone: string | null } | null;
  shipping_cost: { amount_total: number; shipping_rate: string | { id: string; display_name?: string } | null } | null;
  // Where the delivery address is depends on the Stripe API version, so both are read.
  shipping_details?: StripeShipping | null;
  collected_information?: { shipping_details?: StripeShipping | null } | null;
};

type StripeShipping = {
  name: string | null;
  address: { line1: string | null; line2: string | null; city: string | null; state: string | null; postal_code: string | null; country: string | null } | null;
};

/** Opens a Stripe Checkout payment page. `params` is Stripe's own shape (see formFields). */
export async function createCheckoutSession(params: Record<string, unknown>, idempotencyKey: string) {
  return call<CheckoutSessionData>("POST", "/checkout/sessions", formFields(params), idempotencyKey);
}

/** A Checkout session fresh from Stripe, with the chosen shipping rate's name. */
export async function getCheckoutSession(id: string) {
  return call<CheckoutSessionData>("GET", `/checkout/sessions/${encodeURIComponent(id)}`, { "expand[0]": "shipping_cost.shipping_rate" });
}

/** A one-off coupon for the discount worked out on our server (Stripe needs one to show money off). */
export async function createOneOffCoupon(amountCents: number, name: string, idempotencyKey: string) {
  return call<{ id: string }>(
    "POST",
    "/coupons",
    { amount_off: String(amountCents), currency: "aud", duration: "once", max_redemptions: "1", name: name.slice(0, 40) },
    idempotencyKey,
  );
}

// ── Webhooks ───────────────────────────────────────────────────

/**
 * Checks a webhook really came from Stripe (see checkStripeSignature) and
 * returns the event, or null if it doesn't check out.
 */
export function verifyWebhook(body: string, header: string | null): { id: string; type: string; data: { object: { id: string } } } | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !checkStripeSignature(body, header, secret)) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
