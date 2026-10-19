import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  await requireStaff("/admin/products/new");
  const categories = await prisma.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } });

  return (
    <>
      <PageHeader
        title="Add product"
        description={
          <>
            <Link href="/admin/products" className="underline">Products</Link> · Photos, videos and finishes can be added after
            the product is created.
          </>
        }
      />
      <ProductForm
        categories={categories}
        hasVariants={false}
        values={{
          name: "",
          slug: "",
          description: "",
          price: "",
          salePrice: "",
          stock: 0,
          material: "",
          style: "",
          hypoallergenic: false,
          details: "",
          care: "",
          seoTitle: "",
          seoDescription: "",
          categoryId: "",
          status: "DRAFT",
          featured: false,
        }}
      />
    </>
  );
}
