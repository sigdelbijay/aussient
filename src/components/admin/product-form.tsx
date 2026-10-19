"use client";

import { Loader2 } from "lucide-react";
import { FormAlert } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { saveProductAction } from "@/lib/admin/product-actions";
import { AdminField, inputClass, Panel, textareaClass } from "./ui";
import { useAdminForm } from "./use-admin-form";

export type ProductFormValues = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  salePrice: string;
  stock: number;
  material: string;
  style: string;
  hypoallergenic: boolean;
  details: string;
  care: string;
  seoTitle: string;
  seoDescription: string;
  categoryId: string;
  status: "DRAFT" | "LIVE";
  featured: boolean;
};

/** Add / edit a product's details. New products go to their edit page to add photos and finishes. */
export function ProductForm({
  values,
  categories,
  hasVariants,
}: {
  values: ProductFormValues;
  categories: { id: string; name: string }[];
  hasVariants: boolean;
}) {
  const { state, onSubmit, pending } = useAdminForm(saveProductAction);
  const err = (k: string) => state?.fieldErrors?.[k];

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state?.message && <FormAlert tone="success">{state.message}</FormAlert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-6">
          <Panel title="Details">
            <div className="grid gap-4">
              <AdminField label="Name" error={err("name")}>
                <input name="name" defaultValue={values.name} required maxLength={120} className={inputClass} aria-invalid={!!err("name")} />
              </AdminField>
              <AdminField label="Description" error={err("description")} hint="Shown at the top of the product page.">
                <textarea name="description" defaultValue={values.description} rows={4} maxLength={5000} className={textareaClass} />
              </AdminField>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminField label="Material" error={err("material")} hint="Shop filter, e.g. Sterling silver">
                  <input name="material" defaultValue={values.material} maxLength={80} className={inputClass} />
                </AdminField>
                <AdminField label="Style" error={err("style")} hint="Shop filter, e.g. hoops, studs">
                  <input name="style" defaultValue={values.style} maxLength={40} className={inputClass} />
                </AdminField>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="hypoallergenic" defaultChecked={values.hypoallergenic} className="size-4 accent-brand-ink" />
                Hypoallergenic (shows in the &ldquo;Sensitive ears&rdquo; filter)
              </label>
              <AdminField label="Details" hint="One fact per line: size, weight, closure…">
                <textarea name="details" defaultValue={values.details} rows={4} maxLength={2000} className={textareaClass} />
              </AdminField>
              <AdminField label="Care">
                <textarea name="care" defaultValue={values.care} rows={3} maxLength={2000} className={textareaClass} />
              </AdminField>
            </div>
          </Panel>

          <Panel title="Pricing & stock">
            <div className="grid gap-4 sm:grid-cols-3">
              <AdminField label="Price ($)" error={err("price")}>
                <input name="price" defaultValue={values.price} inputMode="decimal" required placeholder="24.95" className={inputClass} aria-invalid={!!err("price")} />
              </AdminField>
              <AdminField label="Sale price ($)" error={err("salePrice")} hint="Leave blank when not on sale">
                <input name="salePrice" defaultValue={values.salePrice} inputMode="decimal" placeholder="19.95" className={inputClass} aria-invalid={!!err("salePrice")} />
              </AdminField>
              <AdminField
                label="Stock"
                error={err("stock")}
                hint={hasVariants ? "Not used — each finish has its own stock below" : "Units available"}
              >
                <input name="stock" type="number" min={0} defaultValue={values.stock} disabled={hasVariants} className={inputClass} />
              </AdminField>
              {hasVariants && <input type="hidden" name="stock" value={values.stock} />}
            </div>
          </Panel>

          <Panel title="Search engines" description="Optional — defaults to the name and description.">
            <div className="grid gap-4">
              <AdminField label="Web address" error={err("slug")} hint={`aussient.com.au/products/${values.slug || "…"} — blank creates one from the name`}>
                <input name="slug" defaultValue={values.slug} maxLength={80} className={inputClass} />
              </AdminField>
              <AdminField label="SEO title" error={err("seoTitle")} hint="Up to 70 characters">
                <input name="seoTitle" defaultValue={values.seoTitle} maxLength={70} className={inputClass} />
              </AdminField>
              <AdminField label="SEO description" error={err("seoDescription")} hint="Up to 170 characters">
                <textarea name="seoDescription" defaultValue={values.seoDescription} rows={2} maxLength={170} className={textareaClass} />
              </AdminField>
            </div>
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Status">
            <div className="grid gap-2 text-sm">
              {(["LIVE", "DRAFT"] as const).map((s) => (
                <label key={s} className="flex items-start gap-2">
                  <input type="radio" name="status" value={s} defaultChecked={values.status === s} className="mt-0.5 size-4 accent-brand-ink" />
                  <span>
                    <span className="font-medium">{s === "LIVE" ? "Live" : "Draft"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s === "LIVE" ? "Visible and for sale in the shop" : "Hidden from shoppers"}
                    </span>
                  </span>
                </label>
              ))}
              <label className="mt-2 flex items-center gap-2 border-t border-border pt-3">
                <input type="checkbox" name="featured" defaultChecked={values.featured} className="size-4 accent-brand-ink" />
                Featured (home page &ldquo;Featured&rdquo; rows)
              </label>
            </div>
          </Panel>
          <Panel title="Category">
            <AdminField label="Category" error={err("categoryId")}>
              <select name="categoryId" defaultValue={values.categoryId} required className={inputClass}>
                <option value="" disabled>
                  Choose…
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </AdminField>
          </Panel>
          <Button type="submit" size="lg" disabled={pending} className="h-11 w-full font-semibold">
            {pending && <Loader2 className="animate-spin" />}
            {values.id ? "Save product" : "Create product"}
          </Button>
        </div>
      </div>
    </form>
  );
}
