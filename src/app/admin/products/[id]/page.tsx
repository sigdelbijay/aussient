import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, ExternalLink } from "lucide-react";
import { cn } from "cn";
import { FormAlert } from "@/components/auth/form-bits";
import { MediaManager } from "@/components/admin/media-manager";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader, Panel, StatusPill } from "@/components/admin/ui";
import { VariantsEditor } from "@/components/admin/variants-editor";
import { buttonVariants } from "@/components/ui/button";
import { cloudinaryConfig } from "@/lib/admin/cloudinary";
import { duplicateProductAction } from "@/lib/admin/product-actions";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: PageProps<"/admin/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = await prisma.product.findUnique({ where: { id }, select: { name: true } });
  return { title: p?.name ?? "Product" };
}

const money = (d: { toString(): string } | null) => (d === null ? "" : Number(d).toFixed(2));

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  await requireStaff(`/admin/products/${id}`);
  const sp = await searchParams;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        media: { orderBy: { order: "asc" } },
        variants: { orderBy: { createdAt: "asc" }, include: { _count: { select: { media: true } } } },
        _count: { select: { reviews: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!product) notFound();
  const cloud = cloudinaryConfig();

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href="/admin/products" className="underline">Products</Link>
            <StatusPill status={product.status} />
            {product._count.reviews > 0 && (
              <Link href={`/admin/reviews?product=${product.id}`} className="underline">
                {product._count.reviews} reviews
              </Link>
            )}
          </span>
        }
        actions={
          <>
            {product.status === "LIVE" && (
              <a href={`/products/${product.slug}`} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }), "h-9 gap-2 px-3")}>
                <ExternalLink /> View in shop
              </a>
            )}
            <form action={duplicateProductAction.bind(null, product.id)}>
              <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-9 gap-2 px-3")}>
                <Copy /> Duplicate
              </button>
            </form>
          </>
        }
      />

      {sp.created && <div className="mb-4"><FormAlert tone="success">Product created. Now add photos and finishes below.</FormAlert></div>}
      {sp.duplicated && <div className="mb-4"><FormAlert tone="success">This is a copy, saved as a draft. Rename it, set SKUs, then set it Live.</FormAlert></div>}

      <div className="grid gap-6">
        <ProductForm
          key={product.updatedAt.toISOString()}
          categories={categories}
          hasVariants={product.variants.length > 0}
          values={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            description: product.description ?? "",
            price: money(product.price),
            salePrice: money(product.salePrice),
            stock: product.stock,
            material: product.material ?? "",
            style: product.style ?? "",
            hypoallergenic: product.hypoallergenic,
            details: product.details ?? "",
            care: product.care ?? "",
            seoTitle: product.seoTitle ?? "",
            seoDescription: product.seoDescription ?? "",
            categoryId: product.categoryId,
            status: product.status,
            featured: product.featured,
          }}
        />

        <Panel title="Photos & videos" description="Drag to reorder. The first is the main photo; the second shows when shoppers hover.">
          <MediaManager
            key={product.media.map((m) => `${m.id}${m.order}${m.alt}${m.variantId}`).join()}
            productId={product.id}
            media={product.media.map((m) => ({ id: m.id, url: m.url, type: m.type, alt: m.alt, variantId: m.variantId }))}
            variants={product.variants.map((v) => ({ id: v.id, name: v.name }))}
            cloudinary={cloud && { cloudName: cloud.cloudName, apiKey: cloud.apiKey }}
          />
        </Panel>

        <Panel title="Finishes / colours" description="Optional. Each finish can have its own price, stock and photos.">
          <VariantsEditor
            productId={product.id}
            productPrice={money(product.price)}
            variants={product.variants.map((v) => ({
              id: v.id,
              name: v.name,
              sku: v.sku ?? "",
              price: money(v.price),
              salePrice: money(v.salePrice),
              stock: v.stock,
              photos: v._count.media,
            }))}
          />
        </Panel>
      </div>
    </>
  );
}
