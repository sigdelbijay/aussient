import { z } from "zod";

/**
 * Small helpers for showing an order the same way everywhere: the admin
 * order page, the packing list, the CSV export and the customer emails.
 */

export type ShippingAddress = {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postcode: string;
  country?: string | null;
  phone?: string | null;
};

const addressSchema = z.object({
  fullName: z.string().default(""),
  line1: z.string().default(""),
  line2: z.string().nullish(),
  city: z.string().default(""),
  state: z.string().default(""),
  postcode: z.string().default(""),
  country: z.string().nullish(),
  phone: z.string().nullish(),
});

/** The delivery address saved on the order (a copy taken at checkout). */
export function readAddress(json: unknown): ShippingAddress | null {
  const parsed = addressSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** The address as lines for a label, e.g. ["Jane Smith", "1 Sample St", "Sydney NSW 2000", "Australia"]. */
export function addressLines(a: ShippingAddress | null): string[] {
  if (!a) return [];
  return [a.fullName, a.line1, a.line2, [a.city, a.state, a.postcode].filter(Boolean).join(" "), a.country || "Australia"].filter(
    (l): l is string => !!l && l.trim() !== "",
  );
}

export type ItemOption = { name: string; value: string };

const optionsSchema = z.array(z.object({ name: z.string(), value: z.string() }));

/**
 * The options saved on an order line. Checkout should store them with
 * snapshotOptions() so they stay right even if the product changes later.
 */
export function snapshotOptions(optionNames: string[], values: (string | null | undefined)[]): ItemOption[] {
  return values.flatMap((value, i) => (value ? [{ name: optionNames[i] ?? `Option ${i + 1}`, value }] : []));
}

/** "Size: M / Colour: Navy" — or the old variant name for lines saved before options were. */
export function optionsText(item: { options?: unknown; variantName?: string | null }): string | null {
  const parsed = optionsSchema.safeParse(item.options);
  if (parsed.success && parsed.data.length) return parsed.data.map((o) => `${o.name}: ${o.value}`).join(" / ");
  return item.variantName || null;
}

/** The GST inside a GST-inclusive Australian price (one eleventh), to the cent. */
export function gstIncluded(total: number): number {
  return Math.round((total * 100) / 11) / 100;
}

export const ORDER_STATUSES = ["PAID", "SHIPPED", "CANCELLED", "REFUNDED"] as const;
export type OrderStatusName = (typeof ORDER_STATUSES)[number];

/** Words for each status. Paid orders are the ones waiting to be sent. */
export const STATUS_LABELS: Record<OrderStatusName, string> = {
  PAID: "To ship",
  SHIPPED: "Shipped",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

/** Only http(s) tracking links are put in emails and the admin. */
export function cleanTrackingUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
