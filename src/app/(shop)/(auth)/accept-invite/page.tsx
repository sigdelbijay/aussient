import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Field, FormAlert } from "@/components/auth/form-bits";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { findValidToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Join the team", robots: { index: false } };

/** Where the staff invite email links to: choose a name and password, then log in and set up 2FA. */
export default async function AcceptInvitePage({ searchParams }: PageProps<"/accept-invite">) {
  const { token } = await searchParams;
  const valid = typeof token === "string" ? await findValidToken(token, "STAFF_INVITE") : null;
  const user = valid ? await prisma.user.findUnique({ where: { id: valid.userId }, select: { email: true, name: true } }) : null;

  if (!valid || !user) {
    return (
      <>
        <AuthHeading title="Invite expired" />
        <FormAlert tone="error">This invite has expired or was already used. Ask an admin to send a new one.</FormAlert>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Join the team" subtitle={`Set up your login for ${user.email}. Next you'll add an authenticator app.`} />
      <AcceptInviteForm token={token as string}>
        <Field label="Your name" name="name" autoComplete="name" defaultValue={user.name ?? ""} required maxLength={100} />
        <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} hint="At least 8 characters." />
        <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
      </AcceptInviteForm>
    </>
  );
}
