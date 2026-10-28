import type { Metadata } from "next";
import Link from "next/link";
import { signupAction } from "@/lib/auth/actions";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ActionForm } from "@/components/auth/action-form";
import { Field } from "@/components/auth/form-bits";
import { GoogleButton } from "@/components/auth/google-button";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <>
      <AuthHeading
        title="Create an account"
        subtitle="Track orders, save addresses and build your wishlist."
      />
      <div className="grid gap-4">
        <GoogleButton callbackUrl="/account" />
        <ActionForm action={signupAction} submitLabel="Create account">
          <Field label="Name" name="name" autoComplete="name" required maxLength={100} />
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            hint="At least 8 characters."
          />
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="marketing" className="mt-0.5 size-4 shrink-0 accent-foreground" />
            <span>
              Email me news, offers and a reminder if I leave something in my bag. You can
              unsubscribe any time.
            </span>
          </label>
        </ActionForm>
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-foreground hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
