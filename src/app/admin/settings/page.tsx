import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Settings" };

const money = (d: { toString(): string } | null | undefined) => (d == null ? "" : Number(d).toFixed(2));

export default async function SettingsPage() {
  // Settings are ADMIN only — STAFF can't change them.
  await requireAdmin("/admin/settings");
  const s = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });

  return (
    <>
      <PageHeader title="Settings" description="Store details, shipping and stock alerts. Payments and staff come later." />
      <SettingsForm
        key={s?.updatedAt.toISOString()}
        values={{
          storeName: s?.storeName ?? "Aussient",
          tagline: s?.tagline ?? "",
          metaDescription: s?.metaDescription ?? "",
          supportEmail: s?.supportEmail ?? "",
          freeShippingThreshold: money(s?.freeShippingThreshold),
          flatShippingRate: money(s?.flatShippingRate),
          deliveryInfo: s?.deliveryInfo ?? "",
          returnsInfo: s?.returnsInfo ?? "",
          lowStockAlert: s?.lowStockAlert ?? 5,
        }}
      />
    </>
  );
}
