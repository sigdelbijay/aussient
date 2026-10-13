"use client";

import { useActionState } from "react";
import { Bell, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/form-bits";
import { notifyMeAction } from "@/lib/shop-actions";

/** "Email me when it's back" signup, shown in place of Add to bag when sold out. */
export function NotifyForm({ productId, variantId }: { productId: string; variantId: string | null }) {
  const [state, action] = useActionState(notifyMeAction, undefined);

  if (state?.message) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm">
        <Check className="size-4 shrink-0 text-brand-accent" />
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-2 rounded-lg border border-border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Bell className="size-4" />
        Notify me when it&apos;s back
      </p>
      <input type="hidden" name="productId" value={productId} />
      {variantId && <input type="hidden" name="variantId" value={variantId} />}
      <div className="flex gap-2">
        <Input
          type="email"
          name="email"
          required
          placeholder="Email address"
          aria-label="Email address"
          autoComplete="email"
          className="h-11"
        />
        <SubmitButton className="w-auto px-5">Notify me</SubmitButton>
      </div>
      {state?.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
