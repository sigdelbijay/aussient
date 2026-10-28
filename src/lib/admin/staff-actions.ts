"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/auth";
import { requireAdmin } from "@/lib/auth/dal";
import { clearFailedLogins } from "@/lib/auth/rate-limit";
import { consumeAuthToken, createAuthToken, sentRecently } from "@/lib/auth/tokens";
import { emailText, sendActionEmail, siteUrl } from "@/lib/email";
import { recordChange } from "./activity";
import type { AdminFormState } from "./form";

/**
 * Staff management — ADMIN only.
 *   - STAFF: products, orders, discounts, reviews and site content.
 *   - ADMIN: everything, including settings, payments and staff.
 * Every staff account must set up an authenticator app before it can use /admin.
 */

const INVITE_DAYS = 7;
const ROLE_NAMES = { ADMIN: "an admin", STAFF: "staff" } as const;
const role = z.enum(["ADMIN", "STAFF"]);
const id = z.string().min(1).max(64);

async function sendInvite(user: { id: string; email: string }, inviter: { name: string | null; email: string }, r: "ADMIN" | "STAFF") {
  const token = await createAuthToken(user.id, "STAFF_INVITE", INVITE_DAYS * 24 * 60);
  await sendActionEmail({
    to: user.email,
    ...(await emailText("staff-invite", { inviter: inviter.name ?? inviter.email, role: ROLE_NAMES[r] })),
    heading: "You're invited",
    buttonLabel: "Choose your password",
    url: siteUrl(`/accept-invite?token=${token}`),
  });
}

/** Admins who'd be left if `userId` stopped being one. There must always be at least one. */
async function otherAdmins(userId: string) {
  return prisma.user.count({ where: { role: "ADMIN", id: { not: userId } } });
}

export async function inviteStaffAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ email: z.email("Enter an email address").max(254).transform((e) => e.toLowerCase().trim()), role, name: z.string().trim().max(100) })
    .safeParse({ email: formData.get("email"), role: formData.get("role"), name: formData.get("name") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, role: r, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && isStaffRole(existing.role)) return { error: `${email} is already on the team.` };

  // An existing customer account is promoted; otherwise a new account is made with no password yet.
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { role: r, sessionVersion: { increment: 1 } } })
    : await prisma.user.create({ data: { email, name: name || null, role: r } });
  await sendInvite(user, admin, r);
  await recordChange(admin, { action: "staff.invite", entity: "User", entityId: user.id, detail: { email, role: r } }, { refresh: [] });
  revalidatePath("/admin/staff");
  return { message: `Invite sent to ${email}. The link lasts ${INVITE_DAYS} days.` };
}

export async function resendInviteAction(userId: string): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: id.parse(userId) } });
  if (!user || !isStaffRole(user.role)) return { error: "They're no longer on the team." };
  if (await sentRecently(user.id, "STAFF_INVITE")) return { error: "An invite went out in the last 2 minutes — check their spam folder." };
  await sendInvite(user, admin, user.role as "ADMIN" | "STAFF");
  await recordChange(admin, { action: "staff.invite", entity: "User", entityId: user.id, detail: { email: user.email, resent: true } }, { refresh: [] });
  return { message: `Sent a new invite to ${user.email}.` };
}

export async function changeRoleAction(userId: string, newRole: string): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const r = role.parse(newRole);
  const user = await prisma.user.findUnique({ where: { id: id.parse(userId) } });
  if (!user || !isStaffRole(user.role)) return { error: "They're no longer on the team." };
  if (user.id === admin.id) return { error: "You can't change your own role — ask another admin." };
  if (user.role === r) return {};
  if (user.role === "ADMIN" && (await otherAdmins(user.id)) === 0) return { error: "The shop needs at least one admin." };
  await prisma.user.update({ where: { id: user.id }, data: { role: r } });
  await recordChange(admin, { action: "staff.role", entity: "User", entityId: user.id, detail: { email: user.email, changes: { role: [user.role, r] } } }, { refresh: [] });
  revalidatePath("/admin/staff");
  return { message: `${user.email} is now ${ROLE_NAMES[r]}.` };
}

/** Takes away admin access (the account stays, as a normal customer) and signs them out. */
export async function removeStaffAction(userId: string): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: id.parse(userId) } });
  if (!user || !isStaffRole(user.role)) return { message: "Already removed." };
  if (user.id === admin.id) return { error: "You can't remove yourself — ask another admin." };
  if (user.role === "ADMIN" && (await otherAdmins(user.id)) === 0) return { error: "The shop needs at least one admin." };
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      // Their 2FA is cleared too: it's only for staff, and they'd set it up again if re-invited.
      data: { role: "CUSTOMER", sessionVersion: { increment: 1 }, twoFactorEnabled: false, twoFactorSecret: null, twoFactorLastStep: null },
    }),
    prisma.authToken.updateMany({ where: { userId: user.id, type: "STAFF_INVITE", usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  await recordChange(admin, { action: "staff.remove", entity: "User", entityId: user.id, detail: { email: user.email, role: user.role } }, { refresh: [] });
  revalidatePath("/admin/staff");
  return { message: `${user.email} no longer has admin access.` };
}

// ── The invite link (no sign-in needed: the link itself proves the inbox) ──

export type InviteState = { error?: string } | undefined;

const acceptSchema = z
  .object({
    token: z.string().min(1).max(200),
    name: z.string().trim().min(1, "Enter your name").max(100),
    password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be 72 characters or fewer"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match" });

export async function acceptInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const parsed = acceptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const userId = await consumeAuthToken(parsed.data.token, "STAFF_INVITE");
  if (!userId) return { error: "This invite has expired or was already used. Ask an admin to send a new one." };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !isStaffRole(user.role)) return { error: "This invite was cancelled." };
  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      emailVerified: user.emailVerified ?? new Date(), // they clicked a link sent to this inbox
      sessionVersion: { increment: 1 },
    },
  });
  await clearFailedLogins(user.email);
  redirect("/login?invited=1&callbackUrl=%2Fadmin");
}
