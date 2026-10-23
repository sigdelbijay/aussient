import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAlert } from "@/components/auth/form-bits";
import { ProductTypeForm } from "@/components/admin/product-type-form";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { readSpecFields } from "@/lib/product-types";

export const metadata: Metadata = { title: "Product type" };

/** /admin/product-types/new adds one; /admin/product-types/<id> edits it. */
export default async function ProductTypePage({ params, searchParams }: PageProps<"/admin/product-types/[id]">) {
  const { id } = await params;
  await requireStaff(`/admin/product-types/${id}`);
  const sp = await searchParams;
  const isNew = id === "new";

  const [type, sizeGuides] = await Promise.all([
    isNew ? null : prisma.productType.findUnique({ where: { id }, include: { _count: { select: { products: true } } } }),
    prisma.sizeGuide.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!isNew && !type) notFound();
  const usedOptions = type
    ? (await prisma.productOptionValue.groupBy({ by: ["option"], where: { product: { productTypeId: type.id } } })).map((g) => g.option)
    : [];

  return (
    <>
      <PageHeader
        title={type?.name ?? "New product type"}
        description={
          <Link href="/admin/product-types" className="underline">
            Product Types
          </Link>
        }
      />
      {sp.created && (
        <div className="mb-4">
          <FormAlert tone="success">
            Product type created. <Link href={`/admin/products/new?type=${type?.id}`} className="underline">Add a product</Link> of this type.
          </FormAlert>
        </div>
      )}
      <ProductTypeForm
        key={type?.updatedAt.toISOString() ?? "new"}
        sizeGuides={sizeGuides}
        productCount={type?._count.products ?? 0}
        usedOptions={usedOptions}
        values={{
          id: type?.id ?? null,
          name: type?.name ?? "",
          optionNames: type?.optionNames ?? [],
          specFields: readSpecFields(type?.specFields),
          sizeGuideId: type?.sizeGuideId ?? null,
        }}
      />
    </>
  );
}
