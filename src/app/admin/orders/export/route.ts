import { requireStaff } from "@/lib/auth/dal";
import { toCsv } from "@/lib/admin/csv";
import { toShopInput } from "@/lib/admin/dates";
import { orderDetailInclude, orderWhere, readOrderFilters } from "@/lib/admin/orders";
import { addressLines, gstIncluded, optionsText, readAddress } from "@/lib/orders/format";
import { prisma } from "@/lib/prisma";

/**
 * Downloads the orders on screen (same search and status filter) as CSV, for
 * delivery handling — one row per item, with the delivery address on every
 * row. "To ship" + Export gives everything waiting to be sent.
 */
export async function GET(request: Request) {
  await requireStaff("/admin/orders");
  const filters = readOrderFilters(Object.fromEntries(new URL(request.url).searchParams));

  const orders = await prisma.order.findMany({
    where: orderWhere(filters),
    orderBy: { createdAt: "asc" }, // oldest first: the order to pack them in
    take: 5000,
    include: orderDetailInclude,
  });

  const header = [
    "order", "placed", "status", "customer", "email", "phone",
    "deliver_to", "address_line1", "address_line2", "suburb", "state", "postcode", "country", "address_one_line",
    "item", "sku", "options", "quantity", "unit_price", "line_total",
    "order_subtotal", "order_discount", "order_shipping", "order_total", "gst_included", "tracking_number", "shipped",
  ];
  const money = (d: { toString(): string } | number) => Number(d).toFixed(2);
  const when = (d: Date | null) => (d ? toShopInput(d).replace("T", " ") : "");

  const rows = orders.flatMap((o) => {
    const a = readAddress(o.shippingAddress);
    const base = [
      o.number, when(o.createdAt), o.status.toLowerCase(), o.name, o.email, o.phone ?? a?.phone ?? "",
      a?.fullName, a?.line1, a?.line2, a?.city, a?.state, a?.postcode, a?.country || "Australia", addressLines(a).join(", "),
    ];
    const totals = [money(o.subtotal), money(o.discountTotal), money(o.shippingTotal), money(o.total), money(gstIncluded(Number(o.total))), o.trackingNumber, when(o.shippedAt)];
    return o.items.map((i) => [...base, i.name, i.sku, optionsText(i), i.quantity, money(i.unitPrice), money(i.lineTotal), ...totals]);
  });

  const date = new Date().toISOString().slice(0, 10);
  const name = `aussient-orders${filters.status ? `-${filters.status.toLowerCase()}` : ""}-${date}.csv`;
  return new Response(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
