import type { Metadata } from "next";
import { DeleteRedirect, RedirectForm } from "@/components/admin/content/redirect-form";
import { ShopLinks } from "@/components/admin/content/use-content-doc";
import { PageHeader, Panel, TableWrap } from "@/components/admin/ui";
import { shopLinks } from "@/lib/admin/content-page";
import { formatShopDate } from "@/lib/admin/dates";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Redirects" };

export default async function RedirectsPage({ searchParams }: PageProps<"/admin/content/redirects">) {
  await requireStaff("/admin/content/redirects");
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const [rows, links] = await Promise.all([
    prisma.redirect.findMany({
      where: search ? { OR: [{ from: { contains: search, mode: "insensitive" } }, { to: { contains: search, mode: "insensitive" } }] } : {},
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    shopLinks(),
  ]);

  return (
    <>
      <PageHeader
        title="Redirects"
        description="Send an old link to a new one, so links in old emails, posts and Google keep working. Changing a product’s or page’s web address adds one for you."
      />
      <ShopLinks links={links} />
      <Panel className="mb-6">
        <RedirectForm />
      </Panel>
      <form className="mb-3 max-w-sm">
        <input name="q" defaultValue={search} placeholder="Search links…" aria-label="Search redirects" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
      </form>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-muted-foreground">{search ? "No redirects match." : "No redirects yet."}</p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Old link</th>
              <th>Goes to</th>
              <th>Added</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs break-all">{r.from}</td>
                <td className="font-mono text-xs break-all">
                  <a href={r.to} target="_blank" rel="noreferrer" className="hover:underline">
                    {r.to}
                  </a>
                </td>
                <td className="text-xs text-muted-foreground">{formatShopDate(r.createdAt)}</td>
                <td className="text-right">
                  <DeleteRedirect id={r.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
