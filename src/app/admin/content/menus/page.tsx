import type { Metadata } from "next";
import { MenuEditor } from "@/components/admin/content/menu-editor";
import { PageHeader } from "@/components/admin/ui";
import { editorData, linkTargets, shopLinks, uploadConfig } from "@/lib/admin/content-page";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Menus" };

export default async function MenusPage() {
  await requireStaff("/admin/content/menus");
  const [data, targets, links] = await Promise.all([editorData("menu"), linkTargets(), shopLinks()]);
  return (
    <>
      <PageHeader title="Menus" description="The links in the header and footer." />
      <MenuEditor initial={data.doc ?? { header: [], footer: [] }} hasDraft={data.hasDraft} versions={data.versions} cloudinary={uploadConfig()} targets={targets} links={links} />
    </>
  );
}
