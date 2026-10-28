import type { Metadata } from "next";
import Link from "next/link";
import { Download, Printer, Search } from "lucide-react";
import { cn } from "cn";
import { PageHeader, StatusPill, TableWrap, inputClass } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { filterQuery, orderWhere, readOrderFilters } from "@/lib/admin/orders";
import { requireStaff } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUSES, STATUS_LABELS, optionsText } from "@/lib/orders/format";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 50;
const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" });

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireStaff("/admin/orders");
  const sp = await searchParams;
  const filters = readOrderFilters(sp);
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const where = orderWhere(filters);

  const [orders, total, counts] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { items: { orderBy: { id: "asc" }, select: { name: true, variantName: true, options: true, quantity: true } } },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["status"], where: orderWhere({ ...filters, status: null }), _count: true }),
  ]);
  const countOf = (s: string | null) => (s ? (counts.find((c) => c.status === s)?._count ?? 0) : counts.reduce((n, c) => n + c._count, 0));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Orders"
        description="Paid orders wait under “To ship” until you mark them as shipped."
        actions={
          <>
            <a href={`/admin/orders/packing${filterQuery(filters)}`} target="_blank" className={cn(buttonVariants({ variant: "outline" }), "h-9 gap-2 px-3")}>
              <Printer /> Packing lists
            </a>
            <a href={`/admin/orders/export${filterQuery(filters)}`} className={cn(buttonVariants({ variant: "outline" }), "h-9 gap-2 px-3")}>
              <Download /> Export CSV
            </a>
          </>
        }
      />

      <form className="mb-3 flex max-w-xl gap-2" role="search">
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        <label className="relative flex-1">
          <span className="sr-only">Search orders</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" type="search" defaultValue={filters.q} placeholder="Order number, email or name" className={cn(inputClass, "pl-9")} />
        </label>
        <button type="submit" className={cn(buttonVariants(), "h-10 px-4")}>
          Search
        </button>
      </form>

      <nav className="mb-4 flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-background p-1 text-sm shadow-xs ring-1 ring-border" aria-label="Order status">
        {[null, ...ORDER_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={`/admin/orders${filterQuery({ ...filters, status: s })}`}
            aria-current={s === filters.status ? "page" : undefined}
            className={cn("rounded-md px-3 py-1.5", s === filters.status ? "bg-brand-ink font-semibold text-brand-paper" : "hover:bg-muted")}
          >
            {s === null ? "All" : STATUS_LABELS[s]} <span className="opacity-60">{countOf(s)}</span>
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-muted-foreground">
          {filters.q ? `No orders match “${filters.q}”.` : "No orders here yet."}
        </p>
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
              <tr key={o.id} className="relative align-top hover:bg-muted/40">
                <td className="font-semibold">
                  {/* The whole row opens the order. */}
                  <Link href={`/admin/orders/${o.id}`} className="after:absolute after:inset-0 hover:underline">
                    {o.number}
                  </Link>
                </td>
                <td className="whitespace-nowrap text-muted-foreground">{dateFmt.format(o.createdAt)}</td>
                <td>
                  {o.name}
                  <span className="block text-xs text-muted-foreground">{o.email}</span>
                </td>
                <td className="text-xs">
                  {o.items.map((i, n) => (
                    <span key={n} className="block">
                      {i.quantity}× {i.name}
                      {optionsText(i) && <span className="text-muted-foreground"> · {optionsText(i)}</span>}
                    </span>
                  ))}
                </td>
                <td className="whitespace-nowrap">{formatPrice(Number(o.total))}</td>
                <td>
                  <StatusPill status={o.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Pages">
          <span className="text-muted-foreground">
            Page {page} of {pages} · {total} orders
          </span>
          <span className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/orders${filterQuery(filters, { page: String(page - 1) })}`} className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}>
                Newer
              </Link>
            )}
            {page < pages && (
              <Link href={`/admin/orders${filterQuery(filters, { page: String(page + 1) })}`} className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}>
                Older
              </Link>
            )}
          </span>
        </nav>
      )}
    </>
  );
}
