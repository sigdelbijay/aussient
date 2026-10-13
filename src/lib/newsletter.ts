"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";

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

  await prisma.newsletterSubscriber.upsert({
    where: { email: email.data },
    update: { unsubscribedAt: null },
    create: { email: email.data },
  });
  return { ok: true };
}
