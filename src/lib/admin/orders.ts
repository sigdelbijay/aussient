import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ORDER_STATUSES, type OrderStatusName } from "@/lib/orders/format";

/**
 * The search and status filter on /admin/orders. The list, the CSV export
 * and the packing lists all use these, so they always show the same orders.
 */

export type OrderFilters = { q: string; status: OrderStatusName | null };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function readOrderFilters(sp: Params): OrderFilters {
  const status = ORDER_STATUSES.find((s) => s === one(sp.status)) ?? null;
  return { q: one(sp.q).trim().slice(0, 100), status };
}

/** Search matches the order number (with or without "AUS-") or the customer's email or name. */
export function orderWhere({ q, status }: OrderFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = status ? { status } : {};
  if (!q) return where;
  return {
    ...where,
    OR: [
      { number: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ],
  };
}

/** "?q=…&status=…" for links that keep the current filters. */
export function filterQuery(f: OrderFilters, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status) p.set("status", f.status);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Everything the order page, packing list and CSV show about an order. */
export const orderDetailInclude = {
  items: { orderBy: { id: "asc" }, include: { product: { select: { slug: true } } } },
  discount: { select: { code: true, title: true } },
  user: { select: { id: true, name: true, createdAt: true } },
} satisfies Prisma.OrderInclude;
