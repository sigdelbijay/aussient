"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/dal";
import { MAX_OPTIONS, readSpecFields, readSpecs, type SpecField } from "@/lib/product-types";
import { diff, recordChange } from "./activity";
import type { AdminFormState } from "./form";

/**
 * Admin actions for product types and size guides. Each is logged and
 * refreshes the cached shop pages.
 *
 * Products store their option values by option NAME and their specs by spec
 * LABEL, so renaming either here also renames it on every product of the type.
 */

const id = z.string().min(1).max(64);
const invalid = (fields: Record<string, string>): AdminFormState => ({ error: "Please fix the highlighted fields.", fieldErrors: fields });

// ── Product types ───────────────────────────────────────────────

/** `from` = the name it had when the form loaded (null for a new one), so renames can be followed. */
const typeInput = z.object({
  id: id.nullable(),
  name: z.string().trim().max(60),
  options: z.array(z.object({ name: z.string().trim().max(40), from: z.string().nullable() })).max(MAX_OPTIONS),
  specFields: z
    .array(
      z.object({
        from: z.string().nullable(),
        label: z.string().trim().max(60),
        kind: z.enum(["text", "number", "yes-no", "pick"]),
        choices: z.array(z.string().trim().max(60)).max(100),
        unit: z.string().trim().max(20),
        filterable: z.boolean(),
      }),
    )
    .max(40),
  sizeGuideId: id.nullable(),
});
export type ProductTypeInput = z.infer<typeof typeInput>;

const hasRepeat = (list: string[]) => new Set(list.map((x) => x.toLowerCase())).size !== list.length;

export async function saveProductTypeAction(input: ProductTypeInput): Promise<AdminFormState> {
  const user = await requireStaff();
  const data = typeInput.parse(input);
  const errors: Record<string, string> = {};

  if (!data.name) errors.name = "Enter a name, e.g. Sunglasses";
  else if (await prisma.productType.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, ...(data.id && { id: { not: data.id } }) } })) {
    errors.name = "Another product type has this name";
  }
  const optionNames = data.options.map((o) => o.name);
  data.options.forEach((o, i) => {
    if (!o.name) errors[`option${i}`] = "Enter a name, e.g. Size";
  });
  if (hasRepeat(optionNames)) errors.options = "Each option needs a different name";

  const specFields: SpecField[] = data.specFields.map((f) => ({
    label: f.label,
    kind: f.kind,
    ...(f.kind === "pick" && { choices: [...new Set(f.choices.filter(Boolean))] }),
    ...(f.unit && f.kind !== "yes-no" && { unit: f.unit }),
    ...(f.filterable && { filterable: true }),
  }));
  specFields.forEach((f, i) => {
    if (!f.label) errors[`spec${i}`] = "Enter a label, e.g. Lens colour";
    else if (f.kind === "pick" && !f.choices?.length) errors[`spec${i}`] = "Add at least one choice to pick from";
  });
  if (hasRepeat(specFields.map((f) => f.label))) errors.specFields = "Each spec field needs a different label";
  if (data.sizeGuideId && !(await prisma.sizeGuide.findUnique({ where: { id: data.sizeGuideId } }))) {
    errors.sizeGuideId = "That size guide no longer exists";
  }
  if (Object.keys(errors).length) return invalid(errors);

  if (!data.id) {
    const type = await prisma.productType.create({
      data: { name: data.name, optionNames, specFields: specFields as Prisma.InputJsonValue, sizeGuideId: data.sizeGuideId },
    });
    await recordChange(user, {
      action: "productType.create",
      entity: "ProductType",
      entityId: type.id,
      detail: { name: type.name, options: optionNames, specs: specFields.map((f) => f.label) },
    });
    redirect(`/admin/product-types/${type.id}?created=1`);
  }

  const before = await prisma.productType.findUnique({ where: { id: data.id } });
  if (!before) return { error: "This product type no longer exists." };
  const productIds = (await prisma.product.findMany({ where: { productTypeId: before.id }, select: { id: true } })).map((p) => p.id);

  // Options in use can be renamed, but not removed or moved: variants store
  // their values by position (1st, 2nd, 3rd option).
  const used = new Set(
    (
      await prisma.productOptionValue.groupBy({ by: ["option"], where: { productId: { in: productIds } } })
    ).map((g) => g.option),
  );
  const renames: [string, string][] = [];
  for (const [oldSlot, oldName] of before.optionNames.entries()) {
    const newSlot = data.options.findIndex((o) => o.from === oldName);
    if (!used.has(oldName)) continue;
    if (newSlot < 0) return { error: `Products still have ${oldName} values — remove them from those products before removing the option.` };
    if (newSlot !== oldSlot) return { error: `${oldName} is used by products, so it can't change position. Rename options instead of moving them.` };
    if (data.options[newSlot].name !== oldName) renames.push([oldName, data.options[newSlot].name]);
  }

  // Spec labels renamed here are renamed in every product's specs too.
  const specRenames = data.specFields
    .filter((f) => f.from !== null && f.from !== f.label)
    .map((f) => [f.from!, f.label] as const);

  await prisma.$transaction(async (tx) => {
    await tx.productType.update({
      where: { id: before.id },
      data: { name: data.name, optionNames, specFields: specFields as Prisma.InputJsonValue, sizeGuideId: data.sizeGuideId },
    });
    for (const [from, to] of renames) {
      await tx.productOptionValue.updateMany({ where: { productId: { in: productIds }, option: from }, data: { option: to } });
    }
    if (specRenames.length) {
      const products = await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, specs: true } });
      for (const p of products) {
        const specs = readSpecs(p.specs);
        let changed = false;
        for (const [from, to] of specRenames) {
          if (from in specs) {
            specs[to] = specs[from];
            delete specs[from];
            changed = true;
          }
        }
        if (changed) await tx.product.update({ where: { id: p.id }, data: { specs } });
      }
    }
  });

  await recordChange(user, {
    action: "productType.update",
    entity: "ProductType",
    entityId: before.id,
    detail: {
      name: data.name,
      changes: diff(
        { name: before.name, options: before.optionNames.join(", "), specs: JSON.stringify(readSpecFields(before.specFields)), sizeGuideId: before.sizeGuideId },
        { name: data.name, options: optionNames.join(", "), specs: JSON.stringify(specFields), sizeGuideId: data.sizeGuideId },
      ),
      ...(renames.length && { renamedOptions: renames }),
      ...(specRenames.length && { renamedSpecs: specRenames }),
    },
  });
  return { message: `${data.name} saved.` };
}

/** Deleting is only allowed once no product uses the type. */
export async function deleteProductTypeAction(typeId: string): Promise<{ error?: string }> {
  const user = await requireStaff();
  const type = await prisma.productType.findUnique({
    where: { id: id.parse(typeId) },
    include: { _count: { select: { products: true } } },
  });
  if (!type) return {};
  if (type._count.products > 0) {
    return { error: `${type._count.products} products are ${type.name}. Change their type or delete them first.` };
  }
  await prisma.productType.delete({ where: { id: type.id } });
  await recordChange(user, { action: "productType.delete", entity: "ProductType", entityId: type.id, detail: { name: type.name } });
  return {};
}

// ── Size guides ─────────────────────────────────────────────────

const guideInput = z.object({
  id: id.nullable(),
  name: z.string().trim().max(60),
  notes: z.string().trim().max(500),
  columns: z.array(z.string().trim().max(40)).max(12),
  rows: z.array(z.array(z.string().trim().max(40)).max(12)).max(60),
});
export type SizeGuideInput = z.infer<typeof guideInput>;

export async function saveSizeGuideAction(input: SizeGuideInput): Promise<AdminFormState> {
  const user = await requireStaff();
  const data = guideInput.parse(input);
  if (!data.name) return invalid({ name: "Enter a name, e.g. T-shirt sizes" });
  if (data.columns.length === 0 || data.columns.some((c) => !c)) return invalid({ table: "Give every column a heading" });
  // Drop empty rows; pad or trim each row to the number of columns.
  const rows = data.rows
    .filter((r) => r.some(Boolean))
    .map((r) => data.columns.map((_, i) => r[i] ?? ""));
  if (rows.length === 0) return invalid({ table: "Add at least one row" });
  const values = { name: data.name, notes: data.notes || null, table: { columns: data.columns, rows } };

  if (!data.id) {
    const guide = await prisma.sizeGuide.create({ data: values });
    await recordChange(user, { action: "sizeGuide.create", entity: "SizeGuide", entityId: guide.id, detail: { name: guide.name } });
    redirect(`/admin/size-guides/${guide.id}?created=1`);
  }
  const before = await prisma.sizeGuide.findUnique({ where: { id: data.id } });
  if (!before) return { error: "This size guide no longer exists." };
  await prisma.sizeGuide.update({ where: { id: before.id }, data: values });
  await recordChange(user, {
    action: "sizeGuide.update",
    entity: "SizeGuide",
    entityId: before.id,
    detail: { name: data.name, changes: diff({ ...before, table: JSON.stringify(before.table) }, { ...values, table: JSON.stringify(values.table) }) },
  });
  return { message: `${data.name} saved.` };
}

/** Product types using it simply stop showing a size guide. */
export async function deleteSizeGuideAction(guideId: string) {
  const user = await requireStaff();
  const guide = await prisma.sizeGuide.delete({ where: { id: id.parse(guideId) } });
  await recordChange(user, { action: "sizeGuide.delete", entity: "SizeGuide", entityId: guide.id, detail: { name: guide.name } });
  redirect("/admin/size-guides");
}
