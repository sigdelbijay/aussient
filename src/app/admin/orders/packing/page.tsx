import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/admin/print-button";
import { orderDetailInclude, orderWhere, readOrderFilters } from "@/lib/admin/orders";
import { requireStaff } from "@/lib/auth/dal";
import { addressLines, optionsText, readAddress } from "@/lib/orders/format";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Packing lists" };

const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" });

/**
 * Printable packing lists, one order per sheet: ?id=<order> for one order,
 * otherwise the orders matching the list's search and status filter.
 */
export default async function PackingPage({ searchParams }: PageProps<"/admin/orders/packing">) {
  await requireStaff("/admin/orders");
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : null;
  const where = id ? { id } : orderWhere(readOrderFilters(sp));

  const [orders, settings] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: "asc" }, take: 200, include: orderDetailInclude }),
    prisma.siteSettings.findUnique({ where: { id: "singleton" }, select: { storeName: true } }),
  ]);
  const store = settings?.storeName ?? "Aussient";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted-foreground">
          {orders.length === 0 ? "No orders to pack." : `${orders.length} packing list${orders.length === 1 ? "" : "s"} — each prints on its own page.`}{" "}
          <Link href={id ? `/admin/orders/${id}` : "/admin/orders"} className="underline">
            Back
          </Link>
        </p>
        {orders.length > 0 && <PrintButton />}
      </div>

      {orders.map((o) => {
        const address = addressLines(readAddress(o.shippingAddress));
        const units = o.items.reduce((n, i) => n + i.quantity, 0);
        return (
          <article key={o.id} className="mb-8 break-after-page rounded-xl border border-border bg-background p-6 print:mb-0 print:rounded-none print:border-0 print:p-0">
            <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="font-heading text-xl font-extrabold uppercase">{store}</p>
                <p className="text-sm text-muted-foreground">Packing list</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-heading text-lg font-bold">{o.number}</p>
                <p>{dateFmt.format(o.createdAt)}</p>
              </div>
            </header>

            <div className="mb-6 grid gap-6 sm:grid-cols-2">
              <div>
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ship to</h2>
                <p className="text-base leading-snug">
                  {address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </p>
                {(o.phone || readAddress(o.shippingAddress)?.phone) && <p className="mt-1 text-sm">Phone: {o.phone ?? readAddress(o.shippingAddress)?.phone}</p>}
              </div>
              <div>
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</h2>
                <p>{o.name}</p>
                <p className="text-sm">{o.email}</p>
              </div>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="border-b-2 border-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="w-8 py-2" aria-label="Packed" />
                  <th className="py-2">Item</th>
                  <th className="py-2">SKU</th>
                  <th className="py-2 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.id} className="border-b border-border align-top">
                    <td className="py-3">
                      <span className="inline-block size-4 rounded-sm border-2 border-foreground" />
                    </td>
                    <td className="py-3">
                      <span className="font-medium">{i.name}</span>
                      {optionsText(i) && <span className="block text-muted-foreground print:text-black">{optionsText(i)}</span>}
                    </td>
                    <td className="py-3 font-mono text-xs">{i.sku ?? "—"}</td>
                    <td className="py-3 text-right text-base font-bold">{i.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-3 text-right text-xs uppercase tracking-wide">
                    Total items
                  </td>
                  <td className="pt-3 text-right text-base font-bold">{units}</td>
                </tr>
              </tfoot>
            </table>
            {o.status !== "PAID" && <p className="mt-4 text-sm font-semibold">Note: this order is {o.status.toLowerCase()}.</p>}
          </article>
        );
      })}
    </div>
  );
}
