import Link from "next/link";
import { Star } from "lucide-react";
import { cn } from "cn";
import { getApprovedReviews } from "@/lib/storefront";
import { ScrollRow } from "./scroll-row";
import { SectionHeading, SectionShell } from "./section-heading";

/** Approved customer reviews. Hidden until there's at least one. */
export async function Reviews({ title, limit }: { title: string | null; limit: number }) {
  const reviews = await getApprovedReviews(limit);
  if (reviews.length === 0) return null;

  return (
    <SectionShell>
      <SectionHeading title={title} />
      <ScrollRow label={title ?? "Customer reviews"}>
        {reviews.map((r) => (
          <figure
            key={r.id}
            className="flex w-[85%] shrink-0 snap-start flex-col gap-3 rounded-xl border border-border bg-card p-6 sm:w-[45%] lg:w-[31%]"
          >
            <div className="flex gap-0.5" aria-label={`${r.rating} out of 5 stars`} role="img">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={cn(
                    "size-4",
                    n <= r.rating ? "fill-brand-gold text-brand-gold" : "text-border",
                  )}
                />
              ))}
            </div>
            {r.title && <p className="font-heading font-extrabold">{r.title}</p>}
            {r.body && (
              <blockquote className="text-sm leading-relaxed text-muted-foreground">
                “{r.body}”
              </blockquote>
            )}
            <figcaption className="mt-auto pt-2 text-xs">
              <span className="font-semibold">{r.author}</span>
              <span className="text-muted-foreground"> on </span>
              <Link href={`/products/${r.product.slug}`} className="font-medium hover:underline">
                {r.product.name}
              </Link>
            </figcaption>
          </figure>
        ))}
      </ScrollRow>
    </SectionShell>
  );
}
