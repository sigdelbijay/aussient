"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { lineKey } from "@/lib/cart/pricing";
import { readBag, writeBag } from "@/lib/cart/storage";
import { calculateTotals } from "@/lib/cart/totals";
import { optionsText, snapshotOptions } from "@/lib/orders/format";
import { prisma } from "@/lib/prisma";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/email";
import { createCheckoutSession, createOneOffCoupon, StripeError } from "@/lib/stripe";
import { orderPlaced } from "@/lib/orders/placed";
import { fulfilCheckout, type CheckoutLine } from "./fulfil";

/**
 * "Checkout" in the bag: prices the bag again here on the server, saves that
 * exact snapshot, and opens Stripe's payment page with those prices. The
 * browser only says "I want to pay" — never what anything costs.
 */
export async function startCheckoutAction(): Promise<{ url: string } | { error: string }> {
  const user = await getCurrentUser();
  // A bot hammering Checkout would create lots of Stripe sessions.
  if (await tooManyAttempts("checkout", clientIp(await headers()), { max: 20, minutes: 10 })) {
    return { error: "Too many tries — please wait a few minutes and try again." };
  }

  const bag = await readBag(user);
  const totals = await calculateTotals(bag.items, {
    code: bag.code,
    customer: user ? { userId: user.id, email: user.email } : null,
  });
  if (!totals.canCheckout) return { error: "Please check your bag — something in it has changed." };

  const counted = totals.lines.filter((l) => l.issue === null || l.issue === "reduced");
  // Remember any quantity that was lowered to what's in stock, so the bag matches what's paid for.
  await writeBag(user, {
    items: counted.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty })),
    code: bag.code,
  });

  // SKUs and option names for the order lines (e.g. Size: M / Colour: Navy).
  const value = { select: { value: true } };
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: counted.map((l) => l.variantId!).filter(Boolean) } },
    select: {
      id: true,
      sku: true,
      option1: value,
      option2: value,
      option3: value,
      product: { select: { productType: { select: { optionNames: true } } } },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const lines: CheckoutLine[] = counted.map((l) => {
    const v = l.variantId ? byId.get(l.variantId) : undefined;
    return {
      productId: l.productId,
      variantId: l.variantId,
      name: l.name,
      variantName: l.variantName,
      sku: v?.sku ?? null,
      options: v
        ? snapshotOptions(v.product.productType.optionNames, [
            v.option1?.value,
            v.option2?.value,
            v.option3?.value,
          ])
        : [],
      unitPrice: l.unitPrice,
      qty: l.qty,
      lineTotal: l.lineTotal,
      image: l.image,
    };
  });

  const settings = await prisma.siteSettings.findUnique({
    where: { id: "singleton" },
    select: { expressShippingRate: true },
  });

  const record = await prisma.checkoutSession.create({
    data: {
      userId: user?.id ?? null,
      email: user?.email ?? null,
      lines,
      subtotal: totals.subtotal,
      discountTotal: totals.discount?.amount ?? 0,
      discountId: totals.discount?.id ?? null,
    },
  });

  const cents = (n: number) => Math.round(n * 100);
  const shippingOption = (name: string, amount: number, days: [number, number]) => ({
    shipping_rate_data: {
      type: "fixed_amount",
      display_name: name,
      fixed_amount: { amount: cents(amount), currency: "aud" },
      delivery_estimate: {
        minimum: { unit: "business_day", value: days[0] },
        maximum: { unit: "business_day", value: days[1] },
      },
    },
  });
  const shippingOptions = [
    shippingOption(
      totals.shipping === 0 ? "Free standard shipping" : "Standard shipping",
      totals.shipping,
      [2, 7],
    ),
  ];
  if (settings?.expressShippingRate != null) {
    shippingOptions.push(
      shippingOption("Express shipping", Number(settings.expressShippingRate), [1, 3]),
    );
  }

  try {
    const discountCents = cents(totals.discount?.amount ?? 0);
    const coupon =
      discountCents > 0
        ? await createOneOffCoupon(discountCents, totals.discount!.label, `coupon-${record.id}`)
        : null;

    const session = await createCheckoutSession(
      {
        mode: "payment",
        currency: "aud",
        client_reference_id: record.id,
        metadata: { checkoutId: record.id },
        payment_intent_data: { metadata: { checkoutId: record.id } },
        customer_email: user?.email,
        line_items: lines.map((l) => {
          const opts = optionsText({ options: l.options, variantName: l.variantName });
          return {
            quantity: l.qty,
            price_data: {
              currency: "aud",
              unit_amount: cents(l.unitPrice),
              tax_behavior: "inclusive", // our prices already include GST
              product_data: {
                name: l.name,
                description: opts ?? undefined,
                images: l.image?.startsWith("https://") ? [l.image] : undefined,
              },
            },
          };
        }),
        discounts: coupon ? [{ coupon: coupon.id }] : undefined,
        shipping_address_collection: { allowed_countries: ["AU"] },
        phone_number_collection: { enabled: true },
        shipping_options: shippingOptions,
        // The payment page closes after an hour, so prices can't be held for days.
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
        success_url: siteUrl("/checkout/success?session_id={CHECKOUT_SESSION_ID}"),
        cancel_url: siteUrl("/cart"),
      },
      `checkout-${record.id}`,
    );
    await prisma.checkoutSession.update({
      where: { id: record.id },
      data: { stripeSessionId: session.id },
    });
    if (!session.url) throw new StripeError("Stripe didn't return a payment page.");
    return { url: session.url };
  } catch (e) {
    console.error("Checkout failed", e);
    return { error: "We couldn't open the payment page. Please try again in a moment." };
  }
}

export type ConfirmedOrder = { number: string; email: string; total: number };

/**
 * The thank-you page calls this after Stripe sends the shopper back. It makes
 * the order if the webhook hasn't yet (it's safe for both to try), sends the
 * emails, and takes what was bought out of the bag. Returns null while Stripe
 * is still confirming the payment.
 */
export async function confirmOrderAction(stripeSessionId: string): Promise<ConfirmedOrder | null> {
  if (typeof stripeSessionId !== "string" || !/^cs_[A-Za-z0-9_]{10,250}$/.test(stripeSessionId))
    return null;

  const orderId = await fulfilCheckout(stripeSessionId);
  if (!orderId) return null;
  // Emails go out after the answer is sent, so the page shows straight away.
  after(() => orderPlaced(orderId));

  // Take the paid items out of the bag (a guest's bag is in a cookie, which only an action can change).
  // Anything added in another tab while paying stays in the bag.
  const record = await prisma.checkoutSession.findUnique({ where: { stripeSessionId } });
  const user = await getCurrentUser();
  const bag = await readBag(user);
  const paid = new Set(
    ((record?.lines ?? []) as CheckoutLine[]).map((l) => lineKey(l.productId, l.variantId)),
  );
  await writeBag(user, {
    items: bag.items.filter((i) => !paid.has(lineKey(i.productId, i.variantId))),
    code: null,
  });

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { number: true, email: true, total: true },
  });
  return { number: order.number, email: order.email, total: Number(order.total) };
}
