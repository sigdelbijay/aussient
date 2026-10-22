import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Form from "next/form";
import { Copy, Download, Plus, Search, Upload } from "lucide-react";
import { cn } from "cn";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader, StatusPill, TableWrap, inputClass } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { duplicateProductAction } from "@/lib/admin/product-actions";
import { requireStaff } from "@/lib/auth/dal";
import { LOW_STOCK } from "@/lib/catalog-shared";
import { formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { pricing } from "@/lib/storefront";

export const metadata: Metadata = { title: "Products" };

const PAGE_SIZE = 50;

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireStaff("/admin/products");
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().slice(0, 80);
  const status = sp.status === "LIVE" || sp.status === "DRAFT" ? sp.status : null;
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const where: Prisma.ProductWhereInput = {
    ...(status && { status }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
        { categories: { some: { name: { contains: q, mode: "insensitive" } } } },
        { productType: { name: { contains: q, mode: "insensitive" } } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        productType: { select: { name: true } },
        categories: { select: { name: true } },
        media: { where: { type: "IMAGE" }, orderBy: { order: "asc" }, take: 1 },
        variants: { select: { stock: true, price: true, salePrice: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => `/admin/products?${new URLSearchParams({ ...(q && { q }), ...(status && { status }), ...(p > 1 && { page: String(p) }) })}`;

  return (
    <>
      <PageHeader
        title="Products"
        description={`${total} ${total === 1 ? "product" : "products"}`}
        actions={
          <>
            <Link href="/admin/products/import" className={cn(buttonVariants({ variant: "outline" }), "h-9 gap-2 px-3")}>
              <Upload /> Import CSV
            </Link>
            <a href="/admin/products/export" download className={cn(buttonVariants({ variant: "outline" }), "h-9 gap-2 px-3")}>
              <Download /> Export CSV
            </a>
            <Link href="/admin/products/new" className={cn(buttonVariants(), "h-9 gap-2 px-3")}>
              <Plus /> Add product
            </Link>
          </>
        }
      />

      <Form action="/admin/products" className="mb-4 flex flex-wrap gap-2" role="search">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" name="q" defaultValue={q} placeholder="Search name, SKU, type, brand or category" aria-label="Search products" className={cn(inputClass, "pl-9")} />
        </div>
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className={cn(inputClass, "w-36")}>
          <option value="">All statuses</option>
          <option value="LIVE">Live</option>
          <option value="DRAFT">Draft</option>
        </select>
        <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
          Search
        </button>
      </Form>

      {products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-muted-foreground">
          {q || status ? "No products match." : "No products yet."}
        </p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className="w-16" />
              <th>Product</th>
              <th>Type</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const stock = p.variants.reduce((n, v) => n + v.stock, 0);
              // Price range across variants, at the price shoppers pay.
              const prices = p.variants.map((v) => pricing(v.price, v.salePrice));
              const low = Math.min(...prices.map((x) => x.price));
              const high = Math.max(...prices.map((x) => x.price));
              const onSale = prices.some((x) => x.compareAtPrice !== null);
              return (
                <tr key={p.id}>
                  <td className="py-2!">
                    <div className="relative size-12 overflow-hidden rounded-md bg-muted">
                      {p.media[0] && <Image src={p.media[0].url} alt="" fill sizes="48px" className="object-cover" />}
                    </div>
                  </td>
                  <td>
                    <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {p.variants.length === 1 ? "1 variant" : `${p.variants.length} variants`}
                      {p.featured && " · Featured"}
                    </span>
                  </td>
                  <td>
                    {p.productType.name}
                    <span className="block text-xs text-muted-foreground">{p.categories.map((c) => c.name).join(", ") || "No category"}</span>
                  </td>
                  <td className={cn(onSale && "font-semibold text-brand-accent")}>
                    {p.variants.length === 0 ? "—" : low === high ? formatPrice(low) : `${formatPrice(low)} – ${formatPrice(high)}`}
                    {onSale && <span className="block text-xs font-normal">On sale</span>}
                  </td>
                  <td className={cn(stock === 0 ? "font-semibold text-destructive" : stock <= LOW_STOCK && "font-semibold text-brand-accent")}>
                    {stock === 0 ? "Sold out" : stock}
                  </td>
                  <td>
                    <StatusPill status={p.status} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <Link href={`/admin/products/${p.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                        Edit
                      </Link>
                      <form action={duplicateProductAction.bind(null, p.id)}>
                        <button type="submit" title="Duplicate" aria-label={`Duplicate ${p.name}`} className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}>
                          <Copy />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? <Link href={link(page - 1)} className="underline">← Previous</Link> : <span />}
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={link(page + 1)} className="underline">Next →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
