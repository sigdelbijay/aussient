import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, TableWrap } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Activity log" };

const PAGE_SIZE = 50;

const LABELS: Record<string, string> = {
  "product.create": "Created product",
  "product.update": "Edited product",
  "product.duplicate": "Duplicated product",
  "product.import": "Imported products (CSV)",
  "product.media.add": "Uploaded photos/videos",
  "product.media.update": "Edited a photo",
  "product.media.reorder": "Reordered photos",
  "product.media.delete": "Removed a photo",
  "product.variant.create": "Added a finish",
  "product.variant.update": "Edited a finish",
  "product.variant.delete": "Deleted a finish",
  "category.create": "Created category",
  "category.update": "Edited category",
  "category.reorder": "Reordered categories",
  "category.delete": "Deleted category",
  "review.approve": "Approved a review",
  "review.hide": "Hid a review",
};

type Detail = Record<string, unknown> | null;

/** One readable line from the stored detail JSON. */
function describe(detail: Detail) {
  if (!detail) return null;
  const parts: string[] = [];
  for (const key of ["name", "product", "finish", "from", "file"]) {
    if (typeof detail[key] === "string") parts.push(key === "from" ? `from ${detail[key]}` : String(detail[key]));
  }
  if (typeof detail.count === "number") parts.push(`${detail.count} files`);
  if (typeof detail.created === "number") parts.push(`${detail.created} created, ${detail.updated} updated`);
  const changes = detail.changes as Record<string, [unknown, unknown]> | undefined;
  if (changes && Object.keys(changes).length) {
    parts.push(
      Object.entries(changes)
        .map(([k, [a, b]]) => `${k}: ${a ?? "—"} → ${b ?? "—"}`)
        .join("; "),
    );
  }
  return parts.join(" · ");
}

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireStaff("/admin/activity");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const [entries, total] = await Promise.all([
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.activityLog.count(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Activity log" description="Every change made in the admin — who, what and when." />
      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="whitespace-nowrap text-muted-foreground">
                  {e.createdAt.toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" })}
                </td>
                <td className="whitespace-nowrap">{e.user?.name ?? e.user?.email ?? "—"}</td>
                <td className="whitespace-nowrap font-medium">
                  {e.entity === "Product" && e.entityId && e.action !== "product.import" ? (
                    <Link href={`/admin/products/${e.entityId}`} className="hover:underline">
                      {LABELS[e.action] ?? e.action}
                    </Link>
                  ) : (
                    (LABELS[e.action] ?? e.action)
                  )}
                </td>
                <td className="max-w-xl break-words text-muted-foreground">{describe(e.detail as Detail)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? <Link href={`/admin/activity?page=${page - 1}`} className="underline">← Newer</Link> : <span />}
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          {page < pages ? <Link href={`/admin/activity?page=${page + 1}`} className="underline">Older →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
