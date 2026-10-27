import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "cn";
import { PageHeader, TableWrap } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { formatShopDate } from "@/lib/admin/dates";
import { requireStaff } from "@/lib/auth/dal";
import { DISCOUNT_SCOPES, STATUS_LABELS, describeDiscount, discountStatus, type DiscountStatus } from "@/lib/discounts";
import { prisma } from "@/lib/prisma";
import { onSaleWhere } from "@/lib/storefront";

export const metadata: Metadata = { title: "Discounts" };

const TONE: Record<DiscountStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  scheduled: "bg-sky-100 text-sky-800",
  expired: "bg-muted text-muted-foreground",
  "used-up": "bg-amber-100 text-amber-800",
  off: "bg-muted text-muted-foreground",
};

export default async function DiscountsPage({ searchParams }: PageProps<"/admin/discounts">) {
  await requireStaff("/admin/discounts");
  const { status: wanted } = await searchParams;

  const [rows, onSale] = await Promise.all([
    prisma.discount.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { name: true } },
        productType: { select: { name: true } },
        brand: { select: { name: true } },
        collection: { select: { name: true } },
        _count: { select: { products: true } },
      },
    }),
    prisma.product.count({ where: { status: "LIVE", ...onSaleWhere } }),
  ]);
  const now = new Date();
  const all = rows.map((d) => ({ ...d, status: discountStatus(d, now) }));
  const shown = typeof wanted === "string" && wanted in STATUS_LABELS ? all.filter((d) => d.status === wanted) : all;
  const tabs: (DiscountStatus | "")[] = ["", "active", "scheduled", "expired", "used-up", "off"];

  return (
    <>
      <PageHeader
        title="Discounts"
        description="Codes shoppers type in, and automatic offers that apply by themselves."
        actions={
          <Link href="/admin/discounts/new" className={cn(buttonVariants(), "h-9 gap-2 px-3")}>
            <Plus /> Add discount
          </Link>
        }
      />

      <p className="mb-4 rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Sale prices</span> are set on each product’s variants (Products → a product → Variants → Sale price).
        Any product with one shows as on sale across the shop and on{" "}
        <Link href="/sale" target="_blank" className="underline">
          /sale
        </Link>{" "}
        — {onSale} {onSale === 1 ? "product is" : "products are"} on sale now.
      </p>

      <nav className="mb-4 flex flex-wrap gap-1 text-sm" aria-label="Filter by status">
        {tabs.map((t) => {
          const count = t ? all.filter((d) => d.status === t).length : all.length;
          const current = (wanted ?? "") === t;
          return (
            <Link
              key={t || "all"}
              href={t ? `/admin/discounts?status=${t}` : "/admin/discounts"}
              className={cn("rounded-full px-3 py-1", current ? "bg-brand-ink text-brand-paper" : "hover:bg-muted")}
              aria-current={current ? "page" : undefined}
            >
              {t ? STATUS_LABELS[t] : "All"} ({count})
            </Link>
          );
        })}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-muted-foreground">No discounts here.</p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Discount</th>
              <th>Gives</th>
              <th>Applies to</th>
              <th>Dates</th>
              <th>Status</th>
              <th>Used</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => {
              const value = { ...d, value: d.value === null ? null : Number(d.value) };
              const group =
                d.category?.name ?? d.productType?.name ?? d.brand?.name ?? d.collection?.name ?? (d.scope === "PRODUCTS" ? `${d._count.products} products` : null);
              return (
                <tr key={d.id}>
                  <td>
                    <Link href={`/admin/discounts/${d.id}`} className={cn("font-medium hover:underline", d.code && "font-mono")}>
                      {d.code ?? d.title ?? "Automatic offer"}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{d.code ? (d.title ?? "Code") : "Automatic — no code"}</span>
                  </td>
                  <td>
                    {describeDiscount(value)}
                    {d.minSpend !== null && <span className="block text-xs text-muted-foreground">Spend ${Number(d.minSpend)}+</span>}
                  </td>
                  <td className="text-xs">
                    {DISCOUNT_SCOPES[d.scope]}
                    {d.scope !== "ALL" && <span className="block text-muted-foreground">{group ?? "(deleted)"}</span>}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {d.startsAt || d.endsAt ? (
                      <>
                        {d.startsAt ? formatShopDate(d.startsAt) : "Now"} →
                        <span className="block">{d.endsAt ? formatShopDate(d.endsAt) : "No end"}</span>
                      </>
                    ) : (
                      "Always"
                    )}
                  </td>
                  <td>
                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold", TONE[d.status])}>{STATUS_LABELS[d.status]}</span>
                  </td>
                  <td className="tabular-nums">
                    {d.timesUsed}
                    {d.usageLimit !== null && <span className="text-muted-foreground"> / {d.usageLimit}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
      <p className="mt-3 text-xs text-muted-foreground">“Used” counts paid orders only.</p>
    </>
  );
}
