"use client";

import { useSyncExternalStore } from "react";
import {
  addToBagAction,
  applyCodeAction,
  getBagAction,
  removeCodeAction,
  setQuantityAction,
} from "@/lib/cart/actions";
import { lineKey, type BagLine, type Totals } from "@/lib/cart/pricing";
import { MAX_QTY } from "@/lib/catalog-shared";

/**
 * The shopping bag in the browser. The server owns the bag (cookie for
 * guests, database for signed-in shoppers) and all prices; this store shows
 * changes straight away, then swaps in the server's totals when they arrive.
 */

type State = {
  totals: Totals | null;
  /** Slide-out panel open? */
  open: boolean;
  /** Changes still being confirmed by the server (totals may be about to change). */
  pending: number;
};

const EMPTY_TOTALS: Totals = {
  lines: [],
  itemCount: 0,
  subtotal: 0,
  discount: null,
  code: null,
  shipping: 0,
  freeShippingThreshold: null,
  freeShippingRemaining: null,
  savings: 0,
  total: 0,
  canCheckout: false,
};

let state: State = { totals: null, open: false, pending: 0 };
const SERVER_STATE = state;
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;
/** Id of the newest request; older responses are ignored so fast clicks don't flicker. */
let latest = 0;

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function load() {
  loading ??= run(getBagAction);
  return loading;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  void load();
  return () => listeners.delete(cb);
}

/** Applies an optimistic change now, then the server's answer (if it's still the newest). */
async function run(action: () => Promise<Totals>, optimistic?: (t: Totals) => Totals) {
  const id = ++latest;
  if (optimistic) set({ totals: optimistic(state.totals ?? EMPTY_TOTALS) });
  set({ pending: state.pending + 1 });
  try {
    const totals = await action();
    if (id === latest) set({ totals });
  } catch {
    // Something went wrong — show what the server actually has.
    if (id === latest) {
      try {
        set({ totals: await getBagAction() });
      } catch {
        // offline: keep what we have
      }
    }
  } finally {
    set({ pending: state.pending - 1 });
  }
}

// ── Quick local maths for instant feedback (the server's numbers replace these) ──

function withLines(t: Totals, lines: BagLine[]): Totals {
  const subtotal = Math.round(lines.reduce((n, l) => n + l.lineTotal, 0) * 100) / 100;
  const delta = subtotal - t.subtotal;
  return {
    ...t,
    lines,
    itemCount: lines.reduce((n, l) => n + l.qty, 0),
    subtotal,
    total: Math.max(0, Math.round((t.total + delta) * 100) / 100),
    freeShippingRemaining:
      t.freeShippingRemaining === null ? null : Math.max(0, Math.round((t.freeShippingRemaining - delta) * 100) / 100),
  };
}

function withQty(t: Totals, key: string, qty: number): Totals {
  return withLines(
    t,
    t.lines
      .map((l) =>
        l.key === key
          ? { ...l, qty, lineTotal: l.issue === "sold-out" || l.issue === "unavailable" ? 0 : l.unitPrice * qty }
          : l,
      )
      .filter((l) => l.qty > 0),
  );
}

// ── Public API ──────────────────────────────────────────────────

export function useBag() {
  const s = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
  return { ...s, count: s.totals?.itemCount ?? 0 };
}

export const openBag = () => set({ open: true });
export const closeBag = () => set({ open: false });

/** Adds to the bag and opens the slide-out panel. Price/image are only for the instant preview. */
export function addToBag(
  item: {
    productId: string;
    variantId: string | null;
    slug: string;
    name: string;
    variantName: string | null;
    price: number;
    compareAtPrice?: number | null;
    image: string | null;
  },
  qty = 1,
) {
  set({ open: true });
  const key = lineKey(item.productId, item.variantId);
  return run(
    () => addToBagAction(item.productId, item.variantId, qty),
    (t) => {
      const existing = t.lines.find((l) => l.key === key);
      if (existing) return withQty(t, key, Math.min(existing.maxQty || MAX_QTY, existing.qty + qty));
      const line: BagLine = {
        key,
        productId: item.productId,
        variantId: item.variantId,
        slug: item.slug,
        name: item.name,
        variantName: item.variantName,
        image: item.image,
        unitPrice: item.price,
        compareAtPrice: item.compareAtPrice ?? null,
        qty,
        lineTotal: item.price * qty,
        maxQty: MAX_QTY,
        issue: null,
      };
      return withLines(t, [...t.lines, line]);
    },
  );
}

export function setQuantity(line: BagLine, qty: number) {
  const next = Math.max(0, Math.min(qty, line.maxQty || MAX_QTY, MAX_QTY));
  return run(
    () => setQuantityAction(line.productId, line.variantId, next),
    (t) => withQty(t, line.key, next),
  );
}

export const removeLine = (line: BagLine) => setQuantity(line, 0);

/** Applies a discount code; resolves to the problem with it, or null if it worked. */
export async function applyCode(code: string): Promise<string | null> {
  await run(() => applyCodeAction(code));
  return state.totals?.code?.error ?? null;
}

export const removeCode = () => run(removeCodeAction);
