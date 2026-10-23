import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAlert } from "@/components/auth/form-bits";
import { BrandForm } from "@/components/admin/brand-form";
import { PageHeader } from "@/components/admin/ui";
import { cloudinaryConfig } from "@/lib/admin/cloudinary";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Brand" };

/** /admin/brands/new adds one; /admin/brands/<id> edits it. */
export default async function BrandPage({ params, searchParams }: PageProps<"/admin/brands/[id]">) {
  const { id } = await params;
  await requireStaff(`/admin/brands/${id}`);
  const sp = await searchParams;
  const brand = id === "new" ? null : await prisma.brand.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (id !== "new" && !brand) notFound();
  const cloud = cloudinaryConfig();

  return (
    <>
      <PageHeader
        title={brand?.name ?? "New brand"}
        description={
          <span className="flex gap-3">
            <Link href="/admin/brands" className="underline">Brands</Link>
            {brand && <a href={`/brands/${brand.slug}`} target="_blank" rel="noreferrer" className="underline">View in shop</a>}
          </span>
        }
      />
      {sp.created && <div className="mb-4"><FormAlert tone="success">Brand created.</FormAlert></div>}
      <BrandForm
        key={brand?.updatedAt.toISOString() ?? "new"}
        cloudinary={cloud && { cloudName: cloud.cloudName, apiKey: cloud.apiKey }}
        productCount={brand?._count.products ?? 0}
        values={{ id: brand?.id ?? null, name: brand?.name ?? "", slug: brand?.slug ?? "", logo: brand?.logo ?? "", description: brand?.description ?? "" }}
      />
    </>
  );
}
