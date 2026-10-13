import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Admin" };

/**
 * Admin dashboard (placeholder until the admin prompts).
 * Every admin page must start with requireStaff(); every admin server action too.
 */
export default async function AdminPage() {
  const user = await requireStaff("/admin");

  const [products, orders, customers] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <p className="text-sm text-muted-foreground">
        Signed in as {user.email} · {user.role}
      </p>
      <h1 className="text-display mb-8 text-3xl sm:text-4xl">Admin</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Products", value: products },
          { label: "Orders", value: orders },
          { label: "Customers", value: customers },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-1 font-heading text-3xl font-extrabold">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
