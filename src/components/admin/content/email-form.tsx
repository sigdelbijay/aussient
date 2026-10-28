"use client";

import { useEffect, useRef, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { FormAlert } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { resetEmailAction, saveEmailAction } from "@/lib/admin/email-actions";
import { AdminField, inputClass, textareaClass } from "../ui";
import { useAdminForm } from "../use-admin-form";

/** Subject and opening text of one email. */
export function EmailForm({ emailKey, subject, body, placeholders, edited }: { emailKey: string; subject: string; body: string; placeholders: string[]; edited: boolean }) {
  const { state, onSubmit, pending } = useAdminForm(saveEmailAction);
  const [resetting, startReset] = useTransition();
  const err = (k: string) => state?.fieldErrors?.[k];
  // When the saved text changes (e.g. back to the original), show it in the boxes.
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => form.current?.reset(), [subject, body]);
  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-3">
      <input type="hidden" name="key" value={emailKey} />
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state?.message && <FormAlert tone="success">{state.message}</FormAlert>}
      <AdminField label="Subject" error={err("subject")}>
        <input name="subject" defaultValue={subject} required maxLength={150} className={inputClass} />
      </AdminField>
      <AdminField label="Opening text" error={err("body")} hint={<>You can use {placeholders.map((p) => `{${p}}`).join(", ")} — they’re filled in when it’s sent.</>}>
        <textarea name="body" defaultValue={body} required rows={4} maxLength={2000} className={textareaClass} />
      </AdminField>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} className="h-9 gap-1.5 px-4">
          {pending && <Loader2 className="animate-spin" />}
          Save
        </Button>
        {edited && (
          <button type="button" disabled={resetting} onClick={() => startReset(async () => void (await resetEmailAction(emailKey)))} className="text-xs text-muted-foreground underline hover:text-foreground">
            {resetting ? "Resetting…" : "Use the original text"}
          </button>
        )}
      </div>
    </form>
  );
}
