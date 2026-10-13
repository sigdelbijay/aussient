import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth, isStaffRole } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Data access layer for auth — the single place pages and server actions ask
 * "who is this, and are they allowed?". Always re-reads the user from the
 * database, so a demoted user or a reset password takes effect at once.
 *
 * Usage:
 *   - Account pages/actions:  const user = await requireUser();
 *   - EVERY admin page and EVERY admin server action: const user = await requireStaff();
 */

/** The signed-in user (fresh from the DB), or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  // Session from before a password change/reset → treat as signed out.
  if (!user || user.sessionVersion !== session.user.sv) return null;

  return { ...user, mfa: session.user.mfa };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Any signed-in user; otherwise sends them to /login and back here afterwards. */
export async function requireUser(returnTo = "/account"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}`);
  return user;
}

/**
 * ADMIN or STAFF who signed in with their authenticator code.
 * - Not signed in → /login
 * - Signed in but not staff → 404 (we don't reveal the admin area exists)
 * - Staff without 2FA set up → the 2FA setup page
 * - Staff whose session lacks a verified code → sign in again
 */
export async function requireStaff(returnTo = "/admin"): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (!isStaffRole(user.role)) notFound();
  if (!user.twoFactorEnabled) redirect("/account/security");
  if (!user.mfa) redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}&reauth=1`);
  return user;
}
