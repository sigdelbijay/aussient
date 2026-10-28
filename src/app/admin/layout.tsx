import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/sidebar";
import { requireStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Aussient" },
  robots: { index: false, follow: false },
};

/**
 * Admin shell: sidebar + content. The layout checks for staff too, but every
 * admin page and server action must still call requireStaff() itself —
 * layouts don't re-run on every navigation.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff("/admin");
  const [toShip, pendingReviews] = await Promise.all([
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.review.count({ where: { approved: false } }),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40 lg:flex-row print:bg-white">
      <AdminSidebar email={user.email} isAdmin={user.role === "ADMIN"} badges={{ "/admin/orders": toShip, "/admin/reviews": pendingReviews }} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8 print:p-0">{children}</main>
    </div>
  );
}
