import type { Metadata } from "next";
import Link from "next/link";
import { forgotPasswordAction } from "@/lib/auth/actions";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ActionForm } from "@/components/auth/action-form";
import { Field } from "@/components/auth/form-bits";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading
        title="Forgot password?"
        subtitle="Enter your email and we'll send you a link to choose a new one."
      />
      <ActionForm action={forgotPasswordAction} submitLabel="Email me a reset link">
        <Field label="Email" name="email" type="email" autoComplete="email" required />
      </ActionForm>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-foreground hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}
