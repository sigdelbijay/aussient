import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, ExternalLink } from "lucide-react";
import { cn } from "cn";
import { FormAlert } from "@/components/auth/form-bits";
import { MediaManager } from "@/components/admin/media-manager";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader, Panel, StatusPill } from "@/components/admin/ui";
import { OptionsEditor, VariantsEditor } from "@/components/admin/variants-editor";
import { buttonVariants } from "@/components/ui/button";
import { cloudinaryConfig } from "@/lib/admin/cloudinary";
import { productFormChoices } from "@/lib/admin/product-choices";
import { duplicateProductAction } from "@/lib/admin/product-actions";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { readSpecs } from "@/lib/product-types";

export async function generateMetadata({ params }: PageProps<"/admin/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = await prisma.product.findUnique({ where: { id }, select: { name: true } });
  return { title: p?.name ?? "Product" };
}

const money = (d: { toString(): string } | null) => (d === null ? "" : Number(d).toFixed(2));
const OPTION_SLOTS = 3;

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  await requireStaff(`/admin/products/${id}`);
  const sp = await searchParams;

  const [product, choices] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        productType: { select: { name: true, optionNames: true } },
        categories: { select: { id: true } },
        media: { orderBy: { order: "asc" } },
        optionValues: { orderBy: { order: "asc" }, include: { _count: { select: { media: true } } } },
        variants: { orderBy: { createdAt: "asc" } },
        _count: { select: { reviews: true } },
      },
    }),
    productFormChoices(),
  ]);
  if (!product) notFound();
  const cloud = cloudinaryConfig();
  const optionNames = product.productType.optionNames.slice(0, OPTION_SLOTS);
  const values = product.optionValues.map((v) => ({
    id: v.id,
    option: v.option,
    value: v.value,
    swatchColor: v.swatchColor ?? "",
    swatchImage: v.swatchImage ?? "",
    photos: v._count.media,
  }));

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

      {sp.created && <div className="mb-4"><FormAlert tone="success">Product created. Now add photos and any options (sizes, colours…) below.</FormAlert></div>}
      {sp.duplicated && <div className="mb-4"><FormAlert tone="success">This is a copy, saved as a draft. Rename it, set SKUs, then set it Live.</FormAlert></div>}

      <div className="grid gap-6">
        <ProductForm
          key={product.updatedAt.toISOString()}
          {...choices}
          typeLocked={product.optionValues.length > 0}
          values={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            description: product.description ?? "",
            productTypeId: product.productTypeId,
            brandId: product.brandId ?? "",
            categoryIds: product.categories.map((c) => c.id),
            tags: product.tags.join(", "),
            specs: readSpecs(product.specs),
            details: product.details ?? "",
            care: product.care ?? "",
            seoTitle: product.seoTitle ?? "",
            seoDescription: product.seoDescription ?? "",
            status: product.status,
            featured: product.featured,
          }}
        />

        {optionNames.length > 0 && (
          <Panel
            title="Options"
            description={`${product.productType.name} products let shoppers pick: ${optionNames.join(", ")}. Add the values this product comes in.`}
          >
            <OptionsEditor productId={product.id} optionNames={optionNames} values={values} />
          </Panel>
        )}

        <Panel
          title="Variants"
          description={
            optionNames.length
              ? "One row per combination shoppers can buy, each with its own price, stock and SKU. Prices include GST."
              : "This product type has no options, so the product has a single variant. Prices include GST."
          }
        >
          <VariantsEditor
            // Start fresh from the saved values after each save.
            key={product.variants.map((v) => `${v.id}${v.updatedAt.getTime()}`).join() + values.map((v) => v.value).join()}
            productId={product.id}
            optionNames={optionNames}
            values={values}
            variants={product.variants.map((v) => ({
              id: v.id,
              optionIds: [v.option1Id ?? "", v.option2Id ?? "", v.option3Id ?? ""],
              sku: v.sku ?? "",
              price: money(v.price),
              salePrice: money(v.salePrice),
              stock: v.stock,
              weightGrams: v.weightGrams === null ? "" : String(v.weightGrams),
              barcode: v.barcode ?? "",
            }))}
          />
        </Panel>

        <Panel title="Photos & videos" description="Drag to reorder. The first is the main photo; the second shows when shoppers hover. Link photos to an option value (e.g. Navy) to show them when it's picked.">
          <MediaManager
            key={product.media.map((m) => `${m.id}${m.order}${m.alt}${m.optionValueId}`).join()}
            productId={product.id}
            media={product.media.map((m) => ({ id: m.id, url: m.url, type: m.type, alt: m.alt, optionValueId: m.optionValueId }))}
            optionValues={product.optionValues.map((v) => ({ id: v.id, label: `${v.option}: ${v.value}` }))}
            cloudinary={cloud && { cloudName: cloud.cloudName, apiKey: cloud.apiKey }}
          />
        </Panel>
      </div>
    </>
  );
}
