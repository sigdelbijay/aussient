"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "cn";
import { priceLabel, priceParam, SORTS, type Filters, type Sort } from "@/lib/catalog-shared";
import type { FilterGroup } from "@/lib/catalog";

export const FILTER_FORM_ID = "shop-filters";

/**
 * Filters for a product listing. A plain GET form: every choice lives in the
 * URL, so filtered pages can be shared and the back button works.
 */
export function FilterForm({
  basePath,
  options,
  filters,
  defaultSort,
  activeCount,
  keep,
}: {
  basePath: string;
  options: FilterGroup[];
  filters: Filters;
  /** The page's own order: not added to the URL. */
  defaultSort: Sort;
  activeCount: number;
  /** Extra params to carry along, e.g. the search query. */
  keep?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  /**
   * Re-runs the listing as soon as any filter changes. Only real choices go in
   * the URL: no empty "Any price" and no sort when it's the page's default.
   * (Without JavaScript the form still works as a normal GET form.)
   */
  function apply(form: HTMLFormElement) {
    const sp = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value !== "string" || value === "" || (key === "sort" && value === defaultSort)) continue;
      sp.append(key, value);
    }
    const qs = sp.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  }
  const price = filters.price ? priceParam(filters.price) : "";
  const groups = options.map((group) => {
    // Price: pick one range (radio). A range from a shared link that isn't offered here is still shown.
    if (group.key === "price") {
      const ranges = group.values.some((v) => v.value === price) || !filters.price
        ? group.values
        : [...group.values, { value: price, label: priceLabel(filters.price), count: 0, color: null, image: null }];
      return (
        <Group key="price" title={group.label}>
          <Choice type="radio" name="price" value="" checked={!price}>
            Any price
          </Choice>
          {ranges.map((v) => (
            <Choice key={v.value} type="radio" name="price" value={v.value} checked={price === v.value} count={v.count}>
              {v.label}
            </Choice>
          ))}
        </Group>
      );
    }

    // Brand, options (Size, Colour…) and filterable specs (Material…), built from the products shown.
    const chosen = new Set((filters.attrs[group.key] ?? []).map((v) => v.toLowerCase()));
    return (
      <Group key={group.key} title={group.label} wrap={group.display !== "list"}>
        {group.values.map((v) =>
          group.display === "list" ? (
            <Choice key={v.value} type="checkbox" name={group.key} value={v.value} checked={chosen.has(v.value.toLowerCase())} count={v.count}>
              {v.label}
            </Choice>
          ) : (
            <Chip key={v.value} name={group.key} value={v.value} checked={chosen.has(v.value.toLowerCase())} swatch={group.display === "swatch" ? v : null} />
          ),
        )}
      </Group>
    );
  });

  return (
    <form
      id={FILTER_FORM_ID}
      action={basePath}
      onChange={(e) => apply(e.currentTarget)}
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
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
    </form>
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

function Group({ title, wrap, children }: { title: string; wrap?: boolean; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 font-heading text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </legend>
      <div className={wrap ? "flex flex-wrap gap-2" : "grid max-h-64 gap-2 overflow-y-auto"}>{children}</div>
    </fieldset>
  );
}

/** A size button or colour swatch that works like a checkbox. */
function Chip({
  name,
  value,
  checked,
  swatch,
}: {
  name: string;
  value: string;
  checked: boolean;
  swatch: { color: string | null; image: string | null } | null;
}) {
  return (
    <label title={value} className="cursor-pointer">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      {swatch ? (
        <span
          className="block size-7 rounded-full bg-cover bg-center ring-1 ring-inset ring-black/15 transition-shadow peer-checked:ring-2 peer-checked:ring-foreground peer-checked:ring-offset-2 peer-checked:ring-offset-background peer-focus-visible:outline-2 peer-focus-visible:outline-ring"
          style={swatch.image ? { backgroundImage: `url("${swatch.image}")` } : { background: swatch.color ?? undefined }}
        >
          <span className="sr-only">{value}</span>
        </span>
      ) : (
        <span className="grid h-9 min-w-11 place-items-center rounded-md border border-border px-2.5 text-sm transition-colors peer-checked:border-foreground peer-checked:bg-foreground peer-checked:font-semibold peer-checked:text-background peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
          {value}
        </span>
      )}
    </label>
  );
}

function Choice({
  type,
  name,
  value,
  checked,
  count,
  children,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={checked}
        className={cn("size-4 shrink-0 accent-brand-ink", type === "radio" && "rounded-full")}
      />
      {children}
      {count !== undefined && count > 0 && <span className="ml-auto text-xs text-muted-foreground">{count}</span>}
    </label>
  );
}
