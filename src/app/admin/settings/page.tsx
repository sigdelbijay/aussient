import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/admin/ui";
import { uploadConfig } from "@/lib/admin/content-page";
import { formatShopDate } from "@/lib/admin/dates";
import { requireAdmin } from "@/lib/auth/dal";
import { listVersions } from "@/lib/content/store";
import { prisma } from "@/lib/prisma";
import type { SocialKey } from "@/lib/socials";

export const metadata: Metadata = { title: "Settings" };

const money = (d: { toString(): string } | null | undefined) => (d == null ? "" : Number(d).toFixed(2));

export default async function SettingsPage() {
  // Settings are ADMIN only — STAFF can't change them.
  await requireAdmin("/admin/settings");
  const [s, versions] = await Promise.all([prisma.siteSettings.findUnique({ where: { id: "singleton" } }), listVersions("settings")]);

  return (
    <>
      <PageHeader title="Settings" description="Store details, contact, colour, shipping and stock alerts. Changes show in the shop straight away." />
      {/* Not keyed by updatedAt: saving would reset the form and hide the "saved" message. */}
      <SettingsForm
        cloudinary={uploadConfig()}
        versions={versions.map((v) => ({ id: v.id, when: formatShopDate(v.createdAt), by: v.by }))}
        values={{
          storeName: s?.storeName ?? "Aussient",
          logo: s?.logo ?? "",
          tagline: s?.tagline ?? "",
          metaDescription: s?.metaDescription ?? "",
          supportEmail: s?.supportEmail ?? "",
          orderAlertEmail: s?.orderAlertEmail ?? "",
          contactPhone: s?.contactPhone ?? "",
          abn: s?.abn ?? "",
          accentColor: s?.accentColor ?? "",
          socials: (s?.socials as Partial<Record<SocialKey, string>>) ?? {},
          freeShippingThreshold: money(s?.freeShippingThreshold),
          flatShippingRate: money(s?.flatShippingRate),
          expressShippingRate: money(s?.expressShippingRate),
          deliveryInfo: s?.deliveryInfo ?? "",
          returnsInfo: s?.returnsInfo ?? "",
          newsletterHeading: s?.newsletterHeading ?? "",
          newsletterText: s?.newsletterText ?? "",
          footerPerks: Array.isArray(s?.footerPerks) ? (s.footerPerks as string[]).join("\n") : "",
          lowStockAlert: s?.lowStockAlert ?? 5,
          googleAnalyticsId: s?.googleAnalyticsId ?? "",
        }}
      />
    </>
  );
}
