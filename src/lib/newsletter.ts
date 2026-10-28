"use server";

import { z } from "zod";
import { setMarketingConsent } from "@/lib/marketing";

export type NewsletterState = { ok?: boolean; error?: string } | undefined;

/** Adds (or re-subscribes) an email to the newsletter list. */
export async function subscribeAction(
  _prev: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const email = z
    .email()
    .max(254)
    .transform((e) => e.toLowerCase().trim())
    .safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };

  // Also ticks "email me news and offers" on their account, if they have one.
  await setMarketingConsent(email.data, true);
  return { ok: true };
}
