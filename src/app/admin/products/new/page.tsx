import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth/dal";
import { productFormChoices } from "@/lib/admin/product-choices";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage({ searchParams }: PageProps<"/admin/products/new">) {
  await requireStaff("/admin/products/new");
  const sp = await searchParams;
  const choices = await productFormChoices();
  // ?type=<id> skips step 1 (e.g. from a product type's page).
  const typeId = choices.types.find((t) => t.id === sp.type)?.id ?? "";

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
          <Link href="/admin/product-types/new" className="underline">Add a product type</Link> first — it sets each product&apos;s options and specs.
        </p>
      ) : (
        <ProductForm
          {...choices}
          typeLocked={false}
          values={{
            name: "",
            slug: "",
            description: "",
            productTypeId: typeId,
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
