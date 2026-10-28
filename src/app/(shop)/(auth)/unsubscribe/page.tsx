import type { Metadata } from "next";
import { ActionForm } from "@/components/auth/action-form";
import { AuthHeading } from "@/components/auth/auth-heading";
import { FormAlert } from "@/components/auth/form-bits";
import { isValidUnsubscribe } from "@/lib/marketing";
import { unsubscribeAction } from "@/lib/unsubscribe-action";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

/**
 * Opened from the "Unsubscribe" link in marketing emails. It asks for a
 * click rather than unsubscribing straight away, because some email apps
 * open links by themselves to scan them.
 */
export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const sp = await searchParams;
  const email = typeof sp.e === "string" ? sp.e : "";
  const token = typeof sp.t === "string" ? sp.t : "";
  const valid = email !== "" && isValidUnsubscribe(email, token);

  return (
    <>
      <AuthHeading title="Unsubscribe" subtitle={valid ? `Stop news, offers and bag reminders going to ${email}?` : undefined} />
      {valid ? (
        <ActionForm action={unsubscribeAction} submitLabel="Unsubscribe me">
          <input type="hidden" name="e" value={email} />
          <input type="hidden" name="t" value={token} />
        </ActionForm>
      ) : (
        <FormAlert tone="error">This unsubscribe link isn&apos;t valid. Use the link in your latest email, or change it under My account.</FormAlert>
      )}
    </>
  );
}
