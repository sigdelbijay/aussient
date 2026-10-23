import { z } from "zod";

/**
 * Product types, specs and options — shared by the shop, the bag and the admin.
 *
 * A ProductType (e.g. "Watch") lists:
 *   - optionNames: what shoppers pick, e.g. ["Strap colour"] (up to 3)
 *   - specFields:  facts every product of that type has, e.g. "Case size" in mm
 * A Product stores its spec values as JSON keyed by the field label:
 *   { "Movement": "Quartz", "Case size": 38, "Water resistance": true }
 */

export const MAX_OPTIONS = 3;

export const SPEC_KINDS = {
  text: "Text",
  number: "Number",
  "yes-no": "Yes / no",
  pick: "Pick from list",
} as const;
export type SpecKind = keyof typeof SPEC_KINDS;

export type SpecField = {
  label: string;
  kind: SpecKind;
  /** The list to pick from (kind "pick" only). */
  choices?: string[];
  /** Shown after the value, e.g. "mm". */
  unit?: string;
  /** Show this spec as a filter on shop pages. */
  filterable?: boolean;
};

export type SpecValue = string | number | boolean;
export type Specs = Record<string, SpecValue>;

const specFieldSchema = z.object({
  label: z.string().trim().min(1).max(60),
  kind: z.enum(["text", "number", "yes-no", "pick"]),
  choices: z.array(z.string().trim().min(1).max(60)).max(100).optional(),
  unit: z.string().trim().max(20).optional(),
  filterable: z.boolean().optional(),
});

/** The spec fields stored on a product type (bad or missing data → no fields). */
export function readSpecFields(json: unknown): SpecField[] {
  const parsed = z.array(specFieldSchema).safeParse(json);
  return parsed.success ? parsed.data : [];
}

/** A product's spec values (anything that isn't text, a number or yes/no is ignored). */
export function readSpecs(json: unknown): Specs {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const specs: Specs = {};
  for (const [label, value] of Object.entries(json)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") specs[label] = value;
  }
  return specs;
}

/** A spec value as shoppers read it, e.g. "38 mm", "Yes". */
export function formatSpec(field: SpecField, value: SpecValue): string {
  if (field.kind === "yes-no") return value === true ? "Yes" : "No";
  return field.unit ? `${value} ${field.unit}` : String(value);
}

/**
 * Reads one spec from an admin form field (always a string) for its kind.
 * Returns undefined for blank, or { error } when it doesn't fit.
 */
export function parseSpecInput(field: SpecField, raw: string | undefined): SpecValue | undefined | { error: string } {
  const text = (raw ?? "").trim();
  switch (field.kind) {
    case "yes-no":
      // Checkbox: "on" when ticked, missing when not.
      return text === "on" || text === "true" || /^(y|yes|1)$/i.test(text);
    case "number": {
      if (!text) return undefined;
      const n = Number(text.replace(/,/g, ""));
      return Number.isFinite(n) ? n : { error: `${field.label} must be a number` };
    }
    case "pick": {
      if (!text) return undefined;
      const match = field.choices?.find((c) => c.toLowerCase() === text.toLowerCase());
      return match ?? { error: `${field.label} must be one of: ${(field.choices ?? []).join(", ")}` };
    }
    default:
      return text ? text.slice(0, 200) : undefined;
  }
}

/** A variant's name from its option values, e.g. "M / Navy" (null for a product with no options). */
export function variantLabel(values: (string | null | undefined)[]): string | null {
  const parts = values.filter((v): v is string => !!v);
  return parts.length ? parts.join(" / ") : null;
}

/** The URL name for a filter, e.g. "Strap colour" → "strap-colour" (?strap-colour=Black). */
export const filterKey = (label: string) =>
  label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** What a shopper pays for a variant: the sale price when it's lower. */
export function paidPrice(v: { price: number; salePrice: number | null }) {
  return v.salePrice !== null && v.salePrice < v.price ? v.salePrice : v.price;
}

/** A size guide's table: column headings and rows of cells. */
export type SizeTable = { columns: string[]; rows: string[][] };

export function readSizeTable(json: unknown): SizeTable {
  const parsed = z
    .object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) })
    .safeParse(json);
  return parsed.success ? parsed.data : { columns: [], rows: [] };
}
