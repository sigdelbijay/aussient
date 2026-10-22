"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Wand2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  createMissingVariantsAction,
  deleteOptionValueAction,
  deleteVariantAction,
  reorderOptionValuesAction,
  saveOptionValueAction,
  saveVariantAction,
} from "@/lib/admin/variant-actions";
import { DeleteButton } from "./media-manager";
import { inputClass } from "./ui";
import { useAdminForm } from "./use-admin-form";

export type OptionValueRow = {
  id: string;
  option: string;
  value: string;
  swatchColor: string;
  swatchImage: string;
  photos: number;
};

export type VariantRow = {
  id: string;
  /** Option value ids for option 1, 2 and 3 ("" = none). */
  optionIds: [string, string, string];
  sku: string;
  price: string;
  salePrice: string;
  stock: number;
  weightGrams: string;
  barcode: string;
};

// ── Option values ───────────────────────────────────────────────

/**
 * The values shoppers pick for each of the product type's options,
 * e.g. Size: S, M, L and Colour: Navy (with a swatch colour or picture).
 */
export function OptionsEditor({
  productId,
  optionNames,
  values,
}: {
  productId: string;
  optionNames: string[];
  values: OptionValueRow[];
}) {
  return (
    <div className="grid gap-6">
      {optionNames.map((option) => {
        const mine = values.filter((v) => v.option === option);
        return (
          <div key={option} className="grid gap-2">
            <h3 className="text-sm font-semibold">
              {option} <span className="font-normal text-muted-foreground">({mine.length})</span>
            </h3>
            {mine.map((v, i) => (
              <OptionValueForm
                key={`${v.id}-${v.value}-${v.swatchColor}-${v.swatchImage}`}
                productId={productId}
                option={option}
                value={v}
                order={mine.map((x) => x.id)}
                index={i}
              />
            ))}
            <OptionValueForm key={`new-${option}-${mine.length}`} productId={productId} option={option} />
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        The swatch colour (like #1f2a44) or picture shows on product cards, the product page and shop filters. Adding the
        first value of an option gives it to every existing variant.
      </p>
    </div>
  );
}

function OptionValueForm({
  productId,
  option,
  value,
  order,
  index = 0,
}: {
  productId: string;
  option: string;
  value?: OptionValueRow;
  /** Ids of this option's values in order (for the up/down arrows). */
  order?: string[];
  index?: number;
}) {
  const { state, onSubmit, pending } = useAdminForm(saveOptionValueAction);
  const [busy, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const [color, setColor] = useState(value?.swatchColor ?? "");
  const router = useRouter();
  const err = state?.fieldErrors ?? {};

  function move(to: number) {
    if (!order || !value || to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(index, 1);
    next.splice(to, 0, value.id);
    start(async () => {
      await reorderOptionValuesAction(productId, next);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_auto] sm:items-start",
        !value && "border-dashed",
        busy && "opacity-50",
      )}
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="option" value={option} />
      {value && <input type="hidden" name="id" value={value.id} />}
      <Cell error={err.value}>
        <input name="value" defaultValue={value?.value} required maxLength={60} placeholder={value ? "Value" : `New ${option.toLowerCase()}, e.g. ${option === "Size" ? "M" : "Navy"}`} aria-label={`${option} value`} className={inputClass} />
        {value && <span className="text-[0.7rem] text-muted-foreground">{value.photos} {value.photos === 1 ? "photo" : "photos"}</span>}
      </Cell>
      <Cell error={err.swatchColor}>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 rounded-full ring-1 ring-inset ring-black/15" style={{ background: /^#[0-9a-f]{6}$/i.test(color) ? color : "transparent" }} />
          <input name="swatchColor" value={color} onChange={(e) => setColor(e.target.value.trim())} maxLength={7} placeholder="#hex" aria-label="Swatch colour" className={cn(inputClass, "pl-8")} />
        </div>
      </Cell>
      <Cell error={err.swatchImage}>
        <input name="swatchImage" defaultValue={value?.swatchImage} maxLength={500} placeholder="Swatch picture URL (optional)" aria-label="Swatch picture URL" className={inputClass} />
      </Cell>
      <div className="flex items-center gap-1">
        <Button type="submit" disabled={pending} className="h-10 px-3 text-xs font-semibold">
          {pending ? <Loader2 className="animate-spin" /> : value ? "Save" : <><Plus className="size-3.5" /> Add</>}
        </Button>
        {value && order && (
          <>
            <button type="button" onClick={() => move(index - 1)} disabled={index === 0} aria-label="Move up" className="grid size-8 place-items-center rounded hover:bg-muted disabled:opacity-30">
              <ArrowUp className="size-4" />
            </button>
            <button type="button" onClick={() => move(index + 1)} disabled={index === order.length - 1} aria-label="Move down" className="grid size-8 place-items-center rounded hover:bg-muted disabled:opacity-30">
              <ArrowDown className="size-4" />
            </button>
            <DeleteButton
              label=""
              onConfirm={() =>
                start(async () => {
                  const r = await deleteOptionValueAction(value.id);
                  setProblem(r.error ?? null);
                  router.refresh();
                })
              }
            />
          </>
        )}
      </div>
      {(problem || state?.message || (state?.error && !state.fieldErrors)) && (
        <p className={cn("text-xs sm:col-span-4", problem || state?.error ? "text-destructive" : "text-emerald-700")}>
          {problem ?? state?.error ?? state?.message}
        </p>
      )}
    </form>
  );
}

// ── Variants ────────────────────────────────────────────────────

/**
 * One row per buyable combination of option values, each with its own SKU,
 * price, sale price, stock, weight and barcode. A product with no options
 * has a single variant.
 */
export function VariantsEditor({
  productId,
  optionNames,
  values,
  variants,
}: {
  productId: string;
  optionNames: string[];
  values: OptionValueRow[];
  variants: VariantRow[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  // Only options that have values on this product are picked per variant.
  const used = optionNames.map((name, slot) => ({ name, slot, values: values.filter((v) => v.option === name) })).filter((o) => o.values.length);
  const combos = used.reduce((n, o) => n * o.values.length, 1);
  const missing = used.length ? Math.max(0, combos - variants.length) : 0;
  const columns = `${used.map(() => "minmax(6.5rem,1fr)").join(" ")} minmax(7rem,1fr) 6rem 6rem 5rem 5.5rem minmax(7rem,1fr) 7.5rem`;

  return (
    <div className="grid gap-3">
      {missing > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
          <span>
            {missing} {missing === 1 ? "combination has" : "combinations have"} no variant yet.
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="h-8 gap-1.5 px-3 text-xs"
            onClick={() =>
              start(async () => {
                const r = await createMissingVariantsAction(productId);
                setNote(r.error ?? `${r.created} variants added — set their stock below.`);
                router.refresh();
              })
            }
          >
            {busy ? <Loader2 className="animate-spin" /> : <Wand2 className="size-3.5" />} Add them all
          </Button>
          <span className="text-xs text-muted-foreground">They copy the first variant&apos;s price, with 0 stock.</span>
        </div>
      )}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}

      <div className="overflow-x-auto">
        <div className="grid gap-2 md:min-w-max">
          <div className="hidden gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid" style={{ gridTemplateColumns: columns }}>
            {used.map((o) => (
              <span key={o.name}>{o.name}</span>
            ))}
            <span>SKU</span>
            <span>Price ($)</span>
            <span>Sale ($)</span>
            <span>Stock</span>
            <span>Weight (g)</span>
            <span>Barcode</span>
            <span />
          </div>
          {variants.map((v) => (
            <VariantForm key={JSON.stringify(v)} productId={productId} options={used} variant={v} columns={columns} canDelete={variants.length > 1} />
          ))}
          {/* With no options there's just the one variant. */}
          {used.length > 0 && <VariantForm key={`new-${variants.length}`} productId={productId} options={used} columns={columns} canDelete={false} />}
        </div>
      </div>
    </div>
  );
}

function VariantForm({
  productId,
  options,
  variant,
  columns,
  canDelete,
}: {
  productId: string;
  options: { name: string; slot: number; values: OptionValueRow[] }[];
  variant?: VariantRow;
  columns: string;
  canDelete: boolean;
}) {
  const { state, onSubmit, pending } = useAdminForm(saveVariantAction);
  const [deleting, startDelete] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const router = useRouter();
  const err = state?.fieldErrors ?? {};
  const isNew = !variant;

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "grid gap-2 rounded-lg border border-border p-3 md:items-start md:border-0 md:p-1 max-md:grid-cols-2!",
        isNew && "border-dashed md:border md:border-dashed md:p-2",
        deleting && "opacity-50",
      )}
      style={{ gridTemplateColumns: columns }}
    >
      <input type="hidden" name="productId" value={productId} />
      {variant && <input type="hidden" name="id" value={variant.id} />}
      {options.map((o) => (
        <Cell key={o.name} error={err[`option${o.slot + 1}Id`]}>
          <select name={`option${o.slot + 1}Id`} defaultValue={variant?.optionIds[o.slot] ?? ""} required aria-label={o.name} className={inputClass}>
            <option value="" disabled>
              {o.name}…
            </option>
            {o.values.map((v) => (
              <option key={v.id} value={v.id}>
                {v.value}
              </option>
            ))}
          </select>
        </Cell>
      ))}
      <Cell error={err.sku}>
        <input name="sku" defaultValue={variant?.sku} placeholder="SKU" aria-label="SKU" maxLength={60} className={cn(inputClass, "uppercase")} />
      </Cell>
      <Cell error={err.price}>
        <input name="price" defaultValue={variant?.price} required placeholder="Price" aria-label="Price" inputMode="decimal" className={inputClass} />
      </Cell>
      <Cell error={err.salePrice}>
        <input name="salePrice" defaultValue={variant?.salePrice} placeholder="—" aria-label="Sale price" inputMode="decimal" className={inputClass} />
      </Cell>
      <Cell error={err.stock}>
        <input name="stock" type="number" min={0} defaultValue={variant?.stock ?? 0} aria-label="Stock" className={inputClass} />
      </Cell>
      <Cell error={err.weightGrams}>
        <input name="weightGrams" type="number" min={0} defaultValue={variant?.weightGrams} placeholder="—" aria-label="Weight in grams" className={inputClass} />
      </Cell>
      <Cell error={err.barcode}>
        <input name="barcode" defaultValue={variant?.barcode} placeholder="—" aria-label="Barcode" maxLength={40} className={inputClass} />
      </Cell>
      <div className="flex items-center gap-1">
        <Button type="submit" disabled={pending} className="h-10 px-3 text-xs font-semibold">
          {pending ? <Loader2 className="animate-spin" /> : isNew ? <><Plus className="size-3.5" /> Add</> : "Save"}
        </Button>
        {variant && canDelete && (
          <DeleteButton
            label=""
            onConfirm={() =>
              startDelete(async () => {
                const r = await deleteVariantAction(variant.id);
                setProblem(r.error ?? null);
                router.refresh();
              })
            }
          />
        )}
      </div>
      {(problem || state?.message || (state?.error && !state.fieldErrors)) && (
        <p className={cn("col-span-full text-xs", problem || state?.error ? "text-destructive" : "text-emerald-700")}>
          {problem ?? state?.error ?? state?.message}
        </p>
      )}
    </form>
  );
}

function Cell({ error, children }: { error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
