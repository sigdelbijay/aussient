"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/dal";
import { previewCollectionRules } from "@/lib/catalog";
import { SORTS, type Sort } from "@/lib/catalog-shared";
import { diff, recordChange } from "./activity";
import { fieldErrors, optionalText, type AdminFormState } from "./form";
import { slugify, uniqueSlug } from "./slug";

/** Admin actions for brands and collections. Each is logged and refreshes the cached shop pages. */

const id = z.string().min(1).max(64);
const invalid = (fields: Record<string, string>): AdminFormState => ({ error: "Please fix the highlighted fields.", fieldErrors: fields });
const imageUrl = optionalText(500).refine((v) => v === null || /^https:\/\//.test(v), "Upload an image");

// ── Brands ──────────────────────────────────────────────────────

const brandSchema = z.object({
  id: z.preprocess((v) => v || undefined, id.optional()),
  name: z.string().trim().min(1, "Enter a name").max(60),
  slug: optionalText(60),
  logo: imageUrl,
  description: optionalText(2000),
});

export async function saveBrandAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = await requireStaff();
  const parsed = brandSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { id: brandId, slug: wanted, ...data } = parsed.data;
  const other = brandId ? { id: { not: brandId } } : {};
  if (await prisma.brand.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, ...other } })) {
    return invalid({ name: "Another brand has this name" });
  }
  const taken = async (slug: string) => !!(await prisma.brand.findFirst({ where: { slug, ...other } }));

  if (!brandId) {
    const brand = await prisma.brand.create({ data: { ...data, slug: await uniqueSlug(wanted || data.name, taken) } });
    await recordChange(user, { action: "brand.create", entity: "Brand", entityId: brand.id, detail: { name: brand.name } });
    redirect(`/admin/brands/${brand.id}?created=1`);
  }
  const before = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!before) return { error: "This brand no longer exists." };
  const slug = wanted ? slugify(wanted) : before.slug;
  if (slug !== before.slug && (await taken(slug))) return invalid({ slug: "Another brand already uses this web address" });
  await prisma.brand.update({ where: { id: brandId }, data: { ...data, slug } });
  await recordChange(user, {
    action: "brand.update",
    entity: "Brand",
    entityId: brandId,
    detail: { name: data.name, changes: diff(before, { ...data, slug }) },
  });
  return { message: `${data.name} saved.` };
}

/** Its products are kept — they just no longer have a brand. */
export async function deleteBrandAction(brandId: string) {
  const user = await requireStaff();
  const brand = await prisma.brand.findUnique({ where: { id: id.parse(brandId) }, include: { _count: { select: { products: true } } } });
  if (brand) {
    await prisma.brand.delete({ where: { id: brand.id } });
    await recordChange(user, {
      action: "brand.delete",
      entity: "Brand",
      entityId: brand.id,
      detail: { name: brand.name, productsUnbranded: brand._count.products },
    });
  }
  redirect("/admin/brands");
}

// ── Collections ─────────────────────────────────────────────────

const rulesSchema = z.object({
  ruleCategoryId: id.nullable(),
  ruleProductTypeId: id.nullable(),
  ruleBrandId: id.nullable(),
  ruleTag: z.string().trim().toLowerCase().max(40).nullable().transform((v) => v || null),
  ruleOnSale: z.boolean(),
  rulePriceUnder: z.number("Enter a price like 20").positive("Enter a price like 20").max(1_000_000).nullable(),
  rulePriceOver: z.number("Enter a price like 20").min(0, "Enter a price like 20").max(1_000_000).nullable(),
});

const collectionInput = rulesSchema.extend({
  id: id.nullable(),
  name: z.string().trim().max(80),
  slug: z.string().trim().max(60),
  image: z.string().trim().max(500).nullable(),
  description: z.string().trim().max(2000),
  type: z.enum(["MANUAL", "AUTOMATIC"]),
  sort: z.string(),
  productIds: z.array(id).max(500),
});
export type CollectionInput = z.infer<typeof collectionInput>;

const noRules = { ruleCategoryId: null, ruleProductTypeId: null, ruleBrandId: null, ruleTag: null, ruleOnSale: false, rulePriceUnder: null, rulePriceOver: null };

/** /collections/[slug] shows a category first, so a collection can't share a category's web address. */
async function slugProblem(slug: string, collectionId: string | null) {
  if (await prisma.category.findUnique({ where: { slug } })) return "A category already uses this web address";
  if (await prisma.collection.findFirst({ where: { slug, ...(collectionId && { id: { not: collectionId } }) } })) {
    return "Another collection already uses this web address";
  }
  return null;
}

export async function saveCollectionAction(input: CollectionInput): Promise<AdminFormState> {
  const user = await requireStaff();
  // Manual collections ignore the rules, so a half-typed price there doesn't matter.
  const parsed = collectionInput.safeParse(input?.type === "MANUAL" ? { ...input, ...noRules } : input);
  if (!parsed.success) return fieldErrors(parsed.error);
  const { id: collectionId, productIds, slug: wanted, ...d } = parsed.data;
  if (!d.name) return invalid({ name: "Enter a name, e.g. Summer edit" });
  if (d.image && !/^https:\/\//.test(d.image)) return invalid({ image: "Upload an image" });
  if (!Object.hasOwn(SORTS, d.sort)) return invalid({ sort: "Choose an order" });
  if (d.rulePriceUnder !== null && d.rulePriceOver !== null && d.rulePriceOver >= d.rulePriceUnder) {
    return invalid({ rulePriceOver: "“Over” must be less than “under”" });
  }
  const [category, type, brand, productCount] = await Promise.all([
    d.ruleCategoryId ? prisma.category.findUnique({ where: { id: d.ruleCategoryId } }) : true,
    d.ruleProductTypeId ? prisma.productType.findUnique({ where: { id: d.ruleProductTypeId } }) : true,
    d.ruleBrandId ? prisma.brand.findUnique({ where: { id: d.ruleBrandId } }) : true,
    prisma.product.count({ where: { id: { in: productIds } } }),
  ]);
  if (!category || !type || !brand) return { error: "A category, type or brand in the rules no longer exists — reload the page." };
  if (productCount !== productIds.length) return { error: "A chosen product no longer exists — reload the page." };

  const manual = d.type === "MANUAL";
  const values = {
    name: d.name,
    image: d.image || null,
    description: d.description || null,
    type: d.type,
    sort: d.sort,
    // Only the rules of the chosen kind are kept.
    ...(manual ? noRules : rulesSchema.parse(d)),
  };
  const products = { set: manual ? productIds.map((pid) => ({ id: pid })) : [] };

  if (!collectionId) {
    const slug = wanted ? slugify(wanted) : await uniqueSlug(d.name, async (s) => !!(await slugProblem(s, null)));
    const problem = await slugProblem(slug, null);
    if (problem) return invalid({ slug: problem });
    const c = await prisma.collection.create({ data: { ...values, slug, products: { connect: products.set } } });
    await recordChange(user, {
      action: "collection.create",
      entity: "Collection",
      entityId: c.id,
      detail: { name: c.name, type: c.type, products: manual ? productIds.length : undefined },
    });
    redirect(`/admin/collections/${c.id}?created=1`);
  }

  const before = await prisma.collection.findUnique({ where: { id: collectionId }, include: { products: { select: { id: true } } } });
  if (!before) return { error: "This collection no longer exists." };
  const slug = wanted ? slugify(wanted) : before.slug;
  if (slug !== before.slug) {
    const problem = await slugProblem(slug, collectionId);
    if (problem) return invalid({ slug: problem });
  }
  await prisma.collection.update({ where: { id: collectionId }, data: { ...values, slug, products } });
  await recordChange(user, {
    action: "collection.update",
    entity: "Collection",
    entityId: collectionId,
    detail: {
      name: d.name,
      changes: diff(
        { ...before, products: before.products.map((p) => p.id).sort().join() },
        { ...values, slug, products: [...products.set.map((p) => p.id)].sort().join() },
      ),
    },
  });
  return { message: `${d.name} saved.` };
}

/** Home page rows that show it will show nothing until pointed at another collection. */
export async function deleteCollectionAction(collectionId: string) {
  const user = await requireStaff();
  const c = await prisma.collection.delete({ where: { id: id.parse(collectionId) } });
  await recordChange(user, { action: "collection.delete", entity: "Collection", entityId: c.id, detail: { name: c.name } });
  redirect("/admin/collections");
}

/** Live preview of an automatic collection while its rules are edited (nothing is saved). */
export async function previewCollectionAction(rules: z.input<typeof rulesSchema>, sort: string) {
  await requireStaff();
  const parsed = rulesSchema.safeParse(rules);
  if (!parsed.success) return { total: 0, products: [] };
  return previewCollectionRules(parsed.data, Object.hasOwn(SORTS, sort) ? (sort as Sort) : "newest");
}
