"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeAction } from "@/lib/newsletter";

/** Email signup. `tone="dark"` for use on the black footer / dark sections. */
export function NewsletterForm({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [state, action] = useActionState(subscribeAction, undefined);
  const dark = tone === "dark";

  if (state?.ok) {
    return (
      <p
        role="status"
        className={cn(
          "flex items-center gap-2 text-sm",
          dark ? "text-brand-paper/80" : "text-foreground",
        )}
      >
        <Check className={cn("size-4", dark ? "text-brand-orange" : "text-brand-accent")} />
        You&apos;re in — watch your inbox for 10% off.
      </p>
    );
  }

  return (
    <form action={action} className="grid max-w-sm gap-2">
      <div className="flex gap-2">
        <Input
          type="email"
          name="email"
          required
          placeholder="Email address"
          aria-label="Email address"
          autoComplete="email"
          className={cn(
            dark &&
              "border-brand-paper/20 bg-brand-paper/5 text-brand-paper placeholder:text-brand-paper/50",
          )}
        />
        <SubmitArrow />
      </div>
      {state?.error && (
        <p role="alert" className={cn("text-xs", dark ? "text-brand-orange" : "text-brand-accent")}>
          {state.error}
        </p>
      )}
    </form>
  );
}

function SubmitArrow() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className="h-10 bg-brand-accent px-3 text-brand-accent-foreground hover:bg-brand-accent/85"
      aria-label="Subscribe"
    >
      {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
    </Button>
  );
}
