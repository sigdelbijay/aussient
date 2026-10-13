"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { MAX_QTY } from "@/lib/catalog-shared";
import { lineKey, tidyItems, type Totals } from "./pricing";
import { readBag, writeBag, type StoredBag } from "./storage";
import { calculateTotals } from "./totals";

/**
 * Bag actions used by the slide-out bag and the cart page. Each one returns
 * fresh totals from calculateTotals(), so the browser never decides prices.
 */

type User = Awaited<ReturnType<typeof getCurrentUser>>;

/**
 * Prices the bag and saves it — always after a change, or when just reading,
 * only if pricing fixed something (e.g. quantity lowered to what's in stock).
 */
async function priced(user: User, bag: StoredBag, changed = true): Promise<Totals> {
  const totals = await calculateTotals(bag.items, {
    code: bag.code,
    customer: user ? { userId: user.id, email: user.email } : null,
  });

  const fixed: StoredBag = {
    items: totals.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty })),
    // Don't keep codes that don't exist; keep others (e.g. "spend $50") so they apply later.
    code: totals.code?.recognised ? totals.code.code : null,
  };
  if (changed || JSON.stringify(fixed) !== JSON.stringify({ items: tidyItems(bag.items), code: bag.code })) {
    await writeBag(user, fixed);
  }
  return totals;
}

async function current() {
  const user = await getCurrentUser();
  return { user, bag: await readBag(user) };
}

const id = z.string().min(1).max(64);
const lineSchema = z.object({
  productId: id,
  variantId: id.nullable(),
  qty: z.number().int().min(0).max(MAX_QTY),
});

export async function getBagAction(): Promise<Totals> {
  const { user, bag } = await current();
  return priced(user, bag, false);
}

export async function addToBagAction(productId: string, variantId: string | null, qty: number): Promise<Totals> {
  const line = lineSchema.parse({ productId, variantId, qty });
  const { user, bag } = await current();
  const items = tidyItems([...bag.items, line]);
  return priced(user, { ...bag, items });
}

/** Sets a line's quantity (0 removes it). */
export async function setQuantityAction(productId: string, variantId: string | null, qty: number): Promise<Totals> {
  const line = lineSchema.parse({ productId, variantId, qty });
  const { user, bag } = await current();
  const key = lineKey(line.productId, line.variantId);
  const items = bag.items
    .map((i) => (lineKey(i.productId, i.variantId) === key ? { ...i, qty: line.qty } : i))
    .filter((i) => i.qty > 0);
  return priced(user, { ...bag, items });
}

export async function applyCodeAction(code: string): Promise<Totals> {
  const parsed = z.string().trim().min(1).max(40).parse(code);
  const { user, bag } = await current();
  return priced(user, { ...bag, code: parsed });
}

export async function removeCodeAction(): Promise<Totals> {
  const { user, bag } = await current();
  return priced(user, { ...bag, code: null });
}
