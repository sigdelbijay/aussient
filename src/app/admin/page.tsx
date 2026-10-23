import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel, Stat, TableWrap } from "@/components/admin/ui";
import { lowStockAlert } from "@/lib/admin/settings";
import { requireStaff } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { variantLabel } from "@/lib/product-types";

export const metadata: Metadata = { title: "Dashboard" };

const TIME_ZONE = "Australia/Sydney";

/** Midnight today in Sydney, as a Date. */
function startOfToday() {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: TIME_ZONE }));
  const offset = local.getTime() - now.getTime();
  local.setHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset);
}

/**
 * Every admin page must start with requireStaff(); every admin server action too.
 */
export default async function AdminDashboard() {
  await requireStaff("/admin");
  const today = startOfToday();
  const paid = { in: ["PAID" as const, "SHIPPED" as const] };
  const LOW_STOCK = await lowStockAlert(); // set in Settings

  const [sales, toShip, toShipCount, lowVariants, pendingReviews] = await Promise.all([
    prisma.order.aggregate({
      where: { createdAt: { gte: today }, status: paid },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.findMany({
      where: { status: "PAID" },
      orderBy: { createdAt: "asc" },
      take: 10,
      include: { _count: { select: { items: true } } },
    }),
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.productVariant.findMany({
      where: { stock: { lte: LOW_STOCK }, product: { status: "LIVE" } },
      orderBy: { stock: "asc" },
      include: {
        product: { select: { id: true, name: true } },
        option1: { select: { value: true } },
        option2: { select: { value: true } },
        option3: { select: { value: true } },
      },
      take: 50,
    }),
    prisma.review.count({ where: { approved: false } }),
  ]);

  // Stock lives on variants (a product with no options has just one).
  const lowStock = lowVariants.map((v) => ({
    key: v.id,
    productId: v.product.id,
    name: v.product.name,
    variant: variantLabel([v.option1?.value, v.option2?.value, v.option3?.value]),
    stock: v.stock,
  }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={new Date().toLocaleDateString("en-AU", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" })}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Today's sales"
          value={formatPrice(Number(sales._sum.total ?? 0))}
          hint={`${sales._count} ${sales._count === 1 ? "order" : "orders"} since midnight`}
        />
        <Stat label="Waiting to ship" value={toShipCount} hint={<Link href="/admin/orders?status=PAID" className="underline">View orders</Link>} />
        <Stat
          label="Low stock"
          value={lowStock.length}
          hint={pendingReviews ? <Link href="/admin/reviews" className="underline">{pendingReviews} reviews to approve</Link> : `${LOW_STOCK} or fewer left (set in Settings)`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Orders waiting to ship" description="Oldest first">
          {toShip.length === 0 ? (
            <p className="text-sm text-muted-foreground">All caught up — nothing to ship.</p>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {toShip.map((o) => (
                  <tr key={o.id}>
                    <td className="font-semibold">{o.number}</td>
                    <td>{o.name}</td>
                    <td>{o._count.items}</td>
                    <td>{formatPrice(Number(o.total))}</td>
                    <td className="text-muted-foreground">{o.createdAt.toLocaleDateString("en-AU", { timeZone: TIME_ZONE })}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>

        <Panel title="Low-stock products" description={`Live products with ${LOW_STOCK} or fewer left`}>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everything is well stocked.</p>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Variant</th>
                  <th>Left</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((p) => (
                  <tr key={p.key}>
                    <td>
                      <Link href={`/admin/products/${p.productId}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="text-muted-foreground">{p.variant ?? "—"}</td>
                    <td>{p.stock === 0 ? <span className="font-semibold text-destructive">Sold out</span> : p.stock}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>
      </div>
    </>
  );
}
