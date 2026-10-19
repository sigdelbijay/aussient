"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/dal";
import { diff, recordChange } from "./activity";
import { fieldErrors, optionalText, type AdminFormState } from "./form";
import { slugify, uniqueSlug } from "./slug";

/** Admin actions for categories and reviews. Each is logged and refreshes the shop. */

const id = z.string().min(1).max(64);

// ── Categories ──────────────────────────────────────────────────

const categorySchema = z.object({
  id: z.preprocess((v) => v || undefined, id.optional()),
  name: z.string().trim().min(1, "Enter a name").max(60),
  slug: optionalText(60),
  image: optionalText(500).refine((v) => v === null || /^https:\/\//.test(v), "Upload an image"),
});

export async function saveCategoryAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = await requireStaff();
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { id: categoryId, slug: wanted, ...data } = parsed.data;
  const taken = async (slug: string) =>
    !!(await prisma.category.findFirst({ where: { slug, ...(categoryId && { id: { not: categoryId } }) } }));

  if (categoryId) {
    const before = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!before) return { error: "This category no longer exists." };
    const slug = wanted ? slugify(wanted) : before.slug;
    if (slug !== before.slug && (await taken(slug))) {
      return { error: "Please fix the highlighted fields.", fieldErrors: { slug: "Another category already uses this web address" } };
    }
    await prisma.category.update({ where: { id: categoryId }, data: { ...data, slug } });
    await recordChange(user, {
      action: "category.update",
      entity: "Category",
      entityId: categoryId,
      detail: { name: data.name, changes: diff(before, { ...data, slug }) },
    });
    return { message: `${data.name} saved.` };
  }

  const last = await prisma.category.aggregate({ _max: { order: true } });
  const category = await prisma.category.create({
    data: { ...data, slug: await uniqueSlug(wanted || data.name, taken), order: (last._max.order ?? -1) + 1 },
  });
  await recordChange(user, { action: "category.create", entity: "Category", entityId: category.id, detail: { name: category.name } });
  return { message: `${category.name} added.` };
}

export async function reorderCategoriesAction(orderedIds: string[]) {
  const user = await requireStaff();
  const ids = z.array(id).max(500).parse(orderedIds);
  const all = await prisma.category.findMany({ select: { id: true } });
  if (all.length !== ids.length || !all.every((c) => ids.includes(c.id))) throw new Error("Category list is out of date — reload the page");
  await prisma.$transaction(ids.map((cid, order) => prisma.category.update({ where: { id: cid }, data: { order } })));
  await recordChange(user, { action: "category.reorder", entity: "Category" });
}

export async function deleteCategoryAction(categoryId: string): Promise<{ error?: string }> {
  const user = await requireStaff();
  const category = await prisma.category.findUnique({
    where: { id: id.parse(categoryId) },
    include: { _count: { select: { products: true } } },
  });
  if (!category) return {};
  if (category._count.products > 0) {
    return { error: `Move its ${category._count.products} products to another category first.` };
  }
  await prisma.category.delete({ where: { id: category.id } });
  await recordChange(user, { action: "category.delete", entity: "Category", entityId: category.id, detail: { name: category.name } });
  return {};
}

// ── Reviews ─────────────────────────────────────────────────────

/** Approve (show on the shop) or hide a customer review. */
export async function setReviewApprovedAction(reviewId: string, approved: boolean) {
  const user = await requireStaff();
  const review = await prisma.review.update({
    where: { id: id.parse(reviewId) },
    data: { approved: z.boolean().parse(approved) },
    include: { product: { select: { name: true } } },
  });
  await recordChange(user, {
    action: approved ? "review.approve" : "review.hide",
    entity: "Review",
    entityId: review.id,
    detail: { product: review.product.name, rating: review.rating, author: review.authorName },
  });
}
