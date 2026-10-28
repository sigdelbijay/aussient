"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/dal";
import { EMAIL_TEMPLATES, isEmailKey } from "@/lib/email-templates";
import { diff, recordChange } from "./activity";
import { fieldErrors, type AdminFormState } from "./form";

/** Edits the subject and opening text of a customer email (Site Content → Emails). */

const emailSchema = z.object({
  key: z.string().refine(isEmailKey, "Unknown email"),
  subject: z.string().trim().min(1, "Enter a subject").max(150),
  body: z.string().trim().min(1, "Enter the opening text").max(2000),
});

export async function saveEmailAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = await requireStaff();
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { key, subject, body } = parsed.data;

  const before = await prisma.emailTemplate.findUnique({ where: { key } });
  await prisma.emailTemplate.upsert({ where: { key }, create: { key, subject, body }, update: { subject, body } });
  const fallback = EMAIL_TEMPLATES[key as keyof typeof EMAIL_TEMPLATES];
  await recordChange(
    user,
    { action: "email.update", entity: "EmailTemplate", entityId: key, detail: { name: fallback.name, changes: diff(before ?? fallback, { subject, body }) } },
    { refresh: [] },
  );
  revalidatePath("/admin/content/emails");
  return { message: `“${fallback.name}” saved. The next one sent uses this text.` };
}

/** Goes back to the built-in text. */
export async function resetEmailAction(key: string): Promise<AdminFormState> {
  const user = await requireStaff();
  if (!isEmailKey(key)) return { error: "Unknown email." };
  await prisma.emailTemplate.deleteMany({ where: { key } });
  await recordChange(user, { action: "email.reset", entity: "EmailTemplate", entityId: key, detail: { name: EMAIL_TEMPLATES[key].name } }, { refresh: [] });
  revalidatePath("/admin/content/emails");
  return { message: "Back to the original text." };
}
