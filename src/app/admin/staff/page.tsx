import type { Metadata } from "next";
import { InviteForm, StaffRowActions } from "@/components/admin/staff-manager";
import { PageHeader, Panel, TableWrap } from "@/components/admin/ui";
import { formatShopDate } from "@/lib/admin/dates";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Staff" };

/** Who can use the admin. ADMIN only. */
export default async function StaffPage() {
  const me = await requireAdmin("/admin/staff");
  const team = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, email: true, name: true, role: true, passwordHash: true, twoFactorEnabled: true, createdAt: true },
  });

  return (
    <>
      <PageHeader title="Staff" description="People who can use this admin area. Everyone must use an authenticator app to sign in." />
      <div className="mb-6 grid gap-3 rounded-xl border border-border bg-background p-4 text-sm sm:grid-cols-2">
        <p>
          <span className="font-semibold">Staff</span> can manage products, orders, discounts, reviews and site content.
        </p>
        <p>
          <span className="font-semibold">Admins</span> can do everything, including settings, payments and staff.
        </p>
      </div>

      <Panel title="Invite someone" className="mb-6">
        <InviteForm />
      </Panel>

      <TableWrap>
        <thead>
          <tr>
            <th>Person</th>
            <th>Role</th>
            <th>Status</th>
            <th className="text-right">Change</th>
          </tr>
        </thead>
        <tbody>
          {team.map((u) => {
            const invited = !u.passwordHash;
            const status = invited ? "Invite sent" : u.twoFactorEnabled ? "Active" : "Setting up 2FA";
            return (
              <tr key={u.id}>
                <td>
                  <span className="block font-medium">{u.name ?? u.email}</span>
                  {u.name && <span className="block text-xs text-muted-foreground">{u.email}</span>}
                  <span className="block text-xs text-muted-foreground">Added {formatShopDate(u.createdAt)}</span>
                </td>
                <td className="text-xs font-semibold">{u.role === "ADMIN" ? "Admin" : "Staff"}</td>
                <td>
                  <span className={u.twoFactorEnabled && !invited ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-800" : "rounded-full bg-amber-100 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-800"}>
                    {status}
                  </span>
                </td>
                <td className="text-right">
                  <StaffRowActions userId={u.id} role={u.role as "ADMIN" | "STAFF"} isYou={u.id === me.id} invited={invited} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </>
  );
}
