import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "cn";
import { PageHeader, TableWrap } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Brands" };

export default async function BrandsPage() {
  await requireStaff("/admin/brands");
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });

  return (
    <>
      <PageHeader
        title="Brands"
        description="Each brand has its own page at /brands/…"
        actions={
          <Link href="/admin/brands/new" className={cn(buttonVariants(), "h-9 gap-2 px-3")}>
            <Plus /> Add brand
          </Link>
        }
      />
      {brands.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-muted-foreground">No brands yet.</p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className="w-16" />
              <th>Brand</th>
              <th>Web address</th>
              <th>Products</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id}>
                <td className="py-2!">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {b.logo ? <img src={b.logo} alt="" className="size-10 rounded bg-muted object-contain" /> : <div className="size-10 rounded bg-muted" />}
                </td>
                <td>
                  <Link href={`/admin/brands/${b.id}`} className="font-medium hover:underline">
                    {b.name}
                  </Link>
                </td>
                <td className="text-muted-foreground">/brands/{b.slug}</td>
                <td>
                  <Link href={`/admin/products?brand=${b.id}`} className="underline">
                    {b._count.products}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
