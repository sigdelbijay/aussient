"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "cn";
import { FormAlert } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { saveProductAction } from "@/lib/admin/product-actions";
import type { SpecField, SpecValue } from "@/lib/product-types";
import { AdminField, inputClass, Panel, textareaClass } from "./ui";
import { useAdminForm } from "./use-admin-form";

export type ProductFormValues = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  productTypeId: string;
  brandId: string;
  categoryIds: string[];
  /** Comma-separated, e.g. "gift, summer". */
  tags: string;
  specs: Record<string, SpecValue>;
  details: string;
  care: string;
  seoTitle: string;
  seoDescription: string;
  status: "DRAFT" | "LIVE";
  featured: boolean;
};

export type ProductTypeChoice = { id: string; name: string; optionNames: string[]; specFields: SpecField[] };

/**
 * Add / edit a product's details. The spec fields come from the chosen product
 * type. New products also set the price and stock of their first variant;
 * options (sizes, colours…) and more variants are added on the edit page.
 */
export function ProductForm({
  values,
  types,
  brands,
  categories,
  typeLocked,
}: {
  values: ProductFormValues;
  types: ProductTypeChoice[];
  brands: { id: string; name: string }[];
  /** In tree order; depth 0 = top level. */
  categories: { id: string; name: string; depth: number }[];
  /** True once the product has option values (they belong to its type). */
  typeLocked: boolean;
}) {
  const { state, onSubmit, pending } = useAdminForm(saveProductAction);
  const err = (k: string) => state?.fieldErrors?.[k];
  const [typeId, setTypeId] = useState(values.productTypeId);
  const type = types.find((t) => t.id === typeId);
  const isNew = !values.id;

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
              <AdminField label="Details" hint="One fact per line, e.g. size or what's included.">
                <textarea name="details" defaultValue={values.details} rows={3} maxLength={2000} className={textareaClass} />
              </AdminField>
              <AdminField label="Care">
                <textarea name="care" defaultValue={values.care} rows={2} maxLength={2000} className={textareaClass} />
              </AdminField>
            </div>
          </Panel>

          <Panel
            title={type ? `${type.name} specs` : "Specs"}
            description={type ? "Set by the product type. Specs marked “filter” appear as shop filters." : "Choose a product type first."}
          >
            {type && type.specFields.length === 0 && <p className="text-sm text-muted-foreground">This type has no spec fields.</p>}
            {/* Re-mount when the type changes so old values don't carry over. */}
            <div key={typeId} className="grid gap-4 sm:grid-cols-2">
              {type?.specFields.map((field) => (
                <SpecInput key={field.label} field={field} value={values.specs[field.label]} error={err(`spec:${field.label}`)} />
              ))}
            </div>
          </Panel>

          {isNew && (
            <Panel title="Price & stock" description="For the first variant. Options like sizes or colours (each with its own price and stock) can be added next.">
              <div className="grid gap-4 sm:grid-cols-4">
                <AdminField label="Price ($)" error={err("price")} hint="Incl. GST">
                  <input name="price" inputMode="decimal" required placeholder="24.95" className={inputClass} aria-invalid={!!err("price")} />
                </AdminField>
                <AdminField label="Sale price ($)" error={err("salePrice")} hint="Blank = not on sale">
                  <input name="salePrice" inputMode="decimal" placeholder="19.95" className={inputClass} aria-invalid={!!err("salePrice")} />
                </AdminField>
                <AdminField label="Stock" error={err("stock")}>
                  <input name="stock" type="number" min={0} defaultValue={0} className={inputClass} />
                </AdminField>
                <AdminField label="SKU" error={err("sku")} hint="Optional">
                  <input name="sku" maxLength={60} className={cn(inputClass, "uppercase")} />
                </AdminField>
              </div>
            </Panel>
          )}

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

          <Panel title="Organise">
            <div className="grid gap-4">
              <AdminField
                label="Product type"
                error={err("productTypeId")}
                hint={typeLocked ? "Locked while the product has option values." : type?.optionNames.length ? `Shoppers pick: ${type.optionNames.join(", ")}` : "Sets the options and specs."}
              >
                <select
                  name="productTypeId"
                  value={typeId}
                  onChange={(e) => setTypeId(e.target.value)}
                  required
                  disabled={typeLocked}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              {/* Disabled selects aren't sent, so send the locked type separately. */}
              {typeLocked && <input type="hidden" name="productTypeId" value={typeId} />}

              <AdminField label="Brand" error={err("brandId")}>
                <select name="brandId" defaultValue={values.brandId} className={inputClass}>
                  <option value="">No brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </AdminField>

              <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">Categories</legend>
                <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-input p-2">
                  {categories.length === 0 && <p className="text-xs text-muted-foreground">No categories yet.</p>}
                  {categories.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm" style={{ paddingLeft: `${c.depth * 1.25}rem` }}>
                      <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={values.categoryIds.includes(c.id)} className="size-4 accent-brand-ink" />
                      {c.name}
                    </label>
                  ))}
                </div>
                <span className={cn("text-xs", err("categoryIds") ? "text-destructive" : "text-muted-foreground")}>
                  {err("categoryIds") ?? "Tick every category it should appear in."}
                </span>
              </fieldset>

              <AdminField label="Tags" error={err("tags")} hint="Comma-separated, e.g. gift, summer. Used by search and collections.">
                <input name="tags" defaultValue={values.tags} maxLength={500} className={inputClass} />
              </AdminField>
            </div>
          </Panel>

          <Button type="submit" size="lg" disabled={pending} className="h-11 w-full font-semibold">
            {pending && <Loader2 className="animate-spin" />}
            {isNew ? "Create product" : "Save product"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** One spec input, shaped by its kind (text, number, yes/no or pick-from-list). */
function SpecInput({ field, value, error }: { field: SpecField; value: SpecValue | undefined; error?: string }) {
  const name = `spec:${field.label}`;
  const hint = [field.unit && `In ${field.unit}`, field.filterable && "Shop filter"].filter(Boolean).join(" · ");

  if (field.kind === "yes-no") {
    return (
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name={name} defaultChecked={value === true} className="size-4 accent-brand-ink" />
        {field.label}
        {field.filterable && <span className="text-xs text-muted-foreground">(shop filter)</span>}
      </label>
    );
  }
  return (
    <AdminField label={field.label} error={error} hint={hint || undefined}>
      {field.kind === "pick" ? (
        <select name={name} defaultValue={value === undefined ? "" : String(value)} className={inputClass} aria-invalid={!!error}>
          <option value="">—</option>
          {/* Keep a saved value that's no longer in the type's list, so saving doesn't lose it. */}
          {[...(field.choices ?? []), ...(value !== undefined && !field.choices?.includes(String(value)) ? [String(value)] : [])].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      ) : (
        <input
          name={name}
          defaultValue={value === undefined ? "" : String(value)}
          inputMode={field.kind === "number" ? "decimal" : undefined}
          maxLength={200}
          className={inputClass}
          aria-invalid={!!error}
        />
      )}
    </AdminField>
  );
}
