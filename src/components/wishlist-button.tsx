"use client";

import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { cn } from "cn";
import { toggleWishlist, useWishlist } from "@/lib/wishlist-store";

/** Heart toggle. Guests are sent to log in, then back to this page. */
export function WishlistButton({ productId, className }: { productId: string; className?: string }) {
  const { ids } = useWishlist();
  const router = useRouter();
  const pathname = usePathname();
  const on = ids.has(productId);

  async function onClick() {
    const result = await toggleWishlist(productId);
    if (result === "login") router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        "grid size-9 place-items-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-all duration-200 ease-snappy hover:scale-110 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Heart
        className={cn("size-4 transition-colors duration-200", on && "fill-brand-accent text-brand-accent")}
      />
    </button>
  );
}
