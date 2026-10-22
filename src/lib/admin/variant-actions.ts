"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/dal";
import { MAX_OPTIONS, variantLabel } from "@/lib/product-types";
import { diff, recordChange } from "./activity";
import { fieldErrors, money, optionalMoney, optionalText, wholeNumber, type AdminFormState } from "./form";

/**
 * Admin actions for a product's options and variants.
 *
 *   Option values — the choices for each of the product type's options,
 *                   e.g. Size: S, M, L and Colour: Navy (with a swatch).
 *   Variants      — one per buyable combination (e.g. M + Navy) with its own
 *                   SKU, price, stock, weight and barcode.
 *
 * A product always keeps at least one variant.
 */

const id = z.string().min(1).max(64);
const invalid = (fields: Record<string, string>) => ({ error: "Please fix the highlighted fields.", fieldErrors: fields });

async function loadProduct(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: { productType: { select: { optionNames: true } }, optionValues: true, variants: true },
  });
}
type LoadedProduct = NonNullable<Awaited<ReturnType<typeof loadProduct>>>;

const slotsOf = (v: { option1Id: string | null; option2Id: string | null; option3Id: string | null }) => [
  v.option1Id,
  v.option2Id,
  v.option3Id,
];

/** "M / Navy" for a variant, from the product's option values. */
function labelFor(p: LoadedProduct, ids: (string | null)[]) {
  return variantLabel(ids.map((vid) => p.optionValues.find((v) => v.id === vid)?.value)) ?? "Default";
}

// ── Option values ───────────────────────────────────────────────

const optionValueSchema = z.object({
  productId: id,
  id: z.preprocess((v) => v || undefined, id.optional()),
  option: z.string().min(1).max(60),
  value: z.string().trim().min(1, "Enter a value, e.g. Navy or M").max(60),
  swatchColor: optionalText(7).refine((v) => v === null || /^#[0-9a-f]{6}$/i.test(v), "Use a colour like #1f2a44"),
  swatchImage: optionalText(500).refine((v) => v === null || /^https:\/\//.test(v), "Use an https:// image address"),
});

export async function saveOptionValueAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = await requireStaff();
  const parsed = optionValueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { productId, id: valueId, ...data } = parsed.data;

  const product = await loadProduct(productId);
  if (!product) return { error: "This product no longer exists." };
  const slot = product.productType.optionNames.indexOf(data.option);
  if (slot < 0 || slot >= MAX_OPTIONS) return { error: `${data.option} isn't an option of this product type.` };
  const clash = product.optionValues.find(
    (v) => v.option === data.option && v.value.toLowerCase() === data.value.toLowerCase() && v.id !== valueId,
  );
  if (clash) return invalid({ value: `This product already has ${data.option} "${clash.value}"` });

  if (valueId) {
    const before = product.optionValues.find((v) => v.id === valueId);
    if (!before) return { error: "This value no longer exists." };
    await prisma.productOptionValue.update({ where: { id: valueId }, data });
    await recordChange(user, {
      action: "product.option.update",
      entity: "Product",
      entityId: productId,
      detail: { name: product.name, option: data.option, value: data.value, changes: diff(before, data) },
    });
    return { message: `${data.value} saved.` };
  }

  const order = Math.max(-1, ...product.optionValues.filter((v) => v.option === data.option).map((v) => v.order)) + 1;
  const created = await prisma.productOptionValue.create({ data: { ...data, productId, order } });
  // Variants that don't have a value for this option yet (e.g. the first,
  // default variant) get this one — so adding "Gold" makes it the Gold variant.
  const slotField = (["option1Id", "option2Id", "option3Id"] as const)[slot];
  const filled = await prisma.productVariant.updateMany({ where: { productId, [slotField]: null }, data: { [slotField]: created.id } });
  await recordChange(user, {
    action: "product.option.create",
    entity: "Product",
    entityId: productId,
    detail: { name: product.name, option: data.option, value: data.value, variantsUpdated: filled.count },
  });
  return { message: `${data.value} added.` };
}

export async function deleteOptionValueAction(valueId: string): Promise<{ error?: string }> {
  const user = await requireStaff();
  const value = await prisma.productOptionValue.findUnique({ where: { id: id.parse(valueId) } });
  if (!value) return {};
  const product = (await loadProduct(value.productId))!;
  const using = product.variants.filter((v) => slotsOf(v).includes(value.id));
  const lastOfOption = product.optionValues.filter((v) => v.option === value.option).length === 1;

  if (lastOfOption) {
    // Removing the option altogether: variants simply stop having it (nothing is deleted).
    const slotField = (["option1Id", "option2Id", "option3Id"] as const)[product.productType.optionNames.indexOf(value.option)];
    if (slotField) await prisma.productVariant.updateMany({ where: { productId: product.id, [slotField]: value.id }, data: { [slotField]: null } });
  } else if (using.length === product.variants.length) {
    return { error: "Every variant uses this value — a product needs at least one variant. Add or change variants first." };
  }
  // Variants with this value are deleted with it; its photos become general photos.
  await prisma.productOptionValue.delete({ where: { id: value.id } });
  await recordChange(user, {
    action: "product.option.delete",
    entity: "Product",
    entityId: product.id,
    detail: { name: product.name, option: value.option, value: value.value, variantsDeleted: lastOfOption ? 0 : using.length },
  });
  return {};
}

/** Saves the order of one option's values (e.g. S, M, L, XL). */
export async function reorderOptionValuesAction(productId: string, orderedIds: string[]) {
  const user = await requireStaff();
  const pid = id.parse(productId);
  const ids = z.array(id).max(100).parse(orderedIds);
  const values = await prisma.productOptionValue.findMany({ where: { productId: pid, id: { in: ids } } });
  if (values.length !== ids.length || new Set(values.map((v) => v.option)).size > 1) {
    throw new Error("Values are out of date — reload the page");
  }
  await prisma.$transaction(ids.map((vid, order) => prisma.productOptionValue.update({ where: { id: vid }, data: { order } })));
  await recordChange(user, {
    action: "product.option.reorder",
    entity: "Product",
    entityId: pid,
    detail: { name: (await prisma.product.findUnique({ where: { id: pid }, select: { name: true } }))?.name, option: values[0]?.option },
  });
}

// ── Variants ────────────────────────────────────────────────────

const optionalId = z.preprocess((v) => v || null, id.nullable());

const variantSchema = z
  .object({
    productId: id,
    id: z.preprocess((v) => v || undefined, id.optional()),
    option1Id: optionalId,
    option2Id: optionalId,
    option3Id: optionalId,
    sku: optionalText(60).transform((v) => v?.toUpperCase() ?? null),
    price: money,
    salePrice: optionalMoney,
    stock: wholeNumber,
    weightGrams: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(0).max(1_000_000).nullable()),
    barcode: optionalText(40),
  })
  .refine((d) => d.salePrice === null || d.salePrice < d.price, {
    path: ["salePrice"],
    message: "Sale price must be lower than the price",
  });

/**
 * Checks a variant's option values: one for every option this product uses,
 * each belonging to the right option, and no other variant with the same mix.
 */
function checkOptions(p: LoadedProduct, slots: (string | null)[], exceptId?: string): Record<string, string> | null {
  const errors: Record<string, string> = {};
  p.productType.optionNames.slice(0, MAX_OPTIONS).forEach((name, i) => {
    const key = `option${i + 1}Id`;
    const used = p.optionValues.some((v) => v.option === name);
    const value = slots[i] ? p.optionValues.find((v) => v.id === slots[i]) : undefined;
    if (used && !slots[i]) errors[key] = `Choose a ${name}`;
    else if (slots[i] && value?.option !== name) errors[key] = `Choose a ${name}`;
  });
  if (Object.keys(errors).length) return errors;
  const twin = p.variants.find((v) => v.id !== exceptId && slotsOf(v).every((s, i) => s === slots[i]));
  if (twin) return { option1Id: `There's already a ${labelFor(p, slots)} variant` };
  return null;
}

export async function saveVariantAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = await requireStaff();
  const parsed = variantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { productId, id: variantId, ...data } = parsed.data;

  const product = await loadProduct(productId);
  if (!product) return { error: "This product no longer exists." };
  const slots = [data.option1Id, data.option2Id, data.option3Id];
  const optionErrors = checkOptions(product, slots, variantId);
  if (optionErrors) return invalid(optionErrors);
  if (data.sku && (await prisma.productVariant.findFirst({ where: { sku: data.sku, ...(variantId && { id: { not: variantId } }) } }))) {
    return invalid({ sku: "Another variant already uses this SKU" });
  }
  const label = labelFor(product, slots);

  if (variantId) {
    const before = product.variants.find((v) => v.id === variantId);
    if (!before) return { error: "This variant no longer exists." };
    await prisma.productVariant.update({ where: { id: variantId }, data });
    await recordChange(user, {
      action: "product.variant.update",
      entity: "Product",
      entityId: productId,
      detail: { name: product.name, variant: label, changes: diff(before, data) },
    });
    return { message: `${label} saved.` };
  }

  await prisma.productVariant.create({ data: { ...data, productId } });
  await recordChange(user, {
    action: "product.variant.create",
    entity: "Product",
    entityId: productId,
    detail: { name: product.name, variant: label },
  });
  return { message: `${label} added.` };
}

export async function deleteVariantAction(variantId: string): Promise<{ error?: string }> {
  const user = await requireStaff();
  const variant = await prisma.productVariant.findUnique({ where: { id: id.parse(variantId) } });
  if (!variant) return {};
  const product = (await loadProduct(variant.productId))!;
  if (product.variants.length === 1) return { error: "A product needs at least one variant." };
  await prisma.productVariant.delete({ where: { id: variant.id } });
  await recordChange(user, {
    action: "product.variant.delete",
    entity: "Product",
    entityId: product.id,
    detail: { name: product.name, variant: labelFor(product, slotsOf(variant)) },
  });
  return {};
}

/**
 * Adds a variant for every combination of option values that doesn't have
 * one yet (e.g. after adding size XL). New ones copy the first variant's
 * price and start with 0 stock.
 */
export async function createMissingVariantsAction(productId: string): Promise<{ error?: string; created?: number }> {
  const user = await requireStaff();
  const product = await loadProduct(id.parse(productId));
  if (!product) return { error: "This product no longer exists." };

  // Every combination of the values of the options this product uses.
  const perSlot = product.productType.optionNames.slice(0, MAX_OPTIONS).map((name) => {
    const values = product.optionValues.filter((v) => v.option === name).sort((a, b) => a.order - b.order);
    return values.length ? values.map((v) => v.id) : [null];
  });
  const combos = perSlot.reduce<(string | null)[][]>((acc, ids) => acc.flatMap((c) => ids.map((vid) => [...c, vid])), [[]]);
  const padded = (c: (string | null)[]) => [...c, null, null, null].slice(0, 3);
  const missing = combos.map(padded).filter((c) => !product.variants.some((v) => slotsOf(v).every((s, i) => s === c[i])));
  if (missing.length === 0) return { created: 0 };
  if (missing.length > 200) return { error: "That would create more than 200 variants — remove some values first." };

  const template = product.variants[0];
  await prisma.productVariant.createMany({
    data: missing.map((c) => ({
      productId: product.id,
      option1Id: c[0],
      option2Id: c[1],
      option3Id: c[2],
      price: template?.price ?? 0,
      salePrice: template?.salePrice ?? null,
      weightGrams: template?.weightGrams ?? null,
      stock: 0,
    })),
  });
  await recordChange(user, {
    action: "product.variant.create",
    entity: "Product",
    entityId: product.id,
    detail: { name: product.name, created: missing.length, variants: missing.map((c) => labelFor(product, c)) },
  });
  return { created: missing.length };
}
