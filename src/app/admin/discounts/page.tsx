import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Discounts" };

export default async function DiscountsPage() {
  await requireStaff("/admin/discounts");
  return (
    <ComingSoon
      title="Discounts"
      description="Create discount codes and automatic offers (percent off, dollar off, free shipping, buy X get Y), with limits and dates."
    />
  );
}
