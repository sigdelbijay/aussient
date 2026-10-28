"use client";

import { useActionState } from "react";
import { FormAlert, SubmitButton } from "@/components/auth/form-bits";
import { acceptInviteAction } from "@/lib/admin/staff-actions";

/** The staff invite form; on success the action sends them to log in. */
export function AcceptInviteForm({ token, children }: { token: string; children: React.ReactNode }) {
  const [state, action] = useActionState(acceptInviteAction, undefined);
  return (
    <form action={action} className="grid gap-4">
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <input type="hidden" name="token" value={token} />
      {children}
      <SubmitButton>Create my login</SubmitButton>
    </form>
  );
}
