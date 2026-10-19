import type { Metadata } from "next";
import Link from "next/link";
import { ImportForm } from "@/components/admin/import-form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Import products" };

const COLUMNS: [string, string][] = [
  ["slug", "Web address. Matches an existing product to update it; blank = made from the name."],
  ["name", "Required."],
  ["price, sale_price", "Numbers like 24.95. Leave sale_price blank when not on sale."],
  ["category", "Category name or web address (required for new products)."],
  ["status", "live or draft (default draft)."],
  ["stock", "Used when the product has no finishes."],
  ["material, style, description, details, care, seo_title, seo_description", "Optional text."],
  ["hypoallergenic, featured", "yes or no."],
  ["images", "Photo/video URLs separated by |. New ones are added after existing photos."],
  ["variant, variant_sku, variant_price, variant_sale_price, variant_stock", "One row per finish — repeat the product's columns on each row. Finishes are matched by name."],
];

export default async function ImportPage() {
  await requireStaff("/admin/products/import");
  return (
    <>
      <PageHeader
        title="Import products"
        description={
          <>
            <Link href="/admin/products" className="underline">Products</Link> · Tip:{" "}
            <a href="/admin/products/export" download className="underline">export</a> first, edit in a spreadsheet, then import it back.
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Upload a CSV file" description="Existing products (same slug) are updated; new ones are created. Nothing is deleted.">
          <ImportForm />
        </Panel>
        <Panel title="Columns">
          <dl className="grid gap-3 text-sm">
            {COLUMNS.map(([k, v]) => (
              <div key={k}>
                <dt className="font-mono text-xs font-semibold">{k}</dt>
                <dd className="text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </>
  );
}
