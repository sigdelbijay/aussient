"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/auth/actions";
import { FormAlert, SubmitButton } from "@/components/auth/form-bits";

/**
 * A form wired to a server action that returns { error } or { message }.
 * On success the fields are replaced by the success message, unless
 * `keepOnSuccess` is set (then the message shows above the form).
 */
export function ActionForm({
  action,
  submitLabel,
  keepOnSuccess = false,
  className,
  children,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  keepOnSuccess?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, undefined);

  if (state?.message && !keepOnSuccess)
    return <FormAlert tone="success">{state.message}</FormAlert>;

  return (
    <form action={formAction} className={className ?? "grid gap-4"}>
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state?.message && <FormAlert tone="success">{state.message}</FormAlert>}
      {children}
      <SubmitButton className={keepOnSuccess ? "w-auto justify-self-start px-5" : undefined}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
