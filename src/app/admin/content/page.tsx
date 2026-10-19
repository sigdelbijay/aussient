import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Site Content" };

export default async function SiteContentPage() {
  await requireStaff("/admin/content");
  return (
    <ComingSoon
      title="Site Content"
      description="Edit the home page sections, banners, announcement bar, menus and pages."
    />
  );
}
