"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { FormAlert } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import type { AdminFormState } from "@/lib/admin/form";
import { changeRoleAction, inviteStaffAction, removeStaffAction, resendInviteAction } from "@/lib/admin/staff-actions";
import { DeleteButton } from "./media-manager";
import { AdminField, inputClass } from "./ui";

/** Invite someone by email as STAFF or ADMIN. */
export function InviteForm() {
  const [state, action, pending] = useActionState(inviteStaffAction, undefined);
  return (
    <form action={action} className="grid gap-3">
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state?.message && <FormAlert tone="success">{state.message}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_auto] sm:items-end">
        <AdminField label="Email">
          <input name="email" type="email" required maxLength={254} className={inputClass} />
        </AdminField>
        <AdminField label="Name (optional)">
          <input name="name" maxLength={100} className={inputClass} />
        </AdminField>
        <AdminField label="Role">
          <select name="role" defaultValue="STAFF" className={inputClass}>
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
          </select>
        </AdminField>
        <Button type="submit" disabled={pending} className="h-10 gap-1.5 px-4">
          {pending && <Loader2 className="animate-spin" />}
          Send invite
        </Button>
      </div>
    </form>
  );
}

/** Role picker, resend and remove for one team member. */
export function StaffRowActions({ userId, role, isYou, invited }: { userId: string; role: "ADMIN" | "STAFF"; isYou: boolean; invited: boolean }) {
  const [state, setState] = useState<AdminFormState>(undefined);
  const [shownRole, setShownRole] = useState(role);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<AdminFormState>) => start(async () => setState(await fn()));
  const changeRole = (next: "ADMIN" | "STAFF") =>
    start(async () => {
      setShownRole(next);
      const result = await changeRoleAction(userId, next);
      if (result?.error) setShownRole(role); // not changed — show the real role again
      setState(result);
    });

  if (isYou) return <span className="text-xs text-muted-foreground">You</span>;
  return (
    <div className="grid justify-items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <select aria-label="Role" value={shownRole} disabled={pending} onChange={(e) => changeRole(e.target.value as "ADMIN" | "STAFF")} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
        </select>
        {invited && (
          <button type="button" disabled={pending} onClick={() => run(() => resendInviteAction(userId))} className="rounded px-1.5 py-1 text-xs underline hover:bg-muted">
            Resend invite
          </button>
        )}
        <DeleteButton label="Remove" onConfirm={() => run(() => removeStaffAction(userId))} />
      </div>
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
      {state?.message && <span className="text-xs text-emerald-700">{state.message}</span>}
    </div>
  );
}
