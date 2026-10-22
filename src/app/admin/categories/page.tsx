import type { Metadata } from "next";
import { CategoriesEditor } from "@/components/admin/categories-editor";
import { PageHeader } from "@/components/admin/ui";
import { cloudinaryConfig } from "@/lib/admin/cloudinary";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { flattenTree, MAX_CATEGORY_DEPTH } from "@/lib/category-tree";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireStaff("/admin/categories");
  // Parents first, each followed by the categories inside it.
  const categories = flattenTree(
    await prisma.category.findMany({ include: { _count: { select: { products: true } } } }),
  );
  const cloud = cloudinaryConfig();

  return (
    <>
      <PageHeader
        title="Categories"
        description={`Nest categories up to ${MAX_CATEGORY_DEPTH} levels (e.g. Women › Clothing › Dresses). Use the arrows or drag to reorder within a level.`}
      />
      <CategoriesEditor
        key={categories.map((c) => `${c.id}${c.order}${c.name}${c.slug}${c.image}${c.parentId}`).join()}
        cloudinary={cloud && { cloudName: cloud.cloudName, apiKey: cloud.apiKey }}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          image: c.image,
          parentId: c.parentId,
          depth: c.depth,
          products: c._count.products,
        }))}
      />
    </>
  );
}
