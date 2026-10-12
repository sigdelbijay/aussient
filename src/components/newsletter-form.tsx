"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewsletterForm() {
  const [done, setDone] = useState(false);

  // Placeholder only — wiring to the mailing list comes in a later prompt.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDone(true);
  }

  if (done) {
    return (
      <p className="flex items-center gap-2 text-sm text-brand-paper/80">
        <Check className="size-4 text-brand-accent" />
        You&apos;re in — watch your inbox for 10% off.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm gap-2">
      <Input
        type="email"
        required
        placeholder="Email address"
        aria-label="Email address"
        className="border-brand-paper/20 bg-brand-paper/5 text-brand-paper placeholder:text-brand-paper/50"
      />
      <Button
        type="submit"
        size="lg"
        variant="default"
        className="bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/85"
        aria-label="Subscribe"
      >
        <ArrowRight />
      </Button>
    </form>
  );
}
