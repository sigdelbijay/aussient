"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError, type CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn, signOut, isStaffRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { emailText, sendActionEmail, siteUrl } from "@/lib/email";
import { setMarketingConsent } from "@/lib/marketing";
import { decrypt } from "@/lib/auth/crypto";
import { verifyTotp } from "@/lib/auth/totp";
import { requireUser } from "@/lib/auth/dal";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { LOCKOUT_MINUTES, clearFailedLogins, lockoutMinutesLeft } from "@/lib/auth/rate-limit";
import {
  EMAIL_VERIFY_MINUTES,
  PASSWORD_RESET_MINUTES,
  consumeAuthToken,
  createAuthToken,
  sentRecently,
} from "@/lib/auth/tokens";

export type FormState = { error?: string; message?: string } | undefined;

const SLOW_DOWN = "Too many tries — please wait a while and try again.";

/** Limits how often one visitor can do something (stops bots). See src/lib/rate-limit.ts. */
async function tooMany(action: string, max: number, minutes: number) {
  return tooManyAttempts(action, clientIp(await headers()), { max, minutes });
}

const emailField = z.email("Enter a valid email address").transform((e) => e.toLowerCase().trim());
// bcrypt only uses the first 72 bytes, so cap the length there.
const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer");

/** Only allow redirects back into this site (blocks "open redirect" tricks). */
function safeCallback(url: FormDataEntryValue | null, fallback = "/account") {
  const s = typeof url === "string" ? url : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}

async function sendVerificationEmail(userId: string, email: string) {
  const token = await createAuthToken(userId, "EMAIL_VERIFY", EMAIL_VERIFY_MINUTES);
  // Subject and text are editable under Site Content → Emails.
  const text = await emailText("verify-email");
  await sendActionEmail({
    to: email,
    ...text,
    heading: "Confirm your email",
    buttonLabel: "Confirm email",
    url: siteUrl(`/verify-email?token=${token}`),
  });
}

// ── Sign up ────────────────────────────────────────────────────

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: emailField,
  password: passwordField,
  marketing: z.string().optional(), // the "email me news and offers" tick box (unticked = no)
});

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password, marketing } = parsed.data;
  if (await tooMany("signup", 5, 60)) return { error: SLOW_DOWN };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Don't reveal that the email is taken; resend the confirmation if it's unconfirmed.
    if (!existing.emailVerified && !(await sentRecently(existing.id, "EMAIL_VERIFY"))) {
      await sendVerificationEmail(existing.id, email);
    }
  } else {
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: "CUSTOMER" },
    });
    if (marketing === "on") await setMarketingConsent(email, true);
    await sendVerificationEmail(user.id, email);
  }
  return {
    message: `We've sent a confirmation link to ${email}. Click it to activate your account, then log in.`,
  };
}

// ── Log in / out ───────────────────────────────────────────────

export type LoginState =
  { error?: string; needCode?: boolean; unverified?: boolean; email?: string } | undefined;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      code: formData.get("code") ?? "",
      redirectTo: safeCallback(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error; // the success redirect is thrown too
    const code = error.type === "CredentialsSignin" ? (error as CredentialsSignin).code : "";
    switch (code) {
      case "locked": {
        // Locked by email (shows the minutes left) or by too many tries from this connection.
        const mins = (await lockoutMinutesLeft(email)) || LOCKOUT_MINUTES;
        return {
          email,
          error: `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`,
        };
      }
      case "unverified":
        return {
          email,
          unverified: true,
          error: "Please confirm your email address first — check your inbox for the link.",
        };
      case "code_required":
        return { email, needCode: true };
      case "code_invalid":
        return { email, needCode: true, error: "That code didn't work. Try the latest one." };
      default:
        return { email, error: "Incorrect email or password." };
    }
  }
}

export async function googleSignInAction(formData: FormData) {
  await signIn("google", { redirectTo: safeCallback(formData.get("callbackUrl")) });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function resendVerificationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = emailField.safeParse(formData.get("email"));
  if (await tooMany("resend-verification", 5, 60)) return { error: SLOW_DOWN };
  if (email.success) {
    const user = await prisma.user.findUnique({ where: { email: email.data } });
    if (user && !user.emailVerified && !(await sentRecently(user.id, "EMAIL_VERIFY"))) {
      await sendVerificationEmail(user.id, user.email);
    }
  }
  return { message: "If that account needs confirming, we've sent a new link." };
}

// ── Forgot / reset password ────────────────────────────────────

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = emailField.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address" };
  if (await tooMany("forgot-password", 5, 60)) return { error: SLOW_DOWN };

  const user = await prisma.user.findUnique({ where: { email: parsed.data } });
  if (user && !(await sentRecently(user.id, "PASSWORD_RESET"))) {
    const token = await createAuthToken(user.id, "PASSWORD_RESET", PASSWORD_RESET_MINUTES);
    await sendActionEmail({
      to: user.email,
      ...(await emailText("password-reset")),
      heading: "Reset your password",
      buttonLabel: "Reset password",
      url: siteUrl(`/reset-password?token=${token}`),
    });
  }
  // Same answer whether or not the account exists.
  return {
    message: `If an account exists for ${parsed.data}, we've emailed a reset link. It expires in ${PASSWORD_RESET_MINUTES} minutes.`,
  };
}

const resetSchema = z
  .object({ token: z.string().min(1), password: passwordField, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match" });

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const userId = await consumeAuthToken(parsed.data.token, "PASSWORD_RESET");
  if (!userId)
    return { error: "This reset link has expired or was already used. Request a new one." };

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      sessionVersion: { increment: 1 }, // signs out every existing session
      emailVerified: new Date(), // they clicked a link sent to this inbox
    },
  });
  await clearFailedLogins(user.email);
  redirect("/login?reset=1");
}

// ── Two-factor setup (staff) ───────────────────────────────────

export async function confirmTwoFactorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/account/security");
  if (!isStaffRole(user.role) || user.twoFactorEnabled || !user.twoFactorSecret) {
    redirect("/account/security");
  }

  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  const step = verifyTotp(decrypt(user.twoFactorSecret), code);
  if (step === null) return { error: "That code didn't match. Check your app and try again." };

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true, twoFactorLastStep: step, sessionVersion: { increment: 1 } },
  });
  // Sign in again, this time with the code, to get an admin-ready session.
  await signOut({ redirectTo: "/login?twofactor=1&callbackUrl=/admin" });
  return undefined;
}
