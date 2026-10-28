import type { Metadata } from "next";
import { AnnouncementsEditor } from "@/components/admin/content/announcements-editor";
import { PageHeader } from "@/components/admin/ui";
import { editorData, shopLinks } from "@/lib/admin/content-page";
import { toShopInput } from "@/lib/admin/dates";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Announcement bar" };

export default async function AnnouncementsPage() {
  await requireStaff("/admin/content/announcements");
  const [data, links] = await Promise.all([editorData("announcements"), shopLinks()]);
  return (
    <>
      <PageHeader title="Announcement bar" description="Short messages that scroll across the top of every page." />
      <AnnouncementsEditor initial={data.doc ?? { items: [] }} hasDraft={data.hasDraft} versions={data.versions} links={links} now={toShopInput(new Date())} />
    </>
  );
}
