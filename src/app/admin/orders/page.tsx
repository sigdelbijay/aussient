import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { PageHeader, StatusPill, TableWrap } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Orders" };

const STATUSES = ["PAID", "SHIPPED", "CANCELLED", "REFUNDED"] as const;

/** Read-only order list for now (marking orders shipped etc. comes with order management). */
export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireStaff("/admin/orders");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status) ?? null;

  const orders = await prisma.order.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { items: { select: { name: true, variantName: true, quantity: true } } },
  });

  return (
    <>
      <PageHeader title="Orders" description="Most recent 100." />
      <nav className="mb-4 flex w-fit flex-wrap gap-1 rounded-lg bg-background p-1 text-sm shadow-xs ring-1 ring-border">
        {[null, ...STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/admin/orders?status=${s}` : "/admin/orders"}
            aria-current={s === status ? "page" : undefined}
            className={cn("rounded-md px-3 py-1.5", s === status ? "bg-brand-ink font-semibold text-brand-paper" : "hover:bg-muted")}
          >
            {s === null ? "All" : s === "PAID" ? "To ship" : s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-muted-foreground">No orders.</p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Order</th>
              <th>Placed</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="align-top">
                <td className="font-semibold">{o.number}</td>
                <td className="whitespace-nowrap text-muted-foreground">{o.createdAt.toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" })}</td>
                <td>
                  {o.name}
                  <span className="block text-xs text-muted-foreground">{o.email}</span>
                </td>
                <td className="text-xs">
                  {o.items.map((i, n) => (
                    <span key={n} className="block">
                      {i.quantity}× {i.name}
                      {i.variantName && ` (${i.variantName})`}
                    </span>
                  ))}
                </td>
                <td>{formatPrice(Number(o.total))}</td>
                <td>
                  <StatusPill status={o.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
