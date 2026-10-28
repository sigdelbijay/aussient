import type { Metadata } from "next";
import { HomeEditor } from "@/components/admin/content/home-editor";
import { PageHeader } from "@/components/admin/ui";
import { editorData, shopLinks, uploadConfig } from "@/lib/admin/content-page";
import { toShopInput } from "@/lib/admin/dates";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Home page" };

export default async function HomeContentPage() {
  await requireStaff("/admin/content/home");
  const [data, collections, links] = await Promise.all([
    editorData("home"),
    prisma.collection.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    shopLinks(),
  ]);
  return (
    <>
      <PageHeader title="Home page" description="The sections of the home page, top to bottom. Click one to edit it." />
      <HomeEditor
        initial={data.doc ?? { sections: [] }}
        hasDraft={data.hasDraft}
        versions={data.versions}
        cloudinary={uploadConfig()}
        collections={collections}
        links={links}
        now={toShopInput(new Date())}
      />
    </>
  );
}
