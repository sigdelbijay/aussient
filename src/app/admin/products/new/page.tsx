import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth/dal";
import { productFormChoices } from "@/lib/admin/product-choices";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  await requireStaff("/admin/products/new");
  const choices = await productFormChoices();

  return (
    <>
      <PageHeader
        title="Add product"
        description={
          <>
            <Link href="/admin/products" className="underline">Products</Link> · Photos, options (sizes, colours…) and more
            variants can be added after the product is created.
          </>
        }
      />
      {choices.types.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-muted-foreground">
          Add a product type first (e.g. run the seed) — it sets each product&apos;s options and specs.
        </p>
      ) : (
        <ProductForm
          {...choices}
          typeLocked={false}
          values={{
            name: "",
            slug: "",
            description: "",
            productTypeId: "",
            brandId: "",
            categoryIds: [],
            tags: "",
            specs: {},
            details: "",
            care: "",
            seoTitle: "",
            seoDescription: "",
            status: "DRAFT",
            featured: false,
          }}
        />
      )}
    </>
  );
}
