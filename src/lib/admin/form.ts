import { z } from "zod";

/** What admin form actions return: an overall message/error plus per-field errors. */
export type AdminFormState =
  | { error?: string; message?: string; fieldErrors?: Record<string, string> }
  | undefined;

/** First error per field, for showing under each input. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    out[key] ??= issue.message;
  }
  return { error: "Please fix the highlighted fields.", fieldErrors: out };
}

// ── Reusable field parsers (form values arrive as strings) ──────

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional()).transform((v) => v ?? null);

export const money = z
  .string("Enter a price")
  .trim()
  .regex(/^\d{1,6}(\.\d{1,2})?$/, "Enter a price like 24.95")
  .transform(Number);

export const optionalMoney = z.preprocess(blankToUndefined, money.optional()).transform((v) => v ?? null);

export const wholeNumber = z.preprocess(
  (v) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? "0" : v),
  z.coerce.number("Enter a whole number").int("Enter a whole number").min(0, "Can't be negative").max(1_000_000),
);

/** HTML checkboxes send "on" when ticked and nothing when not. */
export const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true" || v === "1");
