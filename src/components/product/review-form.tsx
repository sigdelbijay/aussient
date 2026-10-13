"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert, SubmitButton } from "@/components/auth/form-bits";
import {
  getReviewEligibilityAction,
  submitReviewAction,
  type ReviewEligibility,
} from "@/lib/shop-actions";

/**
 * "Write a review". Checks on click whether this shopper bought the item, so
 * the cached product page doesn't need to know who's looking at it.
 */
export function ReviewForm({ productId }: { productId: string }) {
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [checking, startCheck] = useTransition();
  const pathname = usePathname();

  if (!eligibility) {
    return (
      <Button
        variant="outline"
        size="lg"
        disabled={checking}
        onClick={() => startCheck(async () => setEligibility(await getReviewEligibilityAction(productId)))}
        className="h-11 px-5 font-semibold"
      >
        {checking && <Loader2 className="animate-spin" />}
        Write a review
      </Button>
    );
  }

  const note = (children: React.ReactNode) => (
    <p className="rounded-lg bg-muted px-4 py-3 text-sm">{children}</p>
  );

  switch (eligibility) {
    case "login":
      return note(
        <>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`${pathname}#reviews`)}`}
            className="font-semibold underline"
          >
            Log in
          </Link>{" "}
          to review this item. Reviews are from customers who&apos;ve bought it.
        </>,
      );
    case "not-purchased":
      return note("Only customers who've bought this item can review it.");
    case "already-reviewed":
      return note("Thanks — you've already reviewed this item.");
    default:
      return <Form productId={productId} />;
  }
}

function Form({ productId }: { productId: string }) {
  const [state, action] = useActionState(submitReviewAction, undefined);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  if (state?.message) return <FormAlert tone="success">{state.message}</FormAlert>;

  return (
    <form action={action} className="grid max-w-xl gap-4 rounded-lg border border-border p-5">
      <input type="hidden" name="productId" value={productId} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Your rating</legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
              <input
                type="radio"
                name="rating"
                value={n}
                required
                checked={rating === n}
                onChange={() => setRating(n)}
                className="peer sr-only"
              />
              <span className="sr-only">
                {n} {n === 1 ? "star" : "stars"}
              </span>
              <Star
                aria-hidden
                className={cn(
                  "size-7 rounded-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                  n <= (hover || rating) ? "fill-brand-gold text-brand-gold" : "text-border",
                )}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Title (optional)</span>
        <Input name="title" maxLength={100} placeholder="Sum it up" />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Your review</span>
        <textarea
          name="body"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          placeholder="How does it look, feel and wear?"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
      </label>
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <SubmitButton className="w-auto justify-self-start px-6">Submit review</SubmitButton>
    </form>
  );
}
