"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/dal";
import { parseSpecInput, readSpecFields, readSpecs, type Specs } from "@/lib/product-types";
import { cloudinaryConfig, MEDIA_FOLDER, signParams } from "./cloudinary";
import { diff, recordChange } from "./activity";
import { checkbox, fieldErrors, money, optionalMoney, optionalText, wholeNumber, type AdminFormState } from "./form";
import { slugify, uniqueSlug } from "./slug";
import { addRedirect } from "@/lib/redirects";

/**
 * Admin product actions: details, duplicate, photos. (Options and variants are
 * in variant-actions.ts, CSV import in import-actions.ts.) Every one starts
 * with requireStaff() and ends with recordChange(), which logs it and
 * refreshes the cached shop pages.
 */

const id = z.string().min(1).max(64);

const slugTaken = (exceptId?: string) => async (slug: string) =>
  !!(await prisma.product.findFirst({ where: { slug, ...(exceptId && { id: { not: exceptId } }) } }));

async function productName(productId: string) {
  return (await prisma.product.findUnique({ where: { id: productId }, select: { name: true } }))?.name;
}

/** "Gift, summer ,gift" → ["gift", "summer"] (lowercase, no repeats). */
const tagList = z
  .string()
  .optional()
  .transform((v) => [...new Set((v ?? "").split(",").map((t) => t.trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 30));

// ── Product details ─────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  slug: optionalText(80),
  description: optionalText(5000),
  productTypeId: z.string("Choose a product type").min(1, "Choose a product type"),
  brandId: optionalText(64),
  tags: tagList,
  details: optionalText(2000),
  care: optionalText(2000),
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
  status: z.enum(["DRAFT", "LIVE"]),
  featured: checkbox,
});

// New products also get their first (default) variant from the form.
const firstVariantSchema = z
  .object({ price: money, salePrice: optionalMoney, stock: wholeNumber, sku: optionalText(60).transform((v) => v?.toUpperCase() ?? null) })
  .refine((d) => d.salePrice === null || d.salePrice < d.price, {
    path: ["salePrice"],
    message: "Sale price must be lower than the price",
  });

const invalid = (fields: Record<string, string>) => ({ error: "Please fix the highlighted fields.", fieldErrors: fields });

/** Reads the spec inputs (named "spec:<label>") for the product type's fields. */
function readSpecInputs(formData: FormData, specFields: unknown) {
  const specs: Specs = {};
  const errors: Record<string, string> = {};
  for (const field of readSpecFields(specFields)) {
    const raw = formData.get(`spec:${field.label}`);
    const value = parseSpecInput(field, typeof raw === "string" ? raw : undefined);
    if (value && typeof value === "object") errors[`spec:${field.label}`] = value.error;
    else if (value !== undefined) specs[field.label] = value;
  }
  return { specs, errors };
}

export async function saveProductAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = await requireStaff();
  const productId = formData.get("id") ? id.parse(formData.get("id")) : null;
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { slug: wantedSlug, ...data } = parsed.data;

  // Up to a handful of categories, which must exist.
  const categoryIds = z.array(id).max(20).parse(formData.getAll("categoryIds"));
  const [type, brand, categoryCount] = await Promise.all([
    prisma.productType.findUnique({ where: { id: data.productTypeId } }),
    data.brandId ? prisma.brand.findUnique({ where: { id: data.brandId } }) : null,
    prisma.category.count({ where: { id: { in: categoryIds } } }),
  ]);
  if (!type) return invalid({ productTypeId: "Choose a product type" });
  if (data.brandId && !brand) return invalid({ brandId: "That brand no longer exists" });
  if (categoryCount !== categoryIds.length) return invalid({ categoryIds: "A category no longer exists — reload the page" });

  const { specs, errors } = readSpecInputs(formData, type.specFields);
  if (Object.keys(errors).length) return invalid(errors);

  if (!productId) {
    const first = firstVariantSchema.safeParse(Object.fromEntries(formData));
    if (!first.success) return fieldErrors(first.error);
    if (first.data.sku && (await prisma.productVariant.findUnique({ where: { sku: first.data.sku } }))) {
      return invalid({ sku: "Another variant already uses this SKU" });
    }
    const slug = await uniqueSlug(wantedSlug || data.name, slugTaken());
    const product = await prisma.product.create({
      data: {
        ...data,
        slug,
        specs,
        categories: { connect: categoryIds.map((cid) => ({ id: cid })) },
        // Its first variant. Options (e.g. sizes) can be added on the next page.
        variants: { create: first.data },
      },
    });
    await recordChange(user, {
      action: "product.create",
      entity: "Product",
      entityId: product.id,
      detail: { name: product.name, status: product.status, type: type.name },
    });
    redirect(`/admin/products/${product.id}?created=1`);
  }

  const before = await prisma.product.findUnique({
    where: { id: productId },
    include: { categories: { select: { id: true } }, _count: { select: { optionValues: true } } },
  });
  if (!before) return { error: "This product no longer exists." };
  if (before.productTypeId !== data.productTypeId && before._count.optionValues > 0) {
    return invalid({ productTypeId: "Remove this product's option values first — they belong to its current type" });
  }
  const slug = wantedSlug ? slugify(wantedSlug) : before.slug;
  if (slug !== before.slug && (await slugTaken(productId)(slug))) {
    return invalid({ slug: "Another product already uses this web address" });
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      ...data,
      slug,
      specs,
      categories: { set: categoryIds.map((cid) => ({ id: cid })) },
    },
  });
  // Old links to the product (emails, social posts, Google) keep working.
  if (slug !== before.slug) await addRedirect(`/products/${before.slug}`, `/products/${slug}`);
  const changes = diff(
    { ...before, specs: JSON.stringify(readSpecs(before.specs)), tags: before.tags.join(", "), categories: before.categories.map((c) => c.id).sort().join() },
    { ...data, slug, specs: JSON.stringify(specs), tags: data.tags.join(", "), categories: [...categoryIds].sort().join() },
  );
  if (Object.keys(changes).length) {
    await recordChange(user, {
      action: "product.update",
      entity: "Product",
      entityId: productId,
      detail: { name: data.name, changes, ...(slug !== before.slug && { redirect: `/products/${before.slug} → /products/${slug}` }) },
    }, { refresh: slug !== before.slug ? ["products", "content"] : ["products"] });
  }
  return { message: slug !== before.slug ? `Product saved. The old link /products/${before.slug} now redirects here.` : "Product saved." };
}

export async function duplicateProductAction(productId: string) {
  const user = await requireStaff();
  const source = await prisma.product.findUnique({
    where: { id: id.parse(productId) },
    include: {
      media: true,
      optionValues: true,
      variants: true,
      categories: { select: { id: true } },
      completeTheLook: { select: { id: true } },
    },
  });
  if (!source) throw new Error("Product not found");

  const slug = await uniqueSlug(`${source.slug}-copy`, slugTaken());
  const copy = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: `${source.name} (copy)`,
        slug,
        description: source.description,
        productTypeId: source.productTypeId,
        brandId: source.brandId,
        specs: source.specs as Prisma.InputJsonValue,
        tags: source.tags,
        details: source.details,
        care: source.care,
        status: "DRAFT", // copies start hidden from shoppers
        featured: false,
        categories: { connect: source.categories },
        completeTheLook: { connect: source.completeTheLook },
      },
    });
    // Old option value id → new one, so variants and photos point at the copies.
    const valueIds = new Map<string, string>();
    for (const v of source.optionValues) {
      const nv = await tx.productOptionValue.create({
        data: { productId: product.id, option: v.option, value: v.value, swatchColor: v.swatchColor, swatchImage: v.swatchImage, order: v.order },
      });
      valueIds.set(v.id, nv.id);
    }
    const mapped = (vid: string | null) => (vid ? (valueIds.get(vid) ?? null) : null);
    await tx.productVariant.createMany({
      data: source.variants.map((v) => ({
        productId: product.id,
        option1Id: mapped(v.option1Id),
        option2Id: mapped(v.option2Id),
        option3Id: mapped(v.option3Id),
        sku: null, // SKUs must be unique — set new ones on the copy
        price: v.price,
        salePrice: v.salePrice,
        stock: v.stock,
        weightGrams: v.weightGrams,
        barcode: null,
      })),
    });
    await tx.productMedia.createMany({
      data: source.media.map((m) => ({
        productId: product.id,
        optionValueId: mapped(m.optionValueId),
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

async function checkOptionValue(productId: string, optionValueId: string | null) {
  if (optionValueId && !(await prisma.productOptionValue.findFirst({ where: { id: optionValueId, productId } }))) {
    throw new Error("That option value no longer exists — reload the page");
  }
}

/** Adds uploaded photos/videos; `optionValueId` = photos of that value (e.g. Navy). */
export async function addMediaAction(
  productId: string,
  items: { url: string; type: "IMAGE" | "VIDEO" }[],
  optionValueId: string | null,
) {
  const user = await requireStaff();
  const pid = id.parse(productId);
  const media = newMedia.parse(items);
  const ovid = optionValueId ? id.parse(optionValueId) : null;
  await checkOptionValue(pid, ovid);
  const last = await prisma.productMedia.aggregate({ where: { productId: pid }, _max: { order: true } });
  const start = (last._max.order ?? -1) + 1;
  await prisma.productMedia.createMany({
    data: media.map((m, i) => ({ productId: pid, optionValueId: ovid, url: m.url, type: m.type, order: start + i })),
  });
  await recordChange(user, {
    action: "product.media.add",
    entity: "Product",
    entityId: pid,
    detail: { name: await productName(pid), count: media.length, urls: media.map((m) => m.url) },
  });
}

export async function updateMediaAction(mediaId: string, patch: { alt?: string; optionValueId?: string | null }) {
  const user = await requireStaff();
  const media = await prisma.productMedia.findUnique({ where: { id: id.parse(mediaId) } });
  if (!media) throw new Error("Photo not found");
  const data = z
    .object({ alt: z.string().trim().max(200).optional(), optionValueId: id.nullable().optional() })
    .parse(patch);
  if (data.optionValueId) await checkOptionValue(media.productId, data.optionValueId);
  const next = {
    ...(data.alt !== undefined && { alt: data.alt || null }),
    ...(data.optionValueId !== undefined && { optionValueId: data.optionValueId }),
  };
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
