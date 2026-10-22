import type { Metadata } from "next";
import Link from "next/link";
import { ImportForm } from "@/components/admin/import-form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Import products" };

const COLUMNS: [string, string][] = [
  ["slug", "Web address. Matches an existing product to update it; blank = made from the name."],
  ["name", "Required."],
  ["type", "Product type name, e.g. Earrings, Watch, T-shirt (required for new products)."],
  ["brand", "Optional. New brand names are added automatically."],
  ["categories", "Category names or web addresses, separated by |."],
  ["tags", "Optional words separated by |, e.g. gift | summer."],
  ["status", "live or draft (default draft)."],
  ["featured", "yes or no."],
  ["description, details, care, seo_title, seo_description", "Optional text."],
  ["images", "Photo/video URLs separated by |. New ones are added after existing photos."],
  ["spec:<label>", "One column per spec, e.g. spec:Material or spec:Case size. Yes/no specs take yes or no. A blank cell clears it."],
  ["option1, option2, option3", "The variant's values for the type's options in order, e.g. M and Navy for a T-shirt (Size, Colour). Leave blank for products with no options."],
  ["sku, price, sale_price, stock, weight_grams, barcode", "The variant. price is required, like 24.95. One row per variant — repeat the product's columns on each row."],
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
