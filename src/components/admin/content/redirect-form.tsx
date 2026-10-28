"use client";

import { useActionState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { FormAlert } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { deleteRedirectAction, saveRedirectAction } from "@/lib/admin/content-actions";
import { DeleteButton } from "../media-manager";
import { AdminField, inputClass } from "../ui";

/** Add a redirect: an old link and where it should go now. */
export function RedirectForm() {
  const [state, action, pending] = useActionState(saveRedirectAction, undefined);
  return (
    <form action={action} className="grid gap-3">
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state?.message && <FormAlert tone="success">{state.message}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <AdminField label="Old link">
          <input name="from" required maxLength={300} placeholder="/products/old-name" className={inputClass} />
        </AdminField>
        <AdminField label="New link">
          <input name="to" required maxLength={500} placeholder="/products/new-name" list="shop-links" className={inputClass} />
        </AdminField>
        <Button type="submit" disabled={pending} className="h-10 gap-1.5 px-4">
          {pending && <Loader2 className="animate-spin" />}
          Add redirect
        </Button>
      </div>
    </form>
  );
}

export function DeleteRedirect({ id }: { id: string }) {
  const [pending, start] = useTransition();
  if (pending) return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  return <DeleteButton label="Remove" onConfirm={() => start(async () => void (await deleteRedirectAction(id)))} />;
}
