import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { cn } from "cn";
import { OrderActions } from "@/components/admin/order-actions";
import { PageHeader, Panel, StatusPill, TableWrap } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { formatShopDate } from "@/lib/admin/dates";
import { orderDetailInclude } from "@/lib/admin/orders";
import { requireStaff } from "@/lib/auth/dal";
import { formatPrice } from "@/lib/format";
import { addressLines, gstIncluded, optionsText, readAddress } from "@/lib/orders/format";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: PageProps<"/admin/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  const o = await prisma.order.findUnique({ where: { id }, select: { number: true } });
  return { title: o ? `Order ${o.number}` : "Order" };
}

const ACTION_WORDS: Record<string, string> = {
  "order.ship": "Marked as shipped",
  "order.tracking": "Tracking details changed",
  "order.cancel": "Cancelled and refunded",
  "order.refund": "Refunded",
};

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const user = await requireStaff(`/admin/orders/${id}`);
  const order = await prisma.order.findUnique({ where: { id }, include: orderDetailInclude });
  if (!order) notFound();

  const history = await prisma.activityLog.findMany({
    where: { entity: "Order", entityId: order.id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });
  const address = readAddress(order.shippingAddress);
  const phone = order.phone ?? address?.phone;
  const money = (d: { toString(): string } | number) => formatPrice(Number(d));
  const hasPayment = !!(order.stripePaymentIntentId || order.stripeSessionId);

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Orders
      </Link>
      <PageHeader
        title={`Order ${order.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill status={order.status} /> Placed {formatShopDate(order.createdAt)}
          </span>
        }
        actions={
          <a href={`/admin/orders/packing?id=${order.id}`} target="_blank" className={cn(buttonVariants({ variant: "outline" }), "h-9 gap-2 px-3")}>
            <Printer /> Packing list
          </a>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* On phones the actions (ship, refund) come first; on wide screens they sit on the right. */}
        <div className="order-2 grid gap-4 lg:order-1">
          <TableWrap narrow>
            <thead>
              <tr>
                <th>Item</th>
                <th className="hidden sm:table-cell">SKU</th>
                <th className="hidden text-right sm:table-cell">Price</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id} className="align-top">
                  <td>
                    {i.product ? (
                      <Link href={`/admin/products/${i.productId}`} className="font-medium hover:underline">
                        {i.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{i.name}</span>
                    )}
                    {optionsText(i) && <span className="block text-xs text-muted-foreground">{optionsText(i)}</span>}
                    {i.sku && <span className="block font-mono text-xs text-muted-foreground sm:hidden">{i.sku}</span>}
                  </td>
                  <td className="hidden font-mono text-xs sm:table-cell">{i.sku ?? "—"}</td>
                  <td className="hidden text-right whitespace-nowrap sm:table-cell">{money(i.unitPrice)}</td>
                  <td className="text-right">{i.quantity}</td>
                  <td className="text-right whitespace-nowrap">{money(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>

          <Panel>
            <dl className="ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="text-right">{money(order.subtotal)}</dd>
              {Number(order.discountTotal) > 0 && (
                <>
                  <dt className="text-muted-foreground">Discount{order.discount?.code ? ` (${order.discount.code})` : order.discount?.title ? ` (${order.discount.title})` : ""}</dt>
                  <dd className="text-right">−{money(order.discountTotal)}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="text-right">{Number(order.shippingTotal) > 0 ? money(order.shippingTotal) : "Free"}</dd>
              <dt className="border-t border-border pt-1.5 font-semibold">Total</dt>
              <dd className="border-t border-border pt-1.5 text-right font-semibold">{money(order.total)}</dd>
              <dt className="text-xs text-muted-foreground">Includes GST</dt>
              <dd className="text-right text-xs text-muted-foreground">{money(gstIncluded(Number(order.total)))}</dd>
              {order.refundTotal !== null && (
                <>
                  <dt className="font-semibold text-red-700">Refunded</dt>
                  <dd className="text-right font-semibold text-red-700">−{money(order.refundTotal)}</dd>
                </>
              )}
            </dl>
          </Panel>

          <Panel title="History">
            <ol className="grid gap-2 text-sm">
              <li>
                <span className="text-muted-foreground">{formatShopDate(order.createdAt)}</span> — Order placed and paid
              </li>
              {history.map((h) => (
                <li key={h.id}>
                  <span className="text-muted-foreground">{formatShopDate(h.createdAt)}</span> — {ACTION_WORDS[h.action] ?? h.action}
                  {h.user && <span className="text-muted-foreground"> by {h.user.name ?? h.user.email}</span>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="order-1 grid gap-4 lg:order-2">
          <OrderActions
            order={{
              id: order.id,
              number: order.number,
              status: order.status,
              total: Number(order.total),
              trackingNumber: order.trackingNumber,
              trackingUrl: order.trackingUrl,
            }}
            isAdmin={user.role === "ADMIN"}
            hasPayment={hasPayment}
          />

          <Panel title="Customer">
            <p className="text-sm font-medium">{order.name}</p>
            <p className="text-sm break-all">
              <a href={`mailto:${order.email}`} className="hover:underline">
                {order.email}
              </a>
            </p>
            {phone && <p className="text-sm">{phone}</p>}
            <p className="mt-2 text-xs text-muted-foreground">{order.user ? `Has an account (since ${formatShopDate(order.user.createdAt).split(",")[0]})` : "Checked out as a guest"}</p>
          </Panel>

          <Panel title="Delivery address">
            <p className="text-sm leading-relaxed">
              {addressLines(address).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
          </Panel>

          {(order.trackingNumber || order.shippedAt) && (
            <Panel title="Shipping">
              <p className="text-sm">
                Tracking: <span className="font-mono">{order.trackingNumber}</span>
              </p>
              {order.trackingUrl && (
                <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="text-sm break-all underline">
                  Open tracking page
                </a>
              )}
              {order.shippedAt && <p className="mt-1 text-xs text-muted-foreground">Shipped {formatShopDate(order.shippedAt)}</p>}
            </Panel>
          )}

          <Panel title="Payment">
            <p className="text-sm">{hasPayment ? "Paid by card through Stripe" : "No Stripe payment linked to this order"}</p>
            {order.stripePaymentIntentId && <p className="mt-1 font-mono text-xs break-all text-muted-foreground">{order.stripePaymentIntentId}</p>}
            {order.stripeRefundId && (
              <p className="mt-1 text-xs text-muted-foreground">
                Refund <span className="font-mono">{order.stripeRefundId}</span>
                {order.refundedAt && ` · ${formatShopDate(order.refundedAt)}`}
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
