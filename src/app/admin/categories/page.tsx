import type { Metadata } from "next";
import { CategoriesEditor } from "@/components/admin/categories-editor";
import { PageHeader } from "@/components/admin/ui";
import { cloudinaryConfig } from "@/lib/admin/cloudinary";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireStaff("/admin/categories");
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { products: true } } },
  });
  const cloud = cloudinaryConfig();

  return (
    <>
      <PageHeader title="Categories" description="Drag or use the arrows to reorder." />
      <CategoriesEditor
        key={categories.map((c) => `${c.id}${c.order}${c.name}${c.slug}${c.image}`).join()}
        cloudinary={cloud && { cloudName: cloud.cloudName, apiKey: cloud.apiKey }}
        categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, image: c.image, products: c._count.products }))}
      />
    </>
  );
}
