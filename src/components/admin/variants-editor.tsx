"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { deleteVariantAction, saveVariantAction } from "@/lib/admin/product-actions";
import { DeleteButton } from "./media-manager";
import { inputClass } from "./ui";
import { useAdminForm } from "./use-admin-form";

export type VariantRow = {
  id: string;
  name: string;
  sku: string;
  price: string;
  salePrice: string;
  stock: number;
  photos: number;
};

/** Finishes/colours: each with its own optional price, sale price, SKU and stock. */
export function VariantsEditor({
  productId,
  variants,
  productPrice,
}: {
  productId: string;
  variants: VariantRow[];
  productPrice: string;
}) {
  return (
    <div className="grid gap-3">
      <div className="hidden grid-cols-[1.4fr_1.2fr_1fr_1fr_0.8fr_auto] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
        <span>Finish</span>
        <span>SKU</span>
        <span>Price ($)</span>
        <span>Sale price ($)</span>
        <span>Stock</span>
        <span className="w-36" />
      </div>
      {variants.map((v) => (
        <VariantForm key={`${v.id}-${v.name}-${v.price}-${v.salePrice}-${v.stock}-${v.sku}`} productId={productId} variant={v} productPrice={productPrice} />
      ))}
      <VariantForm key={`new-${variants.length}`} productId={productId} productPrice={productPrice} />
      <p className="text-xs text-muted-foreground">
        Leave a finish&apos;s price blank to use the product price ({productPrice ? `$${productPrice}` : "set above"}). Assign photos
        to a finish in Photos &amp; videos.
      </p>
    </div>
  );
}

function VariantForm({ productId, variant, productPrice }: { productId: string; variant?: VariantRow; productPrice: string }) {
  const { state, onSubmit, pending } = useAdminForm(saveVariantAction);
  const [deleting, startDelete] = useTransition();
  const router = useRouter();
  const err = state?.fieldErrors ?? {};
  const isNew = !variant;

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[1.4fr_1.2fr_1fr_1fr_0.8fr_auto] md:items-start md:border-0 md:p-1",
        isNew && "border-dashed md:border md:border-dashed md:p-2",
        deleting && "opacity-50",
      )}
    >
      <input type="hidden" name="productId" value={productId} />
      {variant && <input type="hidden" name="id" value={variant.id} />}
      <Cell error={err.name}>
        <input name="name" defaultValue={variant?.name} placeholder={isNew ? "New finish, e.g. Gold" : "Name"} aria-label="Finish name" required maxLength={60} className={inputClass} />
        {variant && <span className="text-[0.7rem] text-muted-foreground">{variant.photos} {variant.photos === 1 ? "photo" : "photos"}</span>}
      </Cell>
      <Cell error={err.sku}>
        <input name="sku" defaultValue={variant?.sku} placeholder="SKU (optional)" aria-label="SKU" maxLength={60} className={cn(inputClass, "uppercase")} />
      </Cell>
      <Cell error={err.price}>
        <input name="price" defaultValue={variant?.price} placeholder={productPrice || "Same"} aria-label="Price" inputMode="decimal" className={inputClass} />
      </Cell>
      <Cell error={err.salePrice}>
        <input name="salePrice" defaultValue={variant?.salePrice} placeholder="—" aria-label="Sale price" inputMode="decimal" className={inputClass} />
      </Cell>
      <Cell error={err.stock}>
        <input name="stock" type="number" min={0} defaultValue={variant?.stock ?? 0} aria-label="Stock" className={inputClass} />
      </Cell>
      <div className="flex w-36 items-center gap-1">
        <Button type="submit" disabled={pending} className="h-10 px-3 text-xs font-semibold">
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : isNew ? (
            <>
              <Plus className="size-3.5" /> Add
            </>
          ) : (
            "Save"
          )}
        </Button>
        {variant && (
          <DeleteButton
            label=""
            onConfirm={() =>
              startDelete(async () => {
                await deleteVariantAction(variant.id);
                router.refresh();
              })
            }
          />
        )}
      </div>
      {(state?.message || (state?.error && !state.fieldErrors)) && (
        <p className={cn("text-xs md:col-span-6", state.error ? "text-destructive" : "text-emerald-700")}>{state.error ?? state.message}</p>
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
