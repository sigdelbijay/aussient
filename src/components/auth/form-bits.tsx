"use client";

import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Labelled input used across the auth and account forms. */
export function Field({
  label,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; hint?: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Input {...props} />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Full-width submit button that shows a spinner while its form is sending. */
export function SubmitButton({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className={cn("h-11 w-full font-semibold", className)}
      {...props}
    >
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

export function FormAlert({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md px-3 py-2.5 text-sm",
        tone === "error"
          ? "bg-destructive/10 text-destructive"
          : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
