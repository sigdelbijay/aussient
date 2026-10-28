"use server";

import { z } from "zod";
import { isValidUnsubscribe, setMarketingConsent } from "@/lib/marketing";
import type { FormState } from "@/lib/auth/actions";

/** The button on the page an email's "Unsubscribe" link opens. No login needed: the link is signed. */
export async function unsubscribeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ e: z.string().max(254), t: z.string().max(100) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success || !isValidUnsubscribe(parsed.data.e, parsed.data.t)) {
    return { error: "This unsubscribe link isn't valid. Use the link in your latest email, or change it in your account." };
  }
  await setMarketingConsent(parsed.data.e, false);
  return { message: `Done — ${parsed.data.e} won't get marketing emails from us any more. Order emails still come as usual.` };
}
