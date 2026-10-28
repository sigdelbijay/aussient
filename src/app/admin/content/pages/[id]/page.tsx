import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageEditor } from "@/components/admin/content/page-editor";
import { PageHeader } from "@/components/admin/ui";
import { editorData } from "@/lib/admin/content-page";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Page" };

export default async function EditPagePage({ params }: PageProps<"/admin/content/pages/[id]">) {
  const { id } = await params;
  await requireStaff(`/admin/content/pages/${id}`);
  const data = await editorData(`page:${id}`);
  if (!data.doc) notFound();
  return (
    <>
      <PageHeader
        title={data.doc.title}
        description={
          <Link href="/admin/content/pages" className="underline">
            Pages
          </Link>
        }
      />
      {/* Keyed by id so moving between pages starts fresh. */}
      <PageEditor key={id} pageId={id} initial={data.doc} hasDraft={data.hasDraft} versions={data.versions} />
    </>
  );
}
