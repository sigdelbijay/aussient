"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "cn";
import { FormAlert } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { deleteDiscountAction, saveDiscountAction, type DiscountInput } from "@/lib/admin/discount-actions";
import type { AdminFormState } from "@/lib/admin/form";
import { DISCOUNT_SCOPES, DISCOUNT_TYPES, describeDiscount, type DiscountScope, type DiscountType } from "@/lib/discounts";
import { ProductPicker, type ProductChoice } from "./collection-form";
import { DeleteButton } from "./media-manager";
import { AdminField, inputClass, Panel } from "./ui";

/** Everything the form edits, as typed (numbers and dates stay text until the server checks them). */
export type DiscountValues = DiscountInput;

type Choice = { id: string; name: string };

const TYPE_HINTS: Record<DiscountType, string> = {
  PERCENT: "e.g. 20% off",
  AMOUNT: "e.g. $10 off the items",
  FREE_SHIPPING: "No delivery charge",
  BUY_X_GET_Y: "e.g. buy 3, get 1 free",
};

/**
 * Add / edit a discount: a code shoppers type in (e.g. SUMMER20) or an
 * automatic offer that applies by itself and is shown in the announcement bar
 * and as product badges.
 */
export function DiscountForm({
  values,
  status,
  timesUsed,
  products,
  categories,
  types,
  brands,
  collections,
}: {
  values: DiscountValues;
  /** e.g. "Active", "Scheduled" — for saved discounts. */
  status: string | null;
  timesUsed: number;
  products: ProductChoice[];
  categories: (Choice & { depth: number })[];
  types: Choice[];
  brands: Choice[];
  collections: Choice[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<AdminFormState>();
  const [v, setV] = useState(values);
  const set = <K extends keyof DiscountValues>(key: K, value: DiscountValues[K]) => setV((x) => ({ ...x, [key]: value }));
  const err = (k: string) => state?.fieldErrors?.[k];
  const automatic = v.kind === "AUTOMATIC";

  function save() {
    start(async () => {
      const result = await saveDiscountAction(v);
      setState(result);
      if (!result?.error) router.refresh();
    });
  }

  // A plain-English summary of what's set, e.g. "Buy 3, get 1 free on T-shirts".
  const groupName = (() => {
    const find = (list: Choice[], id: string) => list.find((c) => c.id === id)?.name ?? "…";
    switch (v.scope) {
      case "ALL":
        return "everything";
      case "CATEGORY":
        return find(categories, v.categoryId);
      case "PRODUCT_TYPE":
        return find(types, v.productTypeId);
      case "BRAND":
        return find(brands, v.brandId);
      case "COLLECTION":
        return find(collections, v.collectionId);
      case "PRODUCTS":
        return `${v.productIds.length} chosen ${v.productIds.length === 1 ? "product" : "products"}`;
    }
  })();
  const summary = `${describeDiscount({
    type: v.type,
    value: Number(v.value) || 0,
    buyQuantity: Number(v.buyQuantity) || 1,
    getQuantity: Number(v.getQuantity) || 1,
  })} on ${groupName}${v.minSpend.trim() ? ` when you spend $${v.minSpend.trim()}` : ""}`;

  const select = (key: "categoryId" | "productTypeId" | "brandId" | "collectionId", label: string, list: (Choice & { depth?: number })[]) => (
    <AdminField label={label} error={err(key)}>
      <select value={v[key]} onChange={(e) => set(key, e.target.value)} className={inputClass} aria-invalid={!!err(key)}>
        <option value="">Choose…</option>
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
          <Panel title="How shoppers get it">
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["CODE", "Discount code", "Shoppers type a code like SUMMER20 in the bag."],
                  ["AUTOMATIC", "Automatic offer", "Applies by itself. Shown in the announcement bar and as a badge on the products."],
                ] as const
              ).map(([kind, label, hint]) => (
                <label key={kind} className={cn("flex cursor-pointer gap-2 rounded-lg border p-3 text-sm", v.kind === kind ? "border-brand-ink ring-1 ring-brand-ink" : "border-border")}>
                  <input type="radio" name="kind" checked={v.kind === kind} onChange={() => set("kind", kind)} className="mt-0.5 size-4 accent-brand-ink" />
                  <span>
                    <span className="font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {!automatic && (
                <AdminField label="Code" error={err("code")} hint="Letters and numbers; shoppers can type it in any case.">
                  <input
                    value={v.code}
                    onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
                    maxLength={40}
                    placeholder="SUMMER20"
                    className={cn(inputClass, "font-mono uppercase")}
                    aria-invalid={!!err("code")}
                  />
                </AdminField>
              )}
              <AdminField
                label={automatic ? "Announcement text" : "Name (only you see this)"}
                error={err("title")}
                hint={automatic ? `Shown in the announcement bar. Blank = “${summary}”.` : "Optional, e.g. Summer newsletter."}
                className={automatic ? "sm:col-span-2" : undefined}
              >
                <input value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={80} className={inputClass} />
              </AdminField>
            </div>
          </Panel>

          <Panel title="What it gives">
            <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(DISCOUNT_TYPES) as DiscountType[]).map((type) => (
                <label key={type} className={cn("flex cursor-pointer gap-2 rounded-lg border p-3 text-sm", v.type === type ? "border-brand-ink ring-1 ring-brand-ink" : "border-border")}>
                  <input type="radio" name="type" checked={v.type === type} onChange={() => set("type", type)} className="mt-0.5 size-4 accent-brand-ink" />
                  <span>
                    <span className="font-medium">{DISCOUNT_TYPES[type]}</span>
                    <span className="block text-xs text-muted-foreground">{TYPE_HINTS[type]}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {(v.type === "PERCENT" || v.type === "AMOUNT") && (
                <AdminField label={v.type === "PERCENT" ? "Percent off (%)" : "Amount off ($)"} error={err("value")}>
                  <input value={v.value} onChange={(e) => set("value", e.target.value)} inputMode="decimal" placeholder={v.type === "PERCENT" ? "20" : "10"} className={inputClass} aria-invalid={!!err("value")} />
                </AdminField>
              )}
              {v.type === "BUY_X_GET_Y" && (
                <>
                  <AdminField label="Buy (X)" error={err("buyQuantity")}>
                    <input value={v.buyQuantity} onChange={(e) => set("buyQuantity", e.target.value)} inputMode="numeric" placeholder="3" className={inputClass} aria-invalid={!!err("buyQuantity")} />
                  </AdminField>
                  <AdminField label="Get free (Y)" error={err("getQuantity")}>
                    <input value={v.getQuantity} onChange={(e) => set("getQuantity", e.target.value)} inputMode="numeric" placeholder="1" className={inputClass} aria-invalid={!!err("getQuantity")} />
                  </AdminField>
                  <p className="self-center text-xs text-muted-foreground">Shoppers can mix any items it applies to; the cheapest ones are free.</p>
                </>
              )}
              {v.type === "FREE_SHIPPING" && <p className="text-sm text-muted-foreground sm:col-span-3">The delivery charge is removed when the bag has an item this applies to.</p>}
            </div>
          </Panel>

          <Panel title="Applies to">
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Products">
                <select value={v.scope} onChange={(e) => set("scope", e.target.value as DiscountScope)} className={inputClass}>
                  {(Object.keys(DISCOUNT_SCOPES) as DiscountScope[]).map((s) => (
                    <option key={s} value={s}>
                      {DISCOUNT_SCOPES[s]}
                    </option>
                  ))}
                </select>
              </AdminField>
              {v.scope === "CATEGORY" && select("categoryId", "Category (and inside it)", categories)}
              {v.scope === "PRODUCT_TYPE" && select("productTypeId", "Product type", types)}
              {v.scope === "BRAND" && select("brandId", "Brand", brands)}
              {v.scope === "COLLECTION" && select("collectionId", "Collection", collections)}
            </div>
            {v.scope === "PRODUCTS" && (
              <div className="mt-4">
                {err("productIds") && <p className="mb-2 text-xs text-destructive">{err("productIds")}</p>}
                <ProductPicker products={products} chosen={v.productIds} onChange={(ids) => set("productIds", ids)} />
              </div>
            )}
          </Panel>

          <Panel title="Conditions" description="Leave any of these blank for no limit. Times are Sydney time.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AdminField label="Minimum spend ($)" error={err("minSpend")} hint="Items in the bag, after sale prices">
                <input value={v.minSpend} onChange={(e) => set("minSpend", e.target.value)} inputMode="decimal" placeholder="—" className={inputClass} aria-invalid={!!err("minSpend")} />
              </AdminField>
              <AdminField label="Starts" error={err("startsAt")} hint="Blank = straight away">
                <input type="datetime-local" value={v.startsAt} onChange={(e) => set("startsAt", e.target.value)} className={inputClass} aria-invalid={!!err("startsAt")} />
              </AdminField>
              <AdminField label="Ends" error={err("endsAt")} hint="Blank = never">
                <input type="datetime-local" value={v.endsAt} onChange={(e) => set("endsAt", e.target.value)} className={inputClass} aria-invalid={!!err("endsAt")} />
              </AdminField>
              <AdminField label="Usage limit (total)" error={err("usageLimit")} hint="Paid orders that can use it">
                <input value={v.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} inputMode="numeric" placeholder="—" className={inputClass} aria-invalid={!!err("usageLimit")} />
              </AdminField>
              <AdminField label="Limit per customer" error={err("perCustomerLimit")} hint="e.g. 1 = once each">
                <input value={v.perCustomerLimit} onChange={(e) => set("perCustomerLimit", e.target.value)} inputMode="numeric" placeholder="—" className={inputClass} aria-invalid={!!err("perCustomerLimit")} />
              </AdminField>
              <label className="flex items-center gap-2 self-center text-sm">
                <input type="checkbox" checked={v.firstOrderOnly} onChange={(e) => set("firstOrderOnly", e.target.checked)} className="size-4 accent-brand-ink" />
                First order only
              </label>
            </div>
            {(v.perCustomerLimit.trim() || v.firstOrderOnly) && (
              <p className="mt-3 text-xs text-muted-foreground">Checked against the shopper’s account or email at checkout.</p>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Status">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} className="size-4 accent-brand-ink" />
              Active (switch off to pause it)
            </label>
            {status && (
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Right now</dt>
                <dd className="font-medium">{status}</dd>
                <dt className="text-muted-foreground">Times used</dt>
                <dd className="font-medium">
                  {timesUsed}
                  {v.usageLimit.trim() && ` of ${v.usageLimit.trim()}`}
                </dd>
              </dl>
            )}
            <p className="mt-4 rounded-md bg-muted/60 p-3 text-xs">
              <span className="font-semibold">{automatic ? "Offer" : v.code || "Code"}:</span> {summary}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Only one discount applies per order — shoppers get whichever saves them more.</p>
          </Panel>
          <Button type="submit" size="lg" disabled={pending} className="h-11 w-full font-semibold">
            {pending && <Loader2 className="animate-spin" />}
            {v.id ? "Save discount" : "Create discount"}
          </Button>
          {v.id && (
            <DeleteButton
              label="Delete discount"
              onConfirm={() =>
                start(async () => {
                  setState(await deleteDiscountAction(v.id!));
                })
              }
            />
          )}
        </div>
      </div>
    </form>
  );
}
