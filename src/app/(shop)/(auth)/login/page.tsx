import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { FormAlert } from "@/components/auth/form-bits";
import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in" };

// Messages for errors Auth.js (or our Google checks) send back via ?error=
const errorMessages: Record<string, string> = {
  StaffUsePassword:
    "Staff and admin accounts must log in with email, password and authenticator code.",
  GoogleUnverified: "Your Google email address isn't verified.",
  OAuthAccountNotLinked: "This email is already registered. Log in with your password.",
  AccessDenied: "Sign-in was cancelled or not allowed.",
};

function noticeFor(params: Record<string, string | string[] | undefined>) {
  if (params.verified)
    return { tone: "success", text: "Email confirmed — you can log in now." } as const;
  if (params.reset)
    return { tone: "success", text: "Password updated. Log in with your new password." } as const;
  if (params.twofactor)
    return {
      tone: "success",
      text: "Two-factor is on. Log in again with your authenticator code.",
    } as const;
  if (params.changed)
    return { tone: "success", text: "Password changed. Please log in again." } as const;
  if (params.reauth)
    return { tone: "error", text: "Please log in again with your authenticator code." } as const;
  if (typeof params.error === "string")
    return {
      tone: "error",
      text: errorMessages[params.error] ?? "Something went wrong. Please try again.",
    } as const;
  return null;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : "/account";
  const notice = noticeFor(params);

  return (
    <>
      <AuthHeading
        title="Welcome back"
        subtitle="Log in to see your orders, wishlist and details."
      />
      <div className="grid gap-4">
        {notice && <FormAlert tone={notice.tone}>{notice.text}</FormAlert>}
        <GoogleButton callbackUrl={callbackUrl} />
        <LoginForm callbackUrl={callbackUrl} />
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to Aussient?{" "}
        <Link href="/signup" className="font-semibold text-foreground hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
