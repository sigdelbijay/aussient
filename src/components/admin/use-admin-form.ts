"use client";

import { startTransition, useActionState } from "react";
import type { AdminFormState } from "@/lib/admin/form";

/**
 * Like useActionState, but submits via onSubmit so React doesn't clear the
 * form afterwards — a validation error keeps everything the admin typed.
 */
export function useAdminForm(action: (prev: AdminFormState, formData: FormData) => Promise<AdminFormState>) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  return { state, onSubmit, pending };
}
