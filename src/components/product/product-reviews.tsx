import type { ProductDetail } from "@/lib/catalog";
import { ReviewForm } from "./review-form";
import { Stars } from "./stars";

const date = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" });

/** Approved reviews with the average rating, plus the review form for buyers. */
export function ProductReviews({ product }: { product: ProductDetail }) {
  const { rating, reviews } = product;

  return (
    <section id="reviews" className="scroll-mt-24 border-t border-border py-10 sm:py-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-display text-3xl sm:text-4xl">Reviews</h2>
          {rating.count > 0 ? (
            <p className="mt-2 flex items-center gap-2 text-sm">
              <Stars rating={rating.average} />
              <span className="font-semibold">{rating.average.toFixed(1)} out of 5</span>
              <span className="text-muted-foreground">
                · {rating.count} {rating.count === 1 ? "review" : "reviews"}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No reviews yet — be the first.</p>
          )}
        </div>
        <ReviewForm productId={product.id} />
      </div>

      {reviews.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
              <Stars rating={r.rating} />
              {r.title && <p className="font-heading font-extrabold">{r.title}</p>}
              {r.body && <p className="text-sm leading-relaxed text-muted-foreground">{r.body}</p>}
              <p className="mt-auto pt-1 text-xs">
                <span className="font-semibold">{r.author}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {date.format(new Date(r.createdAt))}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
