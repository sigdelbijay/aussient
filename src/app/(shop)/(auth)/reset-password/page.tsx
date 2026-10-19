import type { Metadata } from "next";
import Link from "next/link";
import { resetPasswordAction } from "@/lib/auth/actions";
import { findValidToken } from "@/lib/auth/tokens";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ActionForm } from "@/components/auth/action-form";
import { Field, FormAlert } from "@/components/auth/form-bits";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && (await findValidToken(token, "PASSWORD_RESET"));

  if (!valid) {
    return (
      <>
        <AuthHeading title="Link expired" />
        <FormAlert tone="error">
          This reset link has expired or was already used. Reset links last 30 minutes.
        </FormAlert>
        <Link
          href="/forgot-password"
          className="mt-6 block text-center text-sm font-semibold hover:underline"
        >
          Send me a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Choose a new password" />
      <ActionForm action={resetPasswordAction} submitLabel="Update password">
        <input type="hidden" name="token" value={token} />
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          hint="At least 8 characters."
        />
        <Field
          label="Confirm new password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </ActionForm>
    </>
  );
}
