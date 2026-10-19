import type { Metadata } from "next";
import { CartView } from "@/components/bag/cart-view";

export const metadata: Metadata = {
  title: "Your bag",
  robots: { index: false, follow: false },
};

/** The bag is loaded in the browser (it's per-shopper), so this page itself stays static. */
export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <h1 className="text-display mb-6 text-3xl sm:text-5xl">Your bag</h1>
      <CartView />
    </div>
  );
}
