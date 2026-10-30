"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { isShopImage } from "@/lib/content/docs";
import { SOCIALS, type SocialKey } from "@/lib/socials";
import { trimVersions } from "@/lib/content/store";
import { diff, recordChange } from "./activity";
import { formatShopDate } from "./dates";
import { fieldErrors, optionalMoney, optionalText, wholeNumber, type AdminFormState } from "./form";

/** Store settings. ADMIN only — STAFF can't change settings. Each save is kept as a version for undo. */

const SOCIAL_KEYS = Object.keys(SOCIALS) as SocialKey[];

/** ABNs have a check digit: this catches typos (see business.gov.au). */
function abnIsValid(abn: string) {
  const digits = abn.replace(/\s/g, "");
  if (!/^\d{11}$/.test(digits)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = [...digits].reduce((total, d, i) => total + (Number(d) - (i === 0 ? 1 : 0)) * weights[i], 0);
  return sum % 89 === 0;
}

const url = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.url({ protocol: /^https$/, message: "Enter the full link, starting https://" }).max(300).nullable(),
);

const settingsSchema = z.object({
  storeName: z.string().trim().min(1, "Enter the store name").max(60),
  logo: z.preprocess((v) => (v === "" ? null : v), z.string().max(500).refine(isShopImage, "Upload the logo here").nullable()),
  tagline: optionalText(80),
  metaDescription: optionalText(170),
  supportEmail: z.preprocess((v) => (v === "" ? null : v), z.email("Enter an email address").max(120).nullable()),
  orderAlertEmail: z.preprocess((v) => (v === "" ? null : v), z.email("Enter an email address").max(120).nullable()),
  contactPhone: optionalText(30).refine((v) => v === null || /^[\d\s()+-]{6,30}$/.test(v), "Enter a phone number like 02 9000 0000"),
  abn: optionalText(20)
    .transform((v) => (v === null ? null : v.replace(/\s/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4")))
    .refine((v) => v === null || (abnIsValid(v)), "That ABN doesn't look right — check the 11 digits"),
  accentColor: z.preprocess((v) => (v === "" ? null : typeof v === "string" ? v.toLowerCase() : v), z.string().regex(/^#[0-9a-f]{6}$/, "Pick a colour").nullable()),
  freeShippingThreshold: optionalMoney,
  flatShippingRate: optionalMoney,
  expressShippingRate: optionalMoney,
  deliveryInfo: optionalText(2000),
  returnsInfo: optionalText(2000),
  newsletterHeading: optionalText(60),
  newsletterText: optionalText(300),
  footerPerks: z
    .string()
    .max(500)
    .transform((t) => t.split("\n").map((l) => l.trim()).filter(Boolean))
    .refine((l) => l.length <= 4, "Up to 4 lines"),
  googleAnalyticsId: optionalText(20)
    .transform((v) => v?.toUpperCase() ?? null)
    .refine((v) => v === null || /^G-[A-Z0-9]{4,15}$/.test(v), "Use the Measurement ID, like G-ABC123XYZ"),
  lowStockAlert: wholeNumber.refine((n) => n <= 1000, "Use 1000 or less"),
  ...Object.fromEntries(SOCIAL_KEYS.map((s) => [`social_${s}`, url])),
});

type Snapshot = Omit<Prisma.SiteSettingsUncheckedCreateInput, "id" | "updatedAt">;

/** The settings as they're stored, for the version history. */
async function snapshot(): Promise<Snapshot | null> {
  const s = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  if (!s) return null;
  const { id: _id, updatedAt: _u, ...rest } = s;
  void _id;
  void _u;
  return JSON.parse(JSON.stringify(rest)); // Decimals → strings, JSON-safe
}

async function keepVersion(userId: string | null) {
  const data = await snapshot();
  if (data) await prisma.contentVersion.create({ data: { key: "settings", data: data as Prisma.InputJsonValue, userId } });
  await trimVersions("settings");
}

export async function saveSettingsAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const all = parsed.data as z.infer<typeof settingsSchema> & Record<string, string | null>;
  const socials = Object.fromEntries(SOCIAL_KEYS.flatMap((s) => (all[`social_${s}`] ? [[s, all[`social_${s}`]]] : [])));
  const data = Object.fromEntries(Object.entries(all).filter(([k]) => !k.startsWith("social_"))) as Omit<Snapshot, "socials">;
  const values = { ...data, newsletterHeading: data.newsletterHeading ?? "Join the list", socials };

  const before = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  const changes = diff(
    { ...(before ?? {}), footerPerks: JSON.stringify(before?.footerPerks ?? []), socials: JSON.stringify(before?.socials ?? {}) },
    { ...values, footerPerks: JSON.stringify(values.footerPerks), socials: JSON.stringify(socials) },
  );
  if (!Object.keys(changes).length) return { message: "Nothing changed." };

  // The first save also keeps what was there before, so it can be undone.
  if ((await prisma.contentVersion.count({ where: { key: "settings" } })) === 0) await keepVersion(null);
  await prisma.siteSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...values }, update: values });
  await keepVersion(user.id);
  await recordChange(
    user,
    { action: "settings.update", entity: "SiteSettings", entityId: "singleton", detail: { changes } },
    // Settings show in the header/footer (content) and on product pages (products).
    { refresh: ["content", "products"] },
  );
  revalidatePath("/admin/settings");
  return { message: "Settings saved." };
}

/** Undo: puts an earlier version of the settings back. */
export async function restoreSettingsAction(versionId: string): Promise<AdminFormState> {
  const user = await requireAdmin();
  const version = await prisma.contentVersion.findUnique({ where: { id: z.string().max(64).parse(versionId) } });
  if (!version || version.key !== "settings") return { error: "That version no longer exists." };
  // Only fields the settings still have; empty lists are stored as "no value".
  const known = new Set(Object.keys((await snapshot()) ?? {}));
  const data = Object.fromEntries(
    Object.entries(version.data as Record<string, unknown>)
      .filter(([k]) => known.has(k))
      .map(([k, v]) => [k, v === null && (k === "socials" || k === "footerPerks") ? Prisma.DbNull : v]),
  );
  await prisma.siteSettings.update({ where: { id: "singleton" }, data: data as Prisma.SiteSettingsUpdateInput });
  await keepVersion(user.id);
  await recordChange(
    user,
    { action: "settings.restore", entity: "SiteSettings", entityId: "singleton", detail: { restored: formatShopDate(version.createdAt) } },
    { refresh: ["content", "products"] },
  );
  revalidatePath("/admin/settings");
  return { message: `Restored the settings from ${formatShopDate(version.createdAt)}.` };
}
