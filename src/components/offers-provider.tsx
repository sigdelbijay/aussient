"use client";

import { createContext, useContext } from "react";

/** Each automatic offer running now: its badge, its full text and which products it covers (null = all). */
export type OfferBadge = { id: string; badge: string; text: string; productIds: string[] | null };

const OffersContext = createContext<OfferBadge[]>([]);

/** Set once in the shop layout, so every product card and page can show offer badges. */
export function OffersProvider({ offers, children }: { offers: OfferBadge[]; children: React.ReactNode }) {
  return <OffersContext.Provider value={offers}>{children}</OffersContext.Provider>;
}

/** The offers covering one product, e.g. [{ badge: "Buy 3 get 1", text: "Buy 3, get 1 free on Earrings" }]. */
export function useOffers(productId: string): OfferBadge[] {
  return useContext(OffersContext).filter((o) => o.productIds === null || o.productIds.includes(productId));
}
