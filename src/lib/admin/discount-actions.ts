"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/dal";
import { normalizeCode } from "@/lib/cart/pricing";
import { diff, recordChange } from "./activity";
import { fromShopInput } from "./dates";
import { fieldErrors, type AdminFormState } from "./form";

/**
 * Admin actions for discount codes and automatic offers. Each is logged and
 * refreshes the cached shop pages (offers show in the announcement bar and as
 * product badges). The money off itself is always worked out by calculateTotals().
 */

const id = z.string().min(1).max(64);
const invalid = (fields: Record<string, string>): AdminFormState => ({ error: "Please fix the highlighted fields.", fieldErrors: fields });

const discountInput = z.object({
  id: id.nullable(),
  kind: z.enum(["CODE", "AUTOMATIC"]),
  code: z.string().max(60),
  title: z.string().trim().max(80),
  type: z.enum(["PERCENT", "AMOUNT", "FREE_SHIPPING", "BUY_X_GET_Y"]),
  // Numbers arrive as the text typed into the boxes; checked below so each gets a clear message.
  value: z.string().max(20),
  buyQuantity: z.string().max(10),
  getQuantity: z.string().max(10),
  scope: z.enum(["ALL", "CATEGORY", "PRODUCT_TYPE", "BRAND", "COLLECTION", "PRODUCTS"]),
  categoryId: z.string().max(64),
  productTypeId: z.string().max(64),
  brandId: z.string().max(64),
  collectionId: z.string().max(64),
  productIds: z.array(id).max(500),
  minSpend: z.string().max(20),
  /** "2026-11-01T09:00" in Sydney time, or "". */
  startsAt: z.string().max(20),
  endsAt: z.string().max(20),
  usageLimit: z.string().max(10),
  perCustomerLimit: z.string().max(10),
  firstOrderOnly: z.boolean(),
  active: z.boolean(),
});
export type DiscountInput = z.infer<typeof discountInput>;

const isMoney = (t: string) => /^\d{1,6}(\.\d{1,2})?$/.test(t);
const isCount = (t: string) => /^\d{1,6}$/.test(t) && Number(t) >= 1;

export async function saveDiscountAction(input: DiscountInput): Promise<AdminFormState> {
  const user = await requireStaff();
  const parsed = discountInput.safeParse(input);
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  const errors: Record<string, string> = {};
  const text = (k: keyof DiscountInput) => String(d[k]).trim();

  // The code (codes only): letters, numbers, - and _, stored in capitals.
  const code = d.kind === "CODE" ? normalizeCode(d.code) : null;
  if (code !== null && !/^[A-Z0-9_-]{3,40}$/.test(code)) errors.code = "Use 3–40 letters, numbers, - or _, e.g. SUMMER20";

  // What it gives.
  let value: number | null = null;
  let buyQuantity: number | null = null;
  let getQuantity: number | null = null;
  if (d.type === "PERCENT") {
    if (!isMoney(text("value")) || Number(text("value")) <= 0 || Number(text("value")) > 100) errors.value = "Enter a percent from 1 to 100";
    else value = Number(text("value"));
  } else if (d.type === "AMOUNT") {
    if (!isMoney(text("value")) || Number(text("value")) <= 0) errors.value = "Enter an amount like 10";
    else value = Number(text("value"));
  } else if (d.type === "BUY_X_GET_Y") {
    if (!isCount(text("buyQuantity")) || Number(text("buyQuantity")) > 50) errors.buyQuantity = "Enter a number from 1 to 50";
    else buyQuantity = Number(text("buyQuantity"));
    if (!isCount(text("getQuantity")) || Number(text("getQuantity")) > 50) errors.getQuantity = "Enter a number from 1 to 50";
    else getQuantity = Number(text("getQuantity"));
  }

  // What it applies to: only the field for the chosen scope is kept.
  const target = {
    categoryId: d.scope === "CATEGORY" ? d.categoryId || null : null,
    productTypeId: d.scope === "PRODUCT_TYPE" ? d.productTypeId || null : null,
    brandId: d.scope === "BRAND" ? d.brandId || null : null,
    collectionId: d.scope === "COLLECTION" ? d.collectionId || null : null,
  };
  const productIds = d.scope === "PRODUCTS" ? [...new Set(d.productIds)] : [];
  if (d.scope === "CATEGORY" && !target.categoryId) errors.categoryId = "Choose a category";
  if (d.scope === "PRODUCT_TYPE" && !target.productTypeId) errors.productTypeId = "Choose a product type";
  if (d.scope === "BRAND" && !target.brandId) errors.brandId = "Choose a brand";
  if (d.scope === "COLLECTION" && !target.collectionId) errors.collectionId = "Choose a collection";
  if (d.scope === "PRODUCTS" && productIds.length === 0) errors.productIds = "Tick at least one product";

  // Options.
  const minSpend = text("minSpend") === "" ? null : isMoney(text("minSpend")) ? Number(text("minSpend")) : NaN;
  if (Number.isNaN(minSpend)) errors.minSpend = "Enter an amount like 50";
  const startsAt = fromShopInput(d.startsAt);
  const endsAt = fromShopInput(d.endsAt);
  if (startsAt && Number.isNaN(startsAt.getTime())) errors.startsAt = "Pick a date and time";
  if (endsAt && Number.isNaN(endsAt.getTime())) errors.endsAt = "Pick a date and time";
  if (startsAt && endsAt && endsAt <= startsAt) errors.endsAt = "Must be after the start";
  const limit = (k: "usageLimit" | "perCustomerLimit") => {
    if (text(k) === "") return null;
    if (!isCount(text(k))) errors[k] = "Enter a whole number, 1 or more (blank = no limit)";
    return Number(text(k));
  };
  const usageLimit = limit("usageLimit");
  const perCustomerLimit = limit("perCustomerLimit");

  if (Object.keys(errors).length) return invalid(errors);

  // Everything picked must still exist, and the code can't be taken.
  const [category, type, brand, collection, productCount, clash] = await Promise.all([
    target.categoryId ? prisma.category.findUnique({ where: { id: target.categoryId } }) : true,
    target.productTypeId ? prisma.productType.findUnique({ where: { id: target.productTypeId } }) : true,
    target.brandId ? prisma.brand.findUnique({ where: { id: target.brandId } }) : true,
    target.collectionId ? prisma.collection.findUnique({ where: { id: target.collectionId } }) : true,
    prisma.product.count({ where: { id: { in: productIds } } }),
    code ? prisma.discount.findFirst({ where: { code: { equals: code, mode: "insensitive" }, ...(d.id && { id: { not: d.id } }) } }) : null,
  ]);
  if (!category || !type || !brand || !collection || productCount !== productIds.length) {
    return { error: "Something you picked no longer exists — reload the page." };
  }
  if (clash) return invalid({ code: "Another discount already uses this code" });

  const values = {
    code,
    title: d.title || null,
    type: d.type,
    scope: d.scope,
    value,
    buyQuantity,
    getQuantity,
    ...target,
    minSpend,
    startsAt,
    endsAt,
    usageLimit,
    perCustomerLimit,
    firstOrderOnly: d.firstOrderOnly,
    active: d.active,
  };
  const products = productIds.map((pid) => ({ id: pid }));
  const name = code ?? (d.title || "Automatic offer");
  // Offers show in the announcement bar (content) and as product badges (products).
  const refresh = { refresh: ["products", "content"] as ("products" | "content")[] };

  if (!d.id) {
    const created = await prisma.discount.create({ data: { ...values, products: { connect: products } } });
    await recordChange(user, { action: "discount.create", entity: "Discount", entityId: created.id, detail: { name, type: d.type, scope: d.scope } }, refresh);
    redirect(`/admin/discounts/${created.id}?created=1`);
  }

  const before = await prisma.discount.findUnique({ where: { id: d.id }, include: { products: { select: { id: true } } } });
  if (!before) return { error: "This discount no longer exists." };
  await prisma.discount.update({ where: { id: d.id }, data: { ...values, products: { set: products } } });
  await recordChange(
    user,
    {
      action: "discount.update",
      entity: "Discount",
      entityId: d.id,
      detail: {
        name,
        changes: diff(
          { ...before, products: before.products.map((p) => p.id).sort().join() },
          { ...values, products: productIds.sort().join() },
        ),
      },
    },
    refresh,
  );
  return { message: `${name} saved.` };
}

/** A discount that's been used stays, so past orders still show it — switch it off instead. */
export async function deleteDiscountAction(discountId: string): Promise<AdminFormState> {
  const user = await requireStaff();
  const d = await prisma.discount.findUnique({ where: { id: id.parse(discountId) }, include: { _count: { select: { orders: true } } } });
  if (!d) redirect("/admin/discounts");
  if (d._count.orders > 0 || d.timesUsed > 0) {
    return { error: "This discount has been used on orders, so it can't be deleted. Switch it off instead." };
  }
  await prisma.discount.delete({ where: { id: d.id } });
  await recordChange(
    user,
    { action: "discount.delete", entity: "Discount", entityId: d.id, detail: { name: d.code ?? d.title ?? "Automatic offer" } },
    { refresh: ["products", "content"] },
  );
  redirect("/admin/discounts");
}
