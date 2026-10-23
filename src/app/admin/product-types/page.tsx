import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "cn";
import { PageHeader, TableWrap } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { readSpecFields } from "@/lib/product-types";

export const metadata: Metadata = { title: "Product Types" };

export default async function ProductTypesPage() {
  await requireStaff("/admin/product-types");
  const types = await prisma.productType.findMany({
    orderBy: { name: "asc" },
    include: { sizeGuide: { select: { name: true } }, _count: { select: { products: true } } },
  });

  return (
    <>
      <PageHeader
        title="Product Types"
        description="Each type sets what shoppers pick (e.g. Size, Colour) and which specs its products have."
        actions={
          <Link href="/admin/product-types/new" className={cn(buttonVariants(), "h-9 gap-2 px-3")}>
            <Plus /> Add product type
          </Link>
        }
      />
      {types.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-muted-foreground">No product types yet.</p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Type</th>
              <th>Options</th>
              <th>Spec fields</th>
              <th>Size guide</th>
              <th>Products</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => {
              const specs = readSpecFields(t.specFields);
              return (
                <tr key={t.id}>
                  <td>
                    <Link href={`/admin/product-types/${t.id}`} className="font-medium hover:underline">
                      {t.name}
                    </Link>
                  </td>
                  <td>{t.optionNames.join(", ") || <span className="text-muted-foreground">None</span>}</td>
                  <td className="text-xs">
                    {specs.length ? specs.map((f) => (f.filterable ? `${f.label} (filter)` : f.label)).join(", ") : <span className="text-muted-foreground">None</span>}
                  </td>
                  <td>{t.sizeGuide?.name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td>
                    <Link href={`/admin/products?type=${t.id}`} className="underline">
                      {t._count.products}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
