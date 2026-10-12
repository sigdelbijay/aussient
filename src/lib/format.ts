/** Money formatting for the AUD storefront. */
const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

export function formatPrice(amount: number): string {
  return aud.format(amount);
}
