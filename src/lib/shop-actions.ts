"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { live } from "@/lib/storefront";

/**
 * Per-shopper actions used by the (cached, shared) shop pages: wishlist hearts,
 * back-in-stock alerts and reviews. Pages stay cached for everyone; these run
 * in the browser after the page loads.
 */

// ── Wishlist ────────────────────────────────────────────────────

export async function getWishlistAction(): Promise<{ loggedIn: boolean; ids: string[] }> {
  const user = await getCurrentUser();
  if (!user) return { loggedIn: false, ids: [] };
  const rows = await prisma.wishlist.findMany({ where: { userId: user.id }, select: { productId: true } });
  return { loggedIn: true, ids: rows.map((r) => r.productId) };
}

export async function toggleWishlistAction(
  productId: string,
): Promise<{ ok: true; wishlisted: boolean } | { ok: false; reason: "login" | "not-found" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "login" };
  const id = z.string().min(1).max(64).safeParse(productId);
  if (!id.success || !(await prisma.product.findFirst({ where: { id: id.data, ...live } }))) {
    return { ok: false, reason: "not-found" };
  }

  const key = { userId_productId: { userId: user.id, productId: id.data } };
  const existing = await prisma.wishlist.findUnique({ where: key });
  if (existing) await prisma.wishlist.delete({ where: key });
  else await prisma.wishlist.create({ data: { userId: user.id, productId: id.data } });
  revalidatePath("/account");
  return { ok: true, wishlisted: !existing };
}

// ── Back in stock ───────────────────────────────────────────────

export type NotifyState = { message?: string; error?: string } | undefined;

const notifySchema = z.object({
  productId: z.string().min(1).max(64),
  variantId: z.string().max(64).optional(),
  email: z
    .email("Enter a valid email address")
    .max(254)
    .transform((e) => e.toLowerCase().trim()),
});

export async function notifyMeAction(_prev: NotifyState, formData: FormData): Promise<NotifyState> {
  const parsed = notifySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { productId, email } = parsed.data;
  const variantId = parsed.data.variantId || null;
  if (await tooManyAttempts("notify-me", clientIp(await headers()), { max: 10, minutes: 60 })) {
    return { error: "Too many requests — please try again later." };
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, ...live },
    select: { id: true, variants: { select: { id: true } } },
  });
  if (!product || (variantId && !product.variants.some((v) => v.id === variantId))) {
    return { error: "This product isn't available." };
  }

  // One pending request per email + product + variant.
  const pending = await prisma.backInStockRequest.findFirst({
    where: { productId, variantId, email, notified: false },
  });
  if (!pending) await prisma.backInStockRequest.create({ data: { productId, variantId, email } });
  return { message: "Thanks! We'll email you as soon as it's back in stock." };
}

// ── Reviews ─────────────────────────────────────────────────────

export type ReviewEligibility = "login" | "not-purchased" | "already-reviewed" | "eligible";

/** Only signed-in customers with a paid/shipped order containing the product may review it. */
async function eligibility(productId: string) {
  const user = await getCurrentUser();
  if (!user) return { user: null, state: "login" as const };
  const [bought, reviewed] = await Promise.all([
    prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          status: { in: ["PAID", "SHIPPED"] },
          OR: [{ userId: user.id }, { email: user.email }],
        },
      },
      select: { id: true },
    }),
    prisma.review.findFirst({ where: { productId, userId: user.id }, select: { id: true } }),
  ]);
  const state: ReviewEligibility = !bought ? "not-purchased" : reviewed ? "already-reviewed" : "eligible";
  return { user, state };
}

export async function getReviewEligibilityAction(productId: string): Promise<ReviewEligibility> {
  return (await eligibility(String(productId).slice(0, 64))).state;
}

export type ReviewState = { message?: string; error?: string } | undefined;

const reviewSchema = z.object({
  productId: z.string().min(1).max(64),
  rating: z.coerce.number().int().min(1, "Choose a star rating").max(5),
  title: z.string().trim().max(100).optional(),
  body: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000),
});

export async function submitReviewAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { user, state } = await eligibility(parsed.data.productId);
  if (!user || state !== "eligible") {
    return { error: "Only customers who bought this item can review it (once)." };
  }

  await prisma.review.create({
    data: {
      productId: parsed.data.productId,
      userId: user.id,
      authorName: user.name?.split(" ")[0] ?? null,
      rating: parsed.data.rating,
      title: parsed.data.title || null,
      body: parsed.data.body,
      approved: false, // shows on the site once an admin approves it
    },
  });
  return { message: "Thanks for your review! It'll appear here once it's been approved." };
}
