import type { Metadata } from "next";
import Link from "next/link";
import { Eye, EyeOff, Star } from "lucide-react";
import { cn } from "cn";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { setReviewApprovedAction } from "@/lib/admin/catalog-actions";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Reviews" };

const TABS = [
  { key: "pending", label: "Waiting for approval" },
  { key: "approved", label: "Showing in shop" },
  { key: "all", label: "All" },
] as const;

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requireStaff("/admin/reviews");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.show)?.key ?? "pending";
  const productId = typeof sp.product === "string" ? sp.product : undefined;

  const where: Prisma.ReviewWhereInput = {
    ...(tab === "pending" && { approved: false }),
    ...(tab === "approved" && { approved: true }),
    ...(productId && { productId }),
  };
  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { product: { select: { id: true, name: true } }, user: { select: { email: true } } },
  });

  return (
    <>
      <PageHeader title="Reviews" description="Only approved reviews show in the shop and count towards star ratings." />
      <nav className="mb-4 flex w-fit flex-wrap gap-1 rounded-lg bg-background p-1 text-sm shadow-xs ring-1 ring-border">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/reviews?show=${t.key}${productId ? `&product=${productId}` : ""}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn("rounded-md px-3 py-1.5", t.key === tab ? "bg-brand-ink font-semibold text-brand-paper" : "hover:bg-muted")}
          >
            {t.label}
          </Link>
        ))}
        {productId && (
          <Link href={`/admin/reviews?show=${tab}`} className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted">
            ✕ This product only
          </Link>
        )}
      </nav>

      {reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-16 text-center text-sm text-muted-foreground">
          {tab === "pending" ? "No reviews waiting — all caught up." : "No reviews."}
        </p>
      ) : (
        <ul className="grid gap-3">
          {reviews.map((r) => (
            <li key={r.id} className="grid gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-1.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="flex" aria-label={`${r.rating} out of 5 stars`} role="img">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={cn("size-4", n <= r.rating ? "fill-brand-gold text-brand-gold" : "text-border")} />
                    ))}
                  </span>
                  <Link href={`/admin/products/${r.product.id}`} className="font-medium hover:underline">
                    {r.product.name}
                  </Link>
                  <span className={cn("rounded-full px-2 py-0.5 text-[0.7rem] font-semibold", r.approved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
                    {r.approved ? "Showing" : "Hidden"}
                  </span>
                </div>
                {r.title && <p className="font-semibold">{r.title}</p>}
                {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
                <p className="text-xs text-muted-foreground">
                  {r.authorName ?? "Customer"}
                  {r.user?.email && ` · ${r.user.email}`} · {r.createdAt.toLocaleDateString("en-AU")}
                </p>
              </div>
              <form action={setReviewApprovedAction.bind(null, r.id, !r.approved)} className="self-start">
                <button type="submit" className={cn(buttonVariants({ variant: r.approved ? "outline" : "default" }), "h-9 gap-2 px-3")}>
                  {r.approved ? <EyeOff /> : <Eye />}
                  {r.approved ? "Hide" : "Approve"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
