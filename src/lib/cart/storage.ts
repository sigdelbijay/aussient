import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MAX_QTY } from "@/lib/catalog-shared";
import { normalizeCode, tidyItems, type BagItem } from "./pricing";

/**
 * Where bags live: guests in a cookie, signed-in shoppers in the database.
 * Only ids and quantities are stored — prices always come from calculateTotals().
 *
 * These read and write cookies, so call them only from server actions or
 * route handlers (not while rendering a page).
 */

export type StoredBag = { items: BagItem[]; code: string | null };

const COOKIE = "aussient-bag";
const MAX_LINES = 40; // keeps the cookie well under the browser's 4 KB limit
const EMPTY: StoredBag = { items: [], code: null };

// Compact cookie format: {"i":[["productId","variantId"|"",qty],...],"c":"CODE"}
const cookieSchema = z.object({
  i: z.array(z.tuple([z.string().max(64), z.string().max(64), z.number().int().min(1).max(MAX_QTY)])).max(MAX_LINES),
  c: z.string().max(40).nullish(),
});

async function readCookie(): Promise<StoredBag> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return EMPTY;
  try {
    const parsed = cookieSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return EMPTY;
    return {
      items: parsed.data.i.map(([productId, variantId, qty]) => ({ productId, variantId: variantId || null, qty })),
      code: parsed.data.c ?? null,
    };
  } catch {
    return EMPTY;
  }
}

async function writeCookie(bag: StoredBag) {
  const jar = await cookies();
  if (bag.items.length === 0 && !bag.code) {
    jar.delete(COOKIE);
    return;
  }
  const value = JSON.stringify({
    i: bag.items.slice(0, MAX_LINES).map((i) => [i.productId, i.variantId ?? "", i.qty]),
    c: bag.code,
  });
  jar.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // 60 days
  });
}

async function readAccount(userId: string): Promise<StoredBag> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (!cart) return EMPTY;
  return {
    items: cart.items.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.quantity })),
    code: cart.discountCode,
  };
}

async function writeAccount(userId: string, bag: StoredBag) {
  await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.upsert({
      where: { userId },
      create: { userId, discountCode: bag.code },
      update: { discountCode: bag.code },
    });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    if (bag.items.length) {
      await tx.cartItem.createMany({
        data: bag.items.slice(0, MAX_LINES).map((i) => ({
          cartId: cart.id,
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.qty,
        })),
      });
    }
  });
}

type Shopper = { id: string } | null;

/**
 * The shopper's bag. When someone signs in with a guest bag in their cookie,
 * those items move into their account bag (quantities added together) and
 * the cookie is cleared.
 */
export async function readBag(user: Shopper): Promise<StoredBag> {
  const guest = await readCookie();
  if (!user) return guest;

  const account = await readAccount(user.id);
  if (guest.items.length === 0 && !guest.code) return account;

  const merged: StoredBag = {
    items: tidyItems([...account.items, ...guest.items]),
    code: account.code ?? guest.code,
  };
  await writeAccount(user.id, merged);
  await writeCookie(EMPTY);
  return merged;
}

export async function writeBag(user: Shopper, bag: StoredBag) {
  const clean: StoredBag = {
    items: tidyItems(bag.items).slice(0, MAX_LINES),
    code: bag.code ? normalizeCode(bag.code) : null,
  };
  if (user) await writeAccount(user.id, clean);
  else await writeCookie(clean);
}
