import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { consumeAuthToken } from "@/lib/auth/tokens";
import { sendWelcomeEmail } from "@/lib/welcome-email";
import { AuthHeading } from "@/components/auth/auth-heading";
import { FormAlert } from "@/components/auth/form-bits";

export const metadata: Metadata = { title: "Confirm email" };

/** Opened from the link in the signup email. */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  const userId = typeof token === "string" ? await consumeAuthToken(token, "EMAIL_VERIFY") : null;

  if (userId) {
    const user = await prisma.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
    // The link can only be used once, so this welcome only goes out once.
    await sendWelcomeEmail(user);
    redirect("/login?verified=1");
  }

  return (
    <>
      <AuthHeading title="Link expired" />
      <FormAlert tone="error">
        This confirmation link has expired or was already used. Try logging in — if your email still
        needs confirming, you can ask for a new link there.
      </FormAlert>
      <Link href="/login" className="mt-6 block text-center text-sm font-semibold hover:underline">
        Go to log in
      </Link>
    </>
  );
}
