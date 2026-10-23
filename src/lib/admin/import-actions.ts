"use server";

import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/dal";
import { MAX_OPTIONS, parseSpecInput, readSpecFields, readSpecs, type Specs } from "@/lib/product-types";
import { recordChange } from "./activity";
import { parseCsvObjects } from "./csv";
import { money } from "./form";
import { slugify } from "./slug";

/**
 * CSV import, in the same format as the export: one row per variant, rows
 * with the same slug (or name) are one product. Existing products (same slug)
 * are updated, new ones created. Nothing is deleted.
 */

export type ImportState = { error?: string; created?: number; updated?: number; problems?: string[] } | undefined;

const yes = (v: string | undefined) => /^(1|y|yes|true|live)$/i.test(v ?? "");
const csvMoney = (v: string | undefined) => (v ? money.safeParse(v.replace(/^\$/, "")) : null);
const list = (v: string | undefined) => (v ?? "").split("|").map((x) => x.trim()).filter(Boolean);
const wholeOrNull = (v: string | undefined) => (v && /^\d+$/.test(v.trim()) ? Number(v) : null);

export async function importProductsAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireStaff();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to import." };
  if (file.size > 2_000_000) return { error: "That file is too big (2 MB max)." };

  const rows = parseCsvObjects(await file.text());
  if (rows.length === 0) return { error: "The file has no product rows." };
  if (!("name" in rows[0]) || !("price" in rows[0])) {
    return { error: "The first row must be the column names, including at least name and price. Export first to see the format." };
  }

  // Rows with the same slug (or name) are one product with several variants.
  const groups = new Map<string, { line: number; row: Record<string, string> }[]>();
  rows.forEach((row, i) => {
    const key = slugify(row.slug || row.name || "");
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), { line: i + 2, row }]);
  });

  const [categories, types] = await Promise.all([
    prisma.category.findMany({ select: { id: true, slug: true, name: true } }),
    prisma.productType.findMany(),
  ]);
  const findCategory = (v: string) => categories.find((c) => c.slug === slugify(v) || c.name.toLowerCase() === v.toLowerCase());
  const findType = (v: string) => types.find((t) => t.name.toLowerCase() === v.trim().toLowerCase());

  let created = 0;
  let updated = 0;
  const problems: string[] = [];

  for (const [slug, lines] of groups) {
    const { line, row } = lines[0];
    const label = `Row ${line} (${row.name || slug})`;
    if (!row.name) { problems.push(`${label}: missing name`); continue; }

    const existing = await prisma.product.findUnique({
      where: { slug },
      include: { media: { select: { url: true } }, _count: { select: { optionValues: true } } },
    });
    const type = row.type ? findType(row.type) : types.find((t) => t.id === existing?.productTypeId);
    if (!type) { problems.push(`${label}: unknown product type "${row.type ?? ""}" (add it first, or check the spelling)`); continue; }
    if (existing && existing.productTypeId !== type.id && existing._count.optionValues > 0) {
      problems.push(`${label}: can't change the type of a product that has options`);
      continue;
    }

    const categoryNames = list(row.categories ?? row.category);
    const found = categoryNames.map(findCategory);
    if (found.some((c) => !c)) { problems.push(`${label}: unknown category in "${categoryNames.join(" | ")}"`); continue; }

    // Specs: a "spec:<label>" column sets that spec (blank clears it); missing columns keep what's there.
    const specs: Specs = existing ? readSpecs(existing.specs) : {};
    const specProblems: string[] = [];
    for (const field of readSpecFields(type.specFields)) {
      const column = `spec:${field.label.toLowerCase()}`;
      if (!(column in row)) continue;
      const value = parseSpecInput(field, row[column]);
      if (value && typeof value === "object") specProblems.push(value.error);
      else if (value === undefined) delete specs[field.label];
      else specs[field.label] = value;
    }
    if (specProblems.length) { problems.push(`${label}: ${specProblems.join("; ")}`); continue; }

    const data = {
      name: row.name.slice(0, 120),
      productTypeId: type.id,
      specs,
      tags: list(row.tags).map((t) => t.toLowerCase().slice(0, 40)),
      featured: yes(row.featured),
      status: yes(row.status) ? ("LIVE" as const) : ("DRAFT" as const),
      description: row.description || null,
      details: row.details || null,
      care: row.care || null,
      seoTitle: row.seo_title || null,
      seoDescription: row.seo_description || null,
      ...(categoryNames.length && { categories: { set: found.map((c) => ({ id: c!.id })) } }),
    };

    try {
      await prisma.$transaction(async (tx) => {
        // Brands are matched by name and created when new.
        const brandName = row.brand?.trim();
        const brand = brandName
          ? ((await tx.brand.findFirst({ where: { name: { equals: brandName, mode: "insensitive" } } })) ??
            (await tx.brand.create({ data: { name: brandName.slice(0, 80), slug: slugify(brandName) } })))
          : null;

        const product = existing
          ? await tx.product.update({ where: { id: existing.id }, data: { ...data, brandId: brand?.id ?? null } })
          : await tx.product.create({
              data: { ...data, slug, brandId: brand?.id ?? null, categories: { connect: found.map((c) => ({ id: c!.id })) } },
            });

        // New photo URLs (separated by |) are added after the existing ones.
        const have = new Set(existing?.media.map((m) => m.url));
        const urls = list(row.images).filter((u) => /^https:\/\//.test(u) && !have.has(u));
        if (urls.length) {
          const last = await tx.productMedia.aggregate({ where: { productId: product.id }, _max: { order: true } });
          await tx.productMedia.createMany({
            data: urls.map((url, i) => ({
              productId: product.id,
              url,
              type: /\/video\/|\.(mp4|mov|webm)$/i.test(url) ? ("VIDEO" as const) : ("IMAGE" as const),
              order: (last._max.order ?? -1) + 1 + i,
            })),
          });
        }

        // Variants: one per row, matched by SKU, then by their option values.
        const optionNames = type.optionNames.slice(0, MAX_OPTIONS);
        for (const { line: vLine, row: v } of lines) {
          const price = csvMoney(v.price);
          const sale = csvMoney(v.sale_price);
          if (!price?.success) throw new Error(`Row ${vLine}: price must be a number like 24.95`);
          if (sale && !sale.success) throw new Error(`Row ${vLine}: sale_price must be a number like 19.95`);
          const salePrice = sale?.success ? sale.data : null;
          if (salePrice !== null && salePrice >= price.data) throw new Error(`Row ${vLine}: sale_price must be lower than price`);

          // Option values (e.g. option1 = "M", option2 = "Navy"), created when new.
          const slots: (string | null)[] = [null, null, null];
          for (const [i, option] of optionNames.entries()) {
            const value = v[`option${i + 1}`]?.trim().slice(0, 60);
            if (!value) {
              if (await tx.productOptionValue.count({ where: { productId: product.id, option } })) {
                throw new Error(`Row ${vLine}: option${i + 1} (${option}) is needed — this product has ${option} values`);
              }
              continue;
            }
            const match =
              (await tx.productOptionValue.findFirst({ where: { productId: product.id, option, value: { equals: value, mode: "insensitive" } } })) ??
              (await tx.productOptionValue.create({
                data: { productId: product.id, option, value, order: await tx.productOptionValue.count({ where: { productId: product.id, option } }) },
              }));
            slots[i] = match.id;
          }

          const vData = {
            option1Id: slots[0],
            option2Id: slots[1],
            option3Id: slots[2],
            sku: v.sku?.toUpperCase() || null,
            price: price.data,
            salePrice,
            stock: Math.max(0, Number.parseInt(v.stock || "0", 10) || 0),
            weightGrams: wholeOrNull(v.weight_grams),
            barcode: v.barcode?.trim().slice(0, 40) || null,
          };
          const variants = await tx.productVariant.findMany({ where: { productId: product.id } });
          const same = (x: (typeof variants)[number]) => x.option1Id === slots[0] && x.option2Id === slots[1] && x.option3Id === slots[2];
          const match =
            (vData.sku && variants.find((x) => x.sku === vData.sku)) ||
            variants.find(same) ||
            // A product's first options take over its plain default variant.
            (slots.some(Boolean) ? variants.find((x) => !x.option1Id && !x.option2Id && !x.option3Id) : undefined);
          if (match) await tx.productVariant.update({ where: { id: match.id }, data: vData });
          else await tx.productVariant.create({ data: { ...vData, productId: product.id } });
        }
      });
      if (existing) updated++;
      else created++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "could not be saved";
      problems.push(/Unique constraint/.test(msg) ? `${label}: a SKU or brand is already used elsewhere` : `${label}: ${msg.split("\n").pop()}`);
    }
  }

  if (created || updated) {
    await recordChange(user, {
      action: "product.import",
      entity: "Product",
      detail: { file: file.name, created, updated, problems: problems.length },
    });
  }
  return { created, updated, problems };
}
