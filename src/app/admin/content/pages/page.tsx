import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, PageHeader, TableWrap } from "@/components/admin/ui";
import { createPageAction } from "@/lib/admin/content-actions";
import { formatShopDate } from "@/lib/admin/dates";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Pages" };

/** About, FAQ, Shipping, Returns, Privacy, Terms, Contact — and any others the admin adds. */
export default async function PagesPage() {
  await requireStaff("/admin/content/pages");
  const [pages, drafts] = await Promise.all([
    prisma.page.findMany({ orderBy: { title: "asc" } }),
    prisma.contentDraft.findMany({ where: { key: { startsWith: "page:" } }, select: { key: true } }),
  ]);
  const hasDraft = new Set(drafts.map((d) => d.key.slice(5)));

  return (
    <>
      <PageHeader title="Pages" description="Information pages. Link to them from the menus." />
      <form action={createPageAction} className="mb-4 flex max-w-md gap-2">
        <input name="title" required maxLength={100} placeholder="New page title, e.g. Size guide" aria-label="New page title" className={inputClass} />
        <Button type="submit" className="h-10 gap-1.5 px-3">
          <Plus /> Add page
        </Button>
      </form>
      {pages.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-muted-foreground">No pages yet.</p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Page</th>
              <th>Web address</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/content/pages/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                </td>
                <td className="text-xs text-muted-foreground">/pages/{p.slug}</td>
                <td className="text-xs">
                  <span className={p.published ? "rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800" : "rounded-full bg-muted px-2 py-0.5 font-semibold"}>
                    {p.published ? "Live" : "Hidden"}
                  </span>
                  {hasDraft.has(p.id) && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Draft</span>}
                </td>
                <td className="text-xs text-muted-foreground">{formatShopDate(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
