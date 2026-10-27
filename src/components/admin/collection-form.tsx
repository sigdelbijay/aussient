"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { cn } from "cn";
import { FormAlert } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import type { AdminFormState } from "@/lib/admin/form";
import { deleteCollectionAction, previewCollectionAction, saveCollectionAction } from "@/lib/admin/collection-actions";
import { SORTS } from "@/lib/catalog-shared";
import { formatPrice } from "@/lib/format";
import type { ProductCardData } from "@/lib/storefront";
import { DeleteButton } from "./media-manager";
import { AdminField, inputClass, Panel, textareaClass } from "./ui";
import { ImagePicker, type CloudinaryPublic } from "./upload-button";

export type CollectionValues = {
  id: string | null;
  name: string;
  slug: string;
  image: string;
  description: string;
  type: "MANUAL" | "AUTOMATIC";
  sort: string;
  productIds: string[];
  ruleCategoryId: string;
  ruleProductTypeId: string;
  ruleBrandId: string;
  ruleTag: string;
  ruleOnSale: boolean;
  rulePriceUnder: string;
  rulePriceOver: string;
};

type Choice = { id: string; name: string };
export type ProductChoice = { id: string; name: string; image: string | null; live: boolean; type: string };

/** "" → null, "20" → 20, "abc" → NaN (the server rejects it). */
const amount = (text: string) => (text.trim() === "" ? null : Number(text));

/**
 * Add / edit a collection: hand-picked products (manual), or every product
 * matching some rules (automatic) with a live preview of what matches.
 */
export function CollectionForm({
  values,
  cloudinary,
  products,
  categories,
  types,
  brands,
}: {
  values: CollectionValues;
  cloudinary: CloudinaryPublic;
  products: ProductChoice[];
  categories: (Choice & { depth: number })[];
  types: Choice[];
  brands: Choice[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<AdminFormState>();
  const [v, setV] = useState(values);
  const set = <K extends keyof CollectionValues>(key: K, value: CollectionValues[K]) => setV((x) => ({ ...x, [key]: value }));
  const err = (k: string) => state?.fieldErrors?.[k];

  const rules = useMemo(
    () => ({
      ruleCategoryId: v.ruleCategoryId || null,
      ruleProductTypeId: v.ruleProductTypeId || null,
      ruleBrandId: v.ruleBrandId || null,
      ruleTag: v.ruleTag.trim() || null,
      ruleOnSale: v.ruleOnSale,
      rulePriceUnder: amount(v.rulePriceUnder),
      rulePriceOver: amount(v.rulePriceOver),
    }),
    [v.ruleCategoryId, v.ruleProductTypeId, v.ruleBrandId, v.ruleTag, v.ruleOnSale, v.rulePriceUnder, v.rulePriceOver],
  );

  function save() {
    start(async () => {
      const result = await saveCollectionAction({
        id: v.id,
        name: v.name,
        slug: v.slug,
        image: v.image || null,
        description: v.description,
        type: v.type,
        sort: v.sort,
        productIds: v.productIds,
        // Rules are only kept for automatic collections (the server checks them).
        ...rules,
      });
      setState(result);
      if (!result?.error) router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="grid gap-6"
    >
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state?.message && <FormAlert tone="success">{state.message}</FormAlert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-6">
          <Panel title="Details">
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminField label="Name" error={err("name")}>
                  <input value={v.name} onChange={(e) => set("name", e.target.value)} required maxLength={80} className={inputClass} aria-invalid={!!err("name")} />
                </AdminField>
                <AdminField label="Web address" error={err("slug")} hint={`/collections/${v.slug || "…"} — blank = made from the name`}>
                  <input value={v.slug} onChange={(e) => set("slug", e.target.value)} maxLength={60} className={inputClass} aria-invalid={!!err("slug")} />
                </AdminField>
              </div>
              <AdminField label="Description" hint="Optional, shown under the heading.">
                <textarea value={v.description} onChange={(e) => set("description", e.target.value)} rows={2} maxLength={2000} className={textareaClass} />
              </AdminField>
              <div className="grid gap-1.5">
                <span className="text-sm font-medium">Banner image</span>
                <ImagePicker config={cloudinary} folder="collections" value={v.image} onChange={(url) => set("image", url)} />
                {err("image") && <span className="text-xs text-destructive">{err("image")}</span>}
              </div>
            </div>
          </Panel>

          <Panel title="Products">
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["MANUAL", "Manual", "Pick the products yourself."],
                  ["AUTOMATIC", "Automatic", "Every live product matching the rules — new ones join by themselves."],
                ] as const
              ).map(([type, label, hint]) => (
                <label key={type} className={cn("flex cursor-pointer gap-2 rounded-lg border p-3 text-sm", v.type === type ? "border-brand-ink ring-1 ring-brand-ink" : "border-border")}>
                  <input type="radio" name="type" checked={v.type === type} onChange={() => set("type", type)} className="mt-0.5 size-4 accent-brand-ink" />
                  <span>
                    <span className="font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {v.type === "MANUAL" ? (
              <ProductPicker products={products} chosen={v.productIds} onChange={(ids) => set("productIds", ids)} />
            ) : (
              <RulesEditor v={v} set={set} err={err} rules={rules} categories={categories} types={types} brands={brands} />
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Order">
            <AdminField label="Products are shown" error={err("sort")} hint="On its page and in home page rows.">
              <select value={v.sort} onChange={(e) => set("sort", e.target.value)} className={inputClass}>
                {Object.entries(SORTS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </AdminField>
          </Panel>
          <Button type="submit" size="lg" disabled={pending} className="h-11 w-full font-semibold">
            {pending && <Loader2 className="animate-spin" />}
            {v.id ? "Save collection" : "Create collection"}
          </Button>
          {v.id && (
            <div className="grid gap-1">
              <DeleteButton label="Delete collection" onConfirm={() => start(() => deleteCollectionAction(v.id!))} />
              <p className="text-xs text-muted-foreground">Home page rows that show it will be empty until you change them.</p>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}

/** Tick products to include; chosen ones are listed first. */
export function ProductPicker({ products, chosen, onChange }: { products: ProductChoice[]; chosen: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = products
    .filter((p) => words.every((w) => `${p.name} ${p.type}`.toLowerCase().includes(w)))
    .sort((a, b) => Number(chosen.includes(b.id)) - Number(chosen.includes(a.id)));

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className={cn(inputClass, "pl-9")} />
        </div>
        <span className="text-sm text-muted-foreground">{chosen.length} chosen</span>
      </div>
      <ul className="grid max-h-[28rem] gap-1 overflow-y-auto rounded-md border border-input p-2">
        {shown.length === 0 && <li className="p-2 text-sm text-muted-foreground">No products match.</li>}
        {shown.map((p) => (
          <li key={p.id}>
            <label className="flex items-center gap-3 rounded px-1 py-1 text-sm hover:bg-muted">
              <input
                type="checkbox"
                checked={chosen.includes(p.id)}
                onChange={(e) => onChange(e.target.checked ? [...chosen, p.id] : chosen.filter((x) => x !== p.id))}
                className="size-4 accent-brand-ink"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.image ? <img src={p.image} alt="" className="size-9 rounded bg-muted object-contain" /> : <span className="size-9 rounded bg-muted" />}
              <span className="flex-1">
                {p.name}
                <span className="block text-xs text-muted-foreground">
                  {p.type}
                  {!p.live && " · Draft (hidden from shoppers)"}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Rules = {
  ruleCategoryId: string | null;
  ruleProductTypeId: string | null;
  ruleBrandId: string | null;
  ruleTag: string | null;
  ruleOnSale: boolean;
  rulePriceUnder: number | null;
  rulePriceOver: number | null;
};

/** The rules (all that are set must match), plus a live preview of the products they pick. */
function RulesEditor({
  v,
  set,
  err,
  rules,
  categories,
  types,
  brands,
}: {
  v: CollectionValues;
  set: <K extends keyof CollectionValues>(key: K, value: CollectionValues[K]) => void;
  err: (k: string) => string | undefined;
  rules: Rules;
  categories: (Choice & { depth: number })[];
  types: Choice[];
  brands: Choice[];
}) {
  const [preview, setPreview] = useState<{ total: number; products: ProductCardData[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const badNumber = !Number.isFinite(rules.rulePriceUnder ?? 0) || !Number.isFinite(rules.rulePriceOver ?? 0);

  // Ask the server what matches, shortly after the admin stops typing.
  useEffect(() => {
    if (badNumber) return;
    let current = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await previewCollectionAction(rules, v.sort);
      if (current) {
        setPreview(result);
        setLoading(false);
      }
    }, 350);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [rules, v.sort, badNumber]);

  const select = (key: "ruleCategoryId" | "ruleProductTypeId" | "ruleBrandId", label: string, list: (Choice & { depth?: number })[]) => (
    <AdminField label={label}>
      <select value={v[key]} onChange={(e) => set(key, e.target.value)} className={inputClass}>
        <option value="">Any</option>
        {list.map((c) => (
          <option key={c.id} value={c.id}>
            {"— ".repeat(c.depth ?? 0)}
            {c.name}
          </option>
        ))}
      </select>
    </AdminField>
  );

  return (
    <div className="grid gap-5">
      <p className="text-xs text-muted-foreground">Every rule you set must match. Leave a rule blank to ignore it.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {select("ruleCategoryId", "Category (and inside it)", categories)}
        {select("ruleProductTypeId", "Product type", types)}
        {select("ruleBrandId", "Brand", brands)}
        <AdminField label="Tag" hint="e.g. gift">
          <input value={v.ruleTag} onChange={(e) => set("ruleTag", e.target.value)} maxLength={40} className={inputClass} />
        </AdminField>
        <AdminField label="Price under ($)" error={err("rulePriceUnder")} hint="Price shoppers pay">
          <input value={v.rulePriceUnder} onChange={(e) => set("rulePriceUnder", e.target.value)} inputMode="decimal" placeholder="—" className={inputClass} />
        </AdminField>
        <AdminField label="Price over ($)" error={err("rulePriceOver")}>
          <input value={v.rulePriceOver} onChange={(e) => set("rulePriceOver", e.target.value)} inputMode="decimal" placeholder="—" className={inputClass} />
        </AdminField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v.ruleOnSale} onChange={(e) => set("ruleOnSale", e.target.checked)} className="size-4 accent-brand-ink" />
        Only products on sale
      </label>

      <div className="rounded-lg bg-muted/60 p-3">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium">
          {badNumber ? (
            <span className="text-destructive">Enter prices as numbers, e.g. 20</span>
          ) : preview ? (
            `${preview.total} ${preview.total === 1 ? "product matches" : "products match"} right now`
          ) : (
            "Checking…"
          )}
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </p>
        {preview && preview.products.length > 0 && (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {preview.products.map((p) => (
              <li key={p.id} className="text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.images[0] ? <img src={p.images[0].url} alt="" className="aspect-[4/5] w-full rounded bg-background object-contain" /> : <div className="aspect-[4/5] rounded bg-background" />}
                <p className="mt-1 line-clamp-2 font-medium">{p.name}</p>
                <p className="text-muted-foreground">{formatPrice(p.price)}</p>
              </li>
            ))}
          </ul>
        )}
        {preview && preview.total > preview.products.length && <p className="mt-2 text-xs text-muted-foreground">…and {preview.total - preview.products.length} more.</p>}
      </div>
    </div>
  );
}
