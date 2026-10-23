import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "cn";
import { PageHeader, TableWrap } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/dal";
import { SORTS } from "@/lib/catalog-shared";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  await requireStaff("/admin/collections");
  const collections = await prisma.collection.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: true } },
      ruleCategory: { select: { name: true } },
      ruleProductType: { select: { name: true } },
      ruleBrand: { select: { name: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Collections"
        description="Groups of products for home page rows, banners and /collections/… pages."
        actions={
          <Link href="/admin/collections/new" className={cn(buttonVariants(), "h-9 gap-2 px-3")}>
            <Plus /> Add collection
          </Link>
        }
      />
      {collections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-muted-foreground">No collections yet.</p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Collection</th>
              <th>Kind</th>
              <th>Products</th>
              <th>Order</th>
            </tr>
          </thead>
          <tbody>
            {collections.map((c) => {
              // A short summary of the rules, e.g. "Watches · on sale · under $50".
              const rules = [
                c.ruleCategory?.name,
                c.ruleProductType?.name,
                c.ruleBrand?.name,
                c.ruleTag && `tag “${c.ruleTag}”`,
                c.ruleOnSale && "on sale",
                c.rulePriceUnder !== null && `under $${Number(c.rulePriceUnder)}`,
                c.rulePriceOver !== null && `over $${Number(c.rulePriceOver)}`,
              ].filter(Boolean);
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/collections/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">/collections/{c.slug}</span>
                  </td>
                  <td>{c.type === "MANUAL" ? "Manual" : "Automatic"}</td>
                  <td className="text-xs">{c.type === "MANUAL" ? `${c._count.products} chosen` : rules.join(" · ") || "Every product"}</td>
                  <td className="text-muted-foreground">{SORTS[c.sort as keyof typeof SORTS] ?? c.sort}</td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
