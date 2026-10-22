"use client";

import { useState } from "react";
import Form from "next/form";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "cn";
import { PRICE_BUCKETS, SORTS, type Filters } from "@/lib/catalog-shared";
import type { FilterGroup } from "@/lib/catalog";

export const FILTER_FORM_ID = "shop-filters";

/** Re-runs the search as soon as any filter changes (the Apply button covers no-JS). */
function submitOnChange(e: React.FormEvent<HTMLFormElement>) {
  e.currentTarget.requestSubmit();
}

/**
 * Filters for a product listing. A plain GET form: every choice lives in the
 * URL, so filtered pages can be shared and the back button works.
 */
export function FilterForm({
  basePath,
  options,
  filters,
  activeCount,
  keep,
}: {
  basePath: string;
  options: FilterGroup[];
  filters: Filters;
  activeCount: number;
  /** Extra params to carry along, e.g. the search query. */
  keep?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const groups = (
    <>
      <Group title="Price">
        {[["", "Any price"] as const, ...Object.entries(PRICE_BUCKETS).map(([k, v]) => [k, v.label] as const)].map(
          ([value, label]) => (
            <Choice key={value || "any"} type="radio" name="price" value={value} checked={(filters.price ?? "") === value}>
              {label}
            </Choice>
          ),
        )}
      </Group>

      {/* One group per option (Size, Colour…) and filterable spec (Material…), from the product types. */}
      {options.map((group) => {
        const chosen = new Set((filters.attrs[group.key] ?? []).map((v) => v.toLowerCase()));
        return (
          <Group key={group.key} title={group.label}>
            {group.values.map((v) => (
              <Choice key={v.value} type="checkbox" name={group.key} value={v.value} checked={chosen.has(v.value.toLowerCase())}>
                {(v.color || v.image) && (
                  <span
                    className="size-3.5 shrink-0 rounded-full bg-cover bg-center ring-1 ring-inset ring-black/10"
                    style={{ background: v.image ? `center / cover url("${v.image}")` : (v.color ?? undefined) }}
                  />
                )}
                {v.value}
              </Choice>
            ))}
          </Group>
        );
      })}
    </>
  );

  return (
    <Form
      id={FILTER_FORM_ID}
      action={basePath}
      scroll={false}
      onChange={submitOnChange}
    >
      {Object.entries(keep ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      {/* Phones: a toggle opens the panel. Desktop: always-open sidebar. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="filter-groups"
        className="flex w-full items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-semibold lg:hidden"
      >
        <SlidersHorizontal className="size-4" />
        Filters{activeCount > 0 && ` (${activeCount})`}
      </button>
      <div
        // Re-mount the choices when the URL changes (e.g. Back) so they match the results.
        key={JSON.stringify(filters)}
        id="filter-groups"
        className={cn(
          "gap-5 rounded-lg border border-border p-4 lg:grid lg:gap-6 lg:border-0 lg:p-0",
          open ? "mt-3 grid" : "hidden",
        )}
      >
        {groups}
      </div>

      <noscript>
        <button type="submit" className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Apply filters
        </button>
      </noscript>
    </Form>
  );
}

/** Sort dropdown, attached to the filter form via the `form` attribute. */
export function SortSelect({ value, includeRelevance }: { value: string; includeRelevance?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sort</span>
      <select
        name="sort"
        form={FILTER_FORM_ID}
        defaultValue={value}
        key={value}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm font-medium"
      >
        {includeRelevance && <option value="relevance">Best match</option>}
        {Object.entries(SORTS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 font-heading text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Choice({
  type,
  name,
  value,
  checked,
  children,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={checked}
        className={cn("size-4 accent-brand-ink", type === "radio" && "rounded-full")}
      />
      {children}
    </label>
  );
}
