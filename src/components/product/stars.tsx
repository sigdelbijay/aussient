import { Star } from "lucide-react";
import { cn } from "cn";

/** Read-only star rating; partial stars are filled to the nearest half. */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span
      className={cn("inline-flex gap-0.5", className)}
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="relative inline-block size-4">
          <Star className="absolute inset-0 size-4 text-border" />
          {rounded >= n - 0.5 && (
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: rounded >= n ? "100%" : "50%" }}
            >
              <Star className="size-4 fill-brand-gold text-brand-gold" />
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
