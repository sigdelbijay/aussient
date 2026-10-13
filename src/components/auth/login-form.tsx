"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginAction, resendVerificationAction } from "@/lib/auth/actions";
import { Field, FormAlert, SubmitButton } from "@/components/auth/form-bits";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  // Controlled, so the email/password survive the extra "enter your code" step.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}

        <div className={state?.needCode ? "hidden" : "grid gap-4"}>
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link
            href="/forgot-password"
            className="-mt-2 justify-self-end text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </Link>
        </div>

        {state?.needCode && (
          <Field
            label="6-digit code from your authenticator app"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            autoFocus
            placeholder="123 456"
            className="text-center text-lg tracking-[0.3em]"
          />
        )}

        <SubmitButton>{state?.needCode ? "Verify and log in" : "Log in"}</SubmitButton>
      </form>

      {state?.unverified && <ResendVerification email={state.email ?? email} />}
    </div>
  );
}

function ResendVerification({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerificationAction, undefined);
  if (state?.message) return <FormAlert tone="success">{state.message}</FormAlert>;
  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <SubmitButton variant="outline">Resend confirmation email</SubmitButton>
    </form>
  );
}
