import { createHmac, timingSafeEqual } from "node:crypto";

/** Small Stripe helpers with no server-only parts, so they can be unit-tested. */

/**
 * Stripe wants nested data written as form fields, e.g.
 * { line_items: [{ quantity: 2 }] } → "line_items[0][quantity]=2".
 * Empty (undefined/null) values are left out.
 */
export function formFields(
  value: unknown,
  prefix = "",
  out: Record<string, string> = {},
): Record<string, string> {
  if (value === undefined || value === null) return out;
  if (Array.isArray(value)) value.forEach((v, i) => formFields(v, `${prefix}[${i}]`, out));
  else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) formFields(v, prefix ? `${prefix}[${k}]` : k, out);
  } else out[prefix] = String(value);
  return out;
}

/**
 * Did this webhook really come from Stripe? The "Stripe-Signature" header is
 * "t=<time>,v1=<HMAC-SHA256 of '<time>.<body>' made with the webhook secret>".
 * Messages more than 5 minutes old are refused, so a copied one can't be replayed later.
 */
export function checkStripeSignature(
  body: string,
  header: string | null,
  secret: string,
  now = Date.now(),
) {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.split("=") as [string, string]);
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!timestamp || signatures.length === 0) return false;
  if (!(Math.abs(now / 1000 - Number(timestamp)) <= 300)) return false;

  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex"),
  );
  return signatures.some((sig) => {
    const given = Buffer.from(sig);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
