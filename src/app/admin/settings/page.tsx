import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  // Settings are ADMIN only — STAFF can't change them.
  await requireAdmin("/admin/settings");
  return (
    <ComingSoon
      title="Settings"
      description="Store name, shipping rates, free-shipping threshold, social links and email templates."
    />
  );
}
