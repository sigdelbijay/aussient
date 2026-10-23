import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAlert } from "@/components/auth/form-bits";
import { SizeGuideForm } from "@/components/admin/size-guide-form";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { readSizeTable } from "@/lib/product-types";

export const metadata: Metadata = { title: "Size guide" };

/** /admin/size-guides/new adds one; /admin/size-guides/<id> edits it. */
export default async function SizeGuidePage({ params, searchParams }: PageProps<"/admin/size-guides/[id]">) {
  const { id } = await params;
  await requireStaff(`/admin/size-guides/${id}`);
  const sp = await searchParams;
  const guide = id === "new" ? null : await prisma.sizeGuide.findUnique({ where: { id }, include: { productTypes: { select: { name: true } } } });
  if (id !== "new" && !guide) notFound();
  const table = readSizeTable(guide?.table);

  return (
    <>
      <PageHeader title={guide?.name ?? "New size guide"} description={<Link href="/admin/size-guides" className="underline">Size Guides</Link>} />
      {sp.created && (
        <div className="mb-4">
          <FormAlert tone="success">
            Size guide created. Attach it to a <Link href="/admin/product-types" className="underline">product type</Link> to show it in the shop.
          </FormAlert>
        </div>
      )}
      <SizeGuideForm
        key={guide?.updatedAt.toISOString() ?? "new"}
        usedBy={guide?.productTypes.map((t) => t.name) ?? []}
        values={{ id: guide?.id ?? null, name: guide?.name ?? "", notes: guide?.notes ?? "", columns: table.columns, rows: table.rows }}
      />
    </>
  );
}
