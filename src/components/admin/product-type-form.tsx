"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, X } from "lucide-react";
import { FormAlert } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import type { AdminFormState } from "@/lib/admin/form";
import { deleteProductTypeAction, saveProductTypeAction } from "@/lib/admin/type-actions";
import { MAX_OPTIONS, SPEC_KINDS, type SpecField, type SpecKind } from "@/lib/product-types";
import { DeleteButton } from "./media-manager";
import { AdminField, inputClass, Panel } from "./ui";

export type ProductTypeValues = {
  id: string | null;
  name: string;
  optionNames: string[];
  specFields: SpecField[];
  sizeGuideId: string | null;
};

/** `from` remembers each name as loaded, so a rename also renames it on the type's products. */
type OptionRow = { key: number; name: string; from: string | null };
type SpecRow = { key: number; from: string | null; label: string; kind: SpecKind; choices: string; unit: string; filterable: boolean };

let nextKey = 1;

/**
 * Create / edit a product type: the options shoppers pick (up to 3), the spec
 * fields every product of the type has, and its size guide.
 */
export function ProductTypeForm({
  values,
  sizeGuides,
  productCount,
  usedOptions,
}: {
  values: ProductTypeValues;
  sizeGuides: { id: string; name: string }[];
  /** How many products are this type. */
  productCount: number;
  /** Options that products already have values for (can be renamed, not removed or moved). */
  usedOptions: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<AdminFormState>();
  const [name, setName] = useState(values.name);
  const [sizeGuideId, setSizeGuideId] = useState(values.sizeGuideId ?? "");
  const [options, setOptions] = useState<OptionRow[]>(() => values.optionNames.map((n) => ({ key: nextKey++, name: n, from: n })));
  const [specs, setSpecs] = useState<SpecRow[]>(() =>
    values.specFields.map((f) => ({
      key: nextKey++,
      from: f.label,
      label: f.label,
      kind: f.kind,
      choices: (f.choices ?? []).join(", "),
      unit: f.unit ?? "",
      filterable: !!f.filterable,
    })),
  );
  const err = (k: string) => state?.fieldErrors?.[k];
  const isUsed = (o: OptionRow) => !!o.from && usedOptions.includes(o.from);

  function save() {
    start(async () => {
      // Creating redirects to the new type's page; saving stays here.
      const result = await saveProductTypeAction({
        id: values.id,
        name,
        options: options.map((o) => ({ name: o.name, from: o.from })),
        specFields: specs.map((f) => ({
          from: f.from,
          label: f.label,
          kind: f.kind,
          choices: f.choices.split(",").map((c) => c.trim()).filter(Boolean),
          unit: f.unit,
          filterable: f.filterable,
        })),
        sizeGuideId: sizeGuideId || null,
      });
      setState(result);
      if (!result?.error) router.refresh();
    });
  }

  const moveSpec = (i: number, to: number) =>
    setSpecs((list) => {
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [row] = next.splice(i, 1);
      next.splice(to, 0, row);
      return next;
    });
  const editSpec = (key: number, patch: Partial<SpecRow>) => setSpecs((list) => list.map((f) => (f.key === key ? { ...f, ...patch } : f)));

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
          <Panel title="Name">
            <AdminField label="Product type" error={err("name")} hint="What kind of product this is, e.g. Sunglasses, Watch, T-shirt.">
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} className={inputClass} aria-invalid={!!err("name")} />
            </AdminField>
          </Panel>

          <Panel
            title="Options shoppers pick"
            description={`Up to ${MAX_OPTIONS}, e.g. Size, Colour, Strap. Each product adds its own values (S, M, L…) and gets one variant per combination.`}
          >
            <div className="grid gap-2">
              {options.length === 0 && <p className="text-sm text-muted-foreground">No options — each product is sold as one item.</p>}
              {options.map((o, i) => (
                <div key={o.key} className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-sm text-muted-foreground">{i + 1}.</span>
                    <input
                      value={o.name}
                      onChange={(e) => setOptions((list) => list.map((x) => (x.key === o.key ? { ...x, name: e.target.value } : x)))}
                      placeholder={["Size", "Colour", "Strap"][i]}
                      maxLength={40}
                      aria-label={`Option ${i + 1} name`}
                      aria-invalid={!!err(`option${i}`)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setOptions((list) => list.filter((x) => x.key !== o.key))}
                      disabled={isUsed(o)}
                      title={isUsed(o) ? "Products have values for this option — remove them from those products first" : "Remove"}
                      aria-label={`Remove option ${o.name}`}
                      className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  {err(`option${i}`) && <p className="ml-8 text-xs text-destructive">{err(`option${i}`)}</p>}
                  {isUsed(o) && o.from !== o.name && o.name && (
                    <p className="ml-8 text-xs text-muted-foreground">Renames “{o.from}” to “{o.name}” on every {name || "product"} product.</p>
                  )}
                </div>
              ))}
              {err("options") && <p className="text-xs text-destructive">{err("options")}</p>}
              {options.length < MAX_OPTIONS && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-fit gap-1.5 px-3"
                  onClick={() => setOptions((list) => [...list, { key: nextKey++, name: "", from: null }])}
                >
                  <Plus className="size-4" /> Add option
                </Button>
              )}
            </div>
          </Panel>

          <Panel title="Spec fields" description="Facts every product of this type has. They show in the product page's Specifications table; tick “Shop filter” to filter by them.">
            <div className="grid gap-3">
              {specs.length === 0 && <p className="text-sm text-muted-foreground">No spec fields yet.</p>}
              {specs.map((f, i) => (
                <div key={f.key} className="grid gap-3 rounded-lg border border-border p-3">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_7rem]">
                    <AdminField label="Label" error={err(`spec${i}`)}>
                      <input value={f.label} onChange={(e) => editSpec(f.key, { label: e.target.value })} placeholder="e.g. Lens colour" maxLength={60} className={inputClass} aria-invalid={!!err(`spec${i}`)} />
                    </AdminField>
                    <AdminField label="Kind">
                      <select value={f.kind} onChange={(e) => editSpec(f.key, { kind: e.target.value as SpecKind })} className={inputClass}>
                        {Object.entries(SPEC_KINDS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </AdminField>
                    <AdminField label="Unit" hint="e.g. mm, g">
                      <input value={f.unit} onChange={(e) => editSpec(f.key, { unit: e.target.value })} disabled={f.kind === "yes-no"} maxLength={20} className={inputClass} />
                    </AdminField>
                  </div>
                  {f.kind === "pick" && (
                    <AdminField label="Choices" hint="Separate with commas, e.g. Black, Brown, Tortoiseshell">
                      <input value={f.choices} onChange={(e) => editSpec(f.key, { choices: e.target.value })} className={inputClass} />
                    </AdminField>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={f.filterable} onChange={(e) => editSpec(f.key, { filterable: e.target.checked })} className="size-4 accent-brand-ink" />
                      Shop filter
                    </label>
                    <div className="flex items-center gap-1">
                      {f.from && f.from !== f.label && f.label && productCount > 0 && (
                        <span className="mr-2 text-xs text-muted-foreground">Renames it on {productCount} products</span>
                      )}
                      <button type="button" onClick={() => moveSpec(i, i - 1)} disabled={i === 0} aria-label="Move up" className="grid size-8 place-items-center rounded hover:bg-muted disabled:opacity-30">
                        <ArrowUp className="size-4" />
                      </button>
                      <button type="button" onClick={() => moveSpec(i, i + 1)} disabled={i === specs.length - 1} aria-label="Move down" className="grid size-8 place-items-center rounded hover:bg-muted disabled:opacity-30">
                        <ArrowDown className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpecs((list) => list.filter((x) => x.key !== f.key))}
                        className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {err("specFields") && <p className="text-xs text-destructive">{err("specFields")}</p>}
              <Button
                type="button"
                variant="outline"
                className="h-9 w-fit gap-1.5 px-3"
                onClick={() => setSpecs((list) => [...list, { key: nextKey++, from: null, label: "", kind: "text", choices: "", unit: "", filterable: false }])}
              >
                <Plus className="size-4" /> Add spec field
              </Button>
            </div>
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Size guide">
            <AdminField label="Size guide" error={err("sizeGuideId")} hint="Opens from a “Size guide” link on the product page.">
              <select value={sizeGuideId} onChange={(e) => setSizeGuideId(e.target.value)} className={inputClass}>
                <option value="">None</option>
                {sizeGuides.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </AdminField>
          </Panel>

          <Button type="submit" size="lg" disabled={pending} className="h-11 w-full font-semibold">
            {pending && <Loader2 className="animate-spin" />}
            {values.id ? "Save product type" : "Create product type"}
          </Button>

          {values.id && <DeleteType id={values.id} name={values.name} productCount={productCount} />}
        </div>
      </div>
    </form>
  );
}

/** Products can't be left without a type, so deleting only works once none use it. */
function DeleteType({ id, name, productCount }: { id: string; name: string; productCount: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (productCount > 0) {
    return (
      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
        {productCount} {productCount === 1 ? "product is" : "products are"} {name}, so this type can&apos;t be deleted. Change their type or delete them first.
      </p>
    );
  }
  return (
    <div className="grid justify-items-start gap-1">
      <DeleteButton
        label="Delete product type"
        onConfirm={() =>
          start(async () => {
            const r = await deleteProductTypeAction(id);
            if (r.error) setError(r.error);
            else router.push("/admin/product-types");
          })
        }
      />
      {pending && <Loader2 className="size-4 animate-spin" />}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
