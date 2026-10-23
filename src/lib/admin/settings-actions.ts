"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { diff, recordChange } from "./activity";
import { fieldErrors, optionalMoney, optionalText, wholeNumber, type AdminFormState } from "./form";

/** Store settings. ADMIN only — STAFF can't change settings. */

const settingsSchema = z.object({
  storeName: z.string().trim().min(1, "Enter the store name").max(60),
  tagline: optionalText(80),
  metaDescription: optionalText(170),
  supportEmail: z.preprocess((v) => (v === "" ? null : v), z.email("Enter an email address").max(120).nullable()),
  freeShippingThreshold: optionalMoney,
  flatShippingRate: optionalMoney,
  deliveryInfo: optionalText(2000),
  returnsInfo: optionalText(2000),
  lowStockAlert: wholeNumber.refine((n) => n <= 1000, "Use 1000 or less"),
});

export async function saveSettingsAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const data = parsed.data;

  const before = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  await prisma.siteSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
  const changes = diff(before ?? {}, data);
  if (Object.keys(changes).length) {
    await recordChange(
      user,
      { action: "settings.update", entity: "SiteSettings", entityId: "singleton", detail: { changes } },
      // Settings show in the header/footer (content) and on product pages (products).
      { refresh: ["content", "products"] },
    );
  }
  return { message: "Settings saved." };
}
