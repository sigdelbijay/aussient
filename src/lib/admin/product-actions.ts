"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/dal";
import { cloudinaryConfig, MEDIA_FOLDER, signParams } from "./cloudinary";
import { diff, recordChange } from "./activity";
import {
  checkbox,
  fieldErrors,
  money,
  optionalMoney,
  optionalText,
  wholeNumber,
  type AdminFormState,
} from "./form";
import { parseCsvObjects } from "./csv";
import { slugify, uniqueSlug } from "./slug";

/**
 * Admin product actions. Every one starts with requireStaff() and ends with
 * recordChange(), which logs it and refreshes the cached shop pages.
 */

const id = z.string().min(1).max(64);

const slugTaken = (exceptId?: string) => async (slug: string) =>
  !!(await prisma.product.findFirst({ where: { slug, ...(exceptId && { id: { not: exceptId } }) } }));

// ── Product details ─────────────────────────────────────────────

const productSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(120),
    slug: optionalText(80),
    description: optionalText(5000),
    price: money,
    salePrice: optionalMoney,
    stock: wholeNumber,
    material: optionalText(80),
    style: optionalText(40).transform((v) => v?.toLowerCase() ?? null),
    hypoallergenic: checkbox,
    details: optionalText(2000),
    care: optionalText(2000),
    seoTitle: optionalText(70),
    seoDescription: optionalText(170),
    categoryId: z.string("Choose a category").min(1, "Choose a category"),
    status: z.enum(["DRAFT", "LIVE"]),
    featured: checkbox,
  })
  .refine((d) => d.salePrice === null || d.salePrice < d.price, {
    path: ["salePrice"],
    message: "Sale price must be lower than the price",
  });

export async function saveProductAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = await requireStaff();
  const productId = formData.get("id") ? id.parse(formData.get("id")) : null;
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { slug: wantedSlug, ...data } = parsed.data;

  if (!(await prisma.category.findUnique({ where: { id: data.categoryId } }))) {
    return { error: "Please fix the highlighted fields.", fieldErrors: { categoryId: "Choose a category" } };
  }

  if (!productId) {
    const slug = await uniqueSlug(wantedSlug || data.name, slugTaken());
    const product = await prisma.product.create({ data: { ...data, slug } });
    await recordChange(user, {
      action: "product.create",
      entity: "Product",
      entityId: product.id,
      detail: { name: product.name, status: product.status },
    });
    redirect(`/admin/products/${product.id}?created=1`);
  }

  const before = await prisma.product.findUnique({ where: { id: productId } });
  if (!before) return { error: "This product no longer exists." };
  const slug = wantedSlug ? slugify(wantedSlug) : before.slug;
  if (slug !== before.slug && (await slugTaken(productId)(slug))) {
    return { error: "Please fix the highlighted fields.", fieldErrors: { slug: "Another product already uses this web address" } };
  }

  await prisma.product.update({ where: { id: productId }, data: { ...data, slug } });
  const changes = diff(before, { ...data, slug });
  if (Object.keys(changes).length) {
    await recordChange(user, {
      action: "product.update",
      entity: "Product",
      entityId: productId,
      detail: { name: data.name, changes },
    });
  }
  return { message: "Product saved." };
}

export async function duplicateProductAction(productId: string) {
  const user = await requireStaff();
  const source = await prisma.product.findUnique({
    where: { id: id.parse(productId) },
    include: { media: true, variants: true, completeTheLook: { select: { id: true } } },
  });
  if (!source) throw new Error("Product not found");

  const slug = await uniqueSlug(`${source.slug}-copy`, slugTaken());
  const copy = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: `${source.name} (copy)`,
        slug,
        description: source.description,
        price: source.price,
        salePrice: source.salePrice,
        stock: source.stock,
        material: source.material,
        style: source.style,
        hypoallergenic: source.hypoallergenic,
        details: source.details,
        care: source.care,
        categoryId: source.categoryId,
        status: "DRAFT", // copies start hidden from shoppers
        featured: false,
        completeTheLook: { connect: source.completeTheLook },
      },
    });
    const variantIds = new Map<string, string>();
    for (const v of source.variants) {
      const nv = await tx.productVariant.create({
        data: {
          productId: product.id,
          name: v.name,
          sku: null, // SKUs must be unique — set new ones on the copy
          price: v.price,
          salePrice: v.salePrice,
          stock: v.stock,
        },
      });
      variantIds.set(v.id, nv.id);
    }
    await tx.productMedia.createMany({
      data: source.media.map((m) => ({
        productId: product.id,
        variantId: m.variantId ? (variantIds.get(m.variantId) ?? null) : null,
        url: m.url,
        type: m.type,
        alt: m.alt,
        order: m.order,
      })),
    });
    return product;
  });

  await recordChange(user, {
    action: "product.duplicate",
    entity: "Product",
    entityId: copy.id,
    detail: { name: copy.name, from: source.name, fromId: source.id },
  });
  redirect(`/admin/products/${copy.id}?duplicated=1`);
}

// ── Photos & videos ─────────────────────────────────────────────

/** Only accept media hosted in our Cloudinary account. */
const mediaUrl = z
  .url()
  .refine((u) => u.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`), "Upload through Cloudinary");

const newMedia = z.array(z.object({ url: mediaUrl, type: z.enum(["IMAGE", "VIDEO"]) })).min(1).max(30);

async function productName(productId: string) {
  return (await prisma.product.findUnique({ where: { id: productId }, select: { name: true } }))?.name;
}

export async function addMediaAction(productId: string, items: { url: string; type: "IMAGE" | "VIDEO" }[], variantId: string | null) {
  const user = await requireStaff();
  const pid = id.parse(productId);
  const media = newMedia.parse(items);
  const vid = variantId ? id.parse(variantId) : null;
  if (vid && !(await prisma.productVariant.findFirst({ where: { id: vid, productId: pid } }))) {
    throw new Error("Finish not found");
  }
  const last = await prisma.productMedia.aggregate({ where: { productId: pid }, _max: { order: true } });
  const start = (last._max.order ?? -1) + 1;
  await prisma.productMedia.createMany({
    data: media.map((m, i) => ({ productId: pid, variantId: vid, url: m.url, type: m.type, order: start + i })),
  });
  await recordChange(user, {
    action: "product.media.add",
    entity: "Product",
    entityId: pid,
    detail: { name: await productName(pid), count: media.length, urls: media.map((m) => m.url) },
  });
}

export async function updateMediaAction(mediaId: string, patch: { alt?: string; variantId?: string | null }) {
  const user = await requireStaff();
  const media = await prisma.productMedia.findUnique({ where: { id: id.parse(mediaId) } });
  if (!media) throw new Error("Photo not found");
  const data = z
    .object({ alt: z.string().trim().max(200).optional(), variantId: id.nullable().optional() })
    .parse(patch);
  if (data.variantId && !(await prisma.productVariant.findFirst({ where: { id: data.variantId, productId: media.productId } }))) {
    throw new Error("Finish not found");
  }
  const next = { ...(data.alt !== undefined && { alt: data.alt || null }), ...(data.variantId !== undefined && { variantId: data.variantId }) };
  await prisma.productMedia.update({ where: { id: media.id }, data: next });
  await recordChange(user, {
    action: "product.media.update",
    entity: "Product",
    entityId: media.productId,
    detail: { name: await productName(media.productId), url: media.url, changes: diff(media, next) },
  });
}

export async function reorderMediaAction(productId: string, orderedIds: string[]) {
  const user = await requireStaff();
  const pid = id.parse(productId);
  const ids = z.array(id).max(200).parse(orderedIds);
  const owned = await prisma.productMedia.findMany({ where: { productId: pid }, select: { id: true } });
  if (owned.length !== ids.length || !owned.every((m) => ids.includes(m.id))) throw new Error("Photo list is out of date — reload the page");
  await prisma.$transaction(ids.map((mid, order) => prisma.productMedia.update({ where: { id: mid }, data: { order } })));
  await recordChange(user, { action: "product.media.reorder", entity: "Product", entityId: pid, detail: { name: await productName(pid) } });
}

export async function deleteMediaAction(mediaId: string) {
  const user = await requireStaff();
  const media = await prisma.productMedia.delete({ where: { id: id.parse(mediaId) } });
  // The file stays in Cloudinary (other products may use it) and remains in the media library.
  await recordChange(user, {
    action: "product.media.delete",
    entity: "Product",
    entityId: media.productId,
    detail: { name: await productName(media.productId), url: media.url },
  });
}

/** Signs a Cloudinary Upload Widget request — the API secret stays on the server. */
export async function signUploadAction(paramsToSign: Record<string, unknown>) {
  await requireStaff();
  const config = cloudinaryConfig();
  if (!config) throw new Error("Cloudinary isn't configured — add the CLOUDINARY_* settings to .env");
  const params = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).parse(paramsToSign);
  if (typeof params.folder !== "string" || !params.folder.startsWith(`${MEDIA_FOLDER}/`)) {
    throw new Error("Uploads must go into the shop's folder");
  }
  return signParams(params, config.apiSecret);
}

// ── Finishes / colours ──────────────────────────────────────────

const variantSchema = z
  .object({
    productId: id,
    id: z.preprocess((v) => v || undefined, id.optional()),
    name: z.string().trim().min(1, "Enter a name, e.g. Gold").max(60),
    sku: optionalText(60).transform((v) => v?.toUpperCase() ?? null),
    price: optionalMoney,
    salePrice: optionalMoney,
    stock: wholeNumber,
  })
  .refine((d) => d.salePrice === null || d.price !== null, {
    path: ["salePrice"],
    message: "Set this finish's own price too, or leave both blank to use the product's",
  })
  .refine((d) => d.salePrice === null || d.price === null || d.salePrice < d.price, {
    path: ["salePrice"],
    message: "Sale price must be lower than the price",
  });

export async function saveVariantAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = await requireStaff();
  const parsed = variantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { productId, id: variantId, ...data } = parsed.data;

  if (data.sku && (await prisma.productVariant.findFirst({ where: { sku: data.sku, ...(variantId && { id: { not: variantId } }) } }))) {
    return { error: "Please fix the highlighted fields.", fieldErrors: { sku: "Another finish already uses this SKU" } };
  }
  if (await prisma.productVariant.findFirst({ where: { productId, name: { equals: data.name, mode: "insensitive" }, ...(variantId && { id: { not: variantId } }) } })) {
    return { error: "Please fix the highlighted fields.", fieldErrors: { name: "This product already has a finish with that name" } };
  }

  if (variantId) {
    const before = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!before) return { error: "This finish no longer exists." };
    await prisma.productVariant.update({ where: { id: variantId }, data });
    await recordChange(user, {
      action: "product.variant.update",
      entity: "Product",
      entityId: productId,
      detail: { name: await productName(productId), finish: data.name, changes: diff(before, data) },
    });
    return { message: `${data.name} saved.` };
  }

  if (!(await prisma.product.findUnique({ where: { id: productId } }))) return { error: "This product no longer exists." };
  await prisma.productVariant.create({ data: { ...data, productId } });
  await recordChange(user, {
    action: "product.variant.create",
    entity: "Product",
    entityId: productId,
    detail: { name: await productName(productId), finish: data.name },
  });
  return { message: `${data.name} added.` };
}

export async function deleteVariantAction(variantId: string) {
  const user = await requireStaff();
  // Its photos become general product photos (relation is SET NULL), not deleted.
  const variant = await prisma.productVariant.delete({ where: { id: id.parse(variantId) } });
  await recordChange(user, {
    action: "product.variant.delete",
    entity: "Product",
    entityId: variant.productId,
    detail: { name: await productName(variant.productId), finish: variant.name },
  });
}

// ── CSV import ──────────────────────────────────────────────────

export type ImportState = { error?: string; created?: number; updated?: number; problems?: string[] } | undefined;

const yes = (v: string | undefined) => /^(1|y|yes|true|live)$/i.test(v ?? "");
const csvMoney = (v: string | undefined) => (v ? money.safeParse(v.replace(/^\$/, "")) : null);

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

  // Rows with the same slug (or name) are one product with several finishes.
  const groups = new Map<string, { line: number; row: Record<string, string> }[]>();
  rows.forEach((row, i) => {
    const key = slugify(row.slug || row.name || "");
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), { line: i + 2, row }]);
  });

  const categories = await prisma.category.findMany({ select: { id: true, slug: true, name: true } });
  const findCategory = (v: string) =>
    categories.find((c) => c.slug === slugify(v) || c.name.toLowerCase() === v.toLowerCase());

  let created = 0;
  let updated = 0;
  const problems: string[] = [];

  for (const [slug, lines] of groups) {
    const { line, row } = lines[0];
    const label = `Row ${line} (${row.name || slug})`;
    const price = csvMoney(row.price);
    const sale = csvMoney(row.sale_price);
    const category = row.category ? findCategory(row.category) : undefined;

    if (!row.name) { problems.push(`${label}: missing name`); continue; }
    if (!price?.success) { problems.push(`${label}: price must be a number like 24.95`); continue; }
    if (sale && !sale.success) { problems.push(`${label}: sale_price must be a number like 19.95`); continue; }
    const salePrice = sale?.success ? sale.data : null;
    if (salePrice !== null && salePrice >= price.data) { problems.push(`${label}: sale_price must be lower than price`); continue; }

    const existing = await prisma.product.findUnique({ where: { slug }, include: { media: { select: { url: true } } } });
    if (!existing && !category) { problems.push(`${label}: unknown category "${row.category ?? ""}"`); continue; }

    const data = {
      name: row.name.slice(0, 120),
      price: price.data,
      salePrice,
      stock: Math.max(0, Number.parseInt(row.stock || "0", 10) || 0),
      material: row.material || null,
      style: row.style?.toLowerCase() || null,
      hypoallergenic: yes(row.hypoallergenic),
      featured: yes(row.featured),
      status: yes(row.status) ? ("LIVE" as const) : ("DRAFT" as const),
      description: row.description || null,
      details: row.details || null,
      care: row.care || null,
      seoTitle: row.seo_title || null,
      seoDescription: row.seo_description || null,
      ...(category && { categoryId: category.id }),
    };

    try {
      await prisma.$transaction(async (tx) => {
        const product = existing
          ? await tx.product.update({ where: { id: existing.id }, data })
          : await tx.product.create({ data: { ...data, slug, categoryId: category!.id } });

        // New photo URLs (separated by |) are added after the existing ones.
        const have = new Set(existing?.media.map((m) => m.url));
        const urls = (row.images ?? "").split("|").map((u) => u.trim()).filter((u) => /^https:\/\//.test(u) && !have.has(u));
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

        // Finishes, matched by name.
        for (const { line: vLine, row: v } of lines) {
          if (!v.variant) continue;
          const vPrice = csvMoney(v.variant_price);
          const vSale = csvMoney(v.variant_sale_price);
          if ((vPrice && !vPrice.success) || (vSale && !vSale.success)) {
            throw new Error(`Row ${vLine}: variant prices must be numbers like 24.95`);
          }
          const vData = {
            sku: v.variant_sku?.toUpperCase() || null,
            price: vPrice?.success ? vPrice.data : null,
            salePrice: vSale?.success ? vSale.data : null,
            stock: Math.max(0, Number.parseInt(v.variant_stock || "0", 10) || 0),
          };
          const match = await tx.productVariant.findFirst({
            where: { productId: product.id, name: { equals: v.variant, mode: "insensitive" } },
          });
          if (match) await tx.productVariant.update({ where: { id: match.id }, data: vData });
          else await tx.productVariant.create({ data: { ...vData, productId: product.id, name: v.variant.slice(0, 60) } });
        }
      });
      if (existing) updated++;
      else created++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "could not be saved";
      problems.push(/Unique constraint/.test(msg) ? `${label}: a SKU is already used by another product` : `${label}: ${msg.split("\n").pop()}`);
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
