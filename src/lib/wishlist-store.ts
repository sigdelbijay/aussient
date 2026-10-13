"use client";

import { useSyncExternalStore } from "react";
import { getWishlistAction, toggleWishlistAction } from "@/lib/shop-actions";

/**
 * Which products the signed-in shopper has hearted. Loaded once per page
 * visit in the browser, so the shop pages themselves can stay cached.
 */

type State = { loaded: boolean; loggedIn: boolean; ids: ReadonlySet<string> };

let state: State = { loaded: false, loggedIn: false, ids: new Set() };
const SERVER_STATE: State = state;
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

function load() {
  loading ??= getWishlistAction()
    .then(({ loggedIn, ids }) => set({ loaded: true, loggedIn, ids: new Set(ids) }))
    .catch(() => set({ ...state, loaded: true }));
  return loading;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  void load();
  return () => listeners.delete(cb);
}

export function useWishlist() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
}

/** Hearts or un-hearts a product. Returns "login" when the shopper needs to sign in first. */
export async function toggleWishlist(productId: string): Promise<"ok" | "login" | "error"> {
  await load();
  if (!state.loggedIn) {
    // They may have logged in since this page first loaded — check again once.
    loading = null;
    await load();
    if (!state.loggedIn) return "login";
  }

  const had = state.ids.has(productId);
  const optimistic = new Set(state.ids);
  if (had) optimistic.delete(productId);
  else optimistic.add(productId);
  set({ ...state, ids: optimistic });

  try {
    const res = await toggleWishlistAction(productId);
    if (res.ok) return "ok";
    if (res.reason === "login") {
      set({ ...state, loggedIn: false });
      return "login";
    }
  } catch {
    // fall through to revert
  }
  const reverted = new Set(state.ids);
  if (had) reverted.add(productId);
  else reverted.delete(productId);
  set({ ...state, ids: reverted });
  return "error";
}
