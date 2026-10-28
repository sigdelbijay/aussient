import type { Metadata } from "next";
import { PopupsEditor } from "@/components/admin/content/popups-editor";
import { PageHeader } from "@/components/admin/ui";
import { editorData, shopLinks, uploadConfig } from "@/lib/admin/content-page";
import { toShopInput } from "@/lib/admin/dates";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Pop-ups" };

export default async function PopupsPage() {
  await requireStaff("/admin/content/popups");
  const [data, links] = await Promise.all([editorData("popups"), shopLinks()]);
  return (
    <>
      <PageHeader title="Pop-ups" description="A newsletter signup or sale message that pops up a few seconds after someone arrives." />
      <PopupsEditor initial={data.doc ?? { items: [] }} hasDraft={data.hasDraft} versions={data.versions} cloudinary={uploadConfig()} links={links} now={toShopInput(new Date())} />
    </>
  );
}
