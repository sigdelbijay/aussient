"use client";

import { useSyncExternalStore } from "react";
import { MAX_QTY } from "@/lib/catalog-shared";

/**
 * The shopping bag, kept in the browser (localStorage) so it survives reloads
 * and works for guests. Prices here are for display only — checkout must
 * re-price everything on the server.
 */

export type BagItem = {
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  price: number;
  image: string | null;
  qty: number;
};

const KEY = "aussient-bag";
const EMPTY: BagItem[] = [];

let items: BagItem[] | null = null;
const listeners = new Set<() => void>();

function read(): BagItem[] {
  if (items) return items;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    items = [];
  }
  return items!;
}

function write(next: BagItem[]) {
  items = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked — the bag still works for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Keep tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      items = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function addToBag(item: Omit<BagItem, "qty">, qty = 1) {
  const current = read();
  const i = current.findIndex((x) => x.productId === item.productId && x.variantId === item.variantId);
  const next = [...current];
  if (i >= 0) next[i] = { ...next[i], ...item, qty: Math.min(MAX_QTY, next[i].qty + qty) };
  else next.push({ ...item, qty: Math.min(MAX_QTY, qty) });
  write(next);
}

export function useBag() {
  const bag = useSyncExternalStore(subscribe, read, () => EMPTY);
  return { items: bag, count: bag.reduce((n, i) => n + i.qty, 0) };
}
