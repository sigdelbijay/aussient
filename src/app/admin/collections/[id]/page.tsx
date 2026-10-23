import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAlert } from "@/components/auth/form-bits";
import { CollectionForm } from "@/components/admin/collection-form";
import { PageHeader } from "@/components/admin/ui";
import { cloudinaryConfig } from "@/lib/admin/cloudinary";
import { productFormChoices } from "@/lib/admin/product-choices";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Collection" };

const money = (d: { toString(): string } | null) => (d === null ? "" : String(Number(d)));

/** /admin/collections/new adds one; /admin/collections/<id> edits it. */
export default async function CollectionPage({ params, searchParams }: PageProps<"/admin/collections/[id]">) {
  const { id } = await params;
  await requireStaff(`/admin/collections/${id}`);
  const sp = await searchParams;

  const [c, choices, products] = await Promise.all([
    id === "new" ? null : prisma.collection.findUnique({ where: { id }, include: { products: { select: { id: true } } } }),
    productFormChoices(),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        productType: { select: { name: true } },
        media: { where: { type: "IMAGE" }, orderBy: { order: "asc" }, take: 1, select: { url: true } },
      },
    }),
  ]);
  if (id !== "new" && !c) notFound();
  const cloud = cloudinaryConfig();

  return (
    <>
      <PageHeader
        title={c?.name ?? "New collection"}
        description={
          <span className="flex gap-3">
            <Link href="/admin/collections" className="underline">Collections</Link>
            {c && <a href={`/collections/${c.slug}`} target="_blank" rel="noreferrer" className="underline">View in shop</a>}
          </span>
        }
      />
      {sp.created && <div className="mb-4"><FormAlert tone="success">Collection created.</FormAlert></div>}
      <CollectionForm
        key={c?.updatedAt.toISOString() ?? "new"}
        cloudinary={cloud && { cloudName: cloud.cloudName, apiKey: cloud.apiKey }}
        categories={choices.categories}
        types={choices.types.map((t) => ({ id: t.id, name: t.name }))}
        brands={choices.brands}
        products={products.map((p) => ({ id: p.id, name: p.name, image: p.media[0]?.url ?? null, live: p.status === "LIVE", type: p.productType.name }))}
        values={{
          id: c?.id ?? null,
          name: c?.name ?? "",
          slug: c?.slug ?? "",
          image: c?.image ?? "",
          description: c?.description ?? "",
          type: c?.type ?? "MANUAL",
          sort: c?.sort ?? "newest",
          productIds: c?.products.map((p) => p.id) ?? [],
          ruleCategoryId: c?.ruleCategoryId ?? "",
          ruleProductTypeId: c?.ruleProductTypeId ?? "",
          ruleBrandId: c?.ruleBrandId ?? "",
          ruleTag: c?.ruleTag ?? "",
          ruleOnSale: c?.ruleOnSale ?? false,
          rulePriceUnder: money(c?.rulePriceUnder ?? null),
          rulePriceOver: money(c?.rulePriceOver ?? null),
        }}
      />
    </>
  );
}
