import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "cn";
import { PageHeader, TableWrap } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { readSizeTable } from "@/lib/product-types";

export const metadata: Metadata = { title: "Size Guides" };

export default async function SizeGuidesPage() {
  await requireStaff("/admin/size-guides");
  const guides = await prisma.sizeGuide.findMany({ orderBy: { name: "asc" }, include: { productTypes: { select: { name: true } } } });

  return (
    <>
      <PageHeader
        title="Size Guides"
        description="Size charts. Attach one to a product type and its product pages show a “Size guide” link."
        actions={
          <Link href="/admin/size-guides/new" className={cn(buttonVariants(), "h-9 gap-2 px-3")}>
            <Plus /> Add size guide
          </Link>
        }
      />
      {guides.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-muted-foreground">No size guides yet.</p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Size guide</th>
              <th>Columns</th>
              <th>Rows</th>
              <th>Product types</th>
            </tr>
          </thead>
          <tbody>
            {guides.map((g) => {
              const table = readSizeTable(g.table);
              return (
                <tr key={g.id}>
                  <td>
                    <Link href={`/admin/size-guides/${g.id}`} className="font-medium hover:underline">
                      {g.name}
                    </Link>
                  </td>
                  <td className="text-xs">{table.columns.join(", ")}</td>
                  <td>{table.rows.length}</td>
                  <td>{g.productTypes.map((t) => t.name).join(", ") || <span className="text-muted-foreground">Not used</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
