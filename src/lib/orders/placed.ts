import "server-only";
import { countDiscountUse } from "./discount-usage";
import { sendNewOrderAlert, sendOrderConfirmation } from "./emails";

/**
 * Everything that happens once an order is paid. Checkout (the Stripe
 * webhook) calls this right after saving the order as PAID. When saving the
 * order lines, store each one's `sku` and `options` (use snapshotOptions()
 * from ./format) so the order page, packing list and emails show them.
 *
 * Safe to call more than once for the same order (Stripe can resend
 * webhooks): each step only happens once.
 */
export async function orderPlaced(orderId: string) {
  await countDiscountUse(orderId);
  // The emails go out side by side; one failing doesn't stop the other.
  await Promise.allSettled([sendOrderConfirmation(orderId), sendNewOrderAlert(orderId)]);
}
