import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { ShieldCheck } from "lucide-react";
import { isStaffRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/dal";
import { confirmTwoFactorAction } from "@/lib/auth/actions";
import { decrypt, encrypt } from "@/lib/auth/crypto";
import { generateTotpSecret, totpUri } from "@/lib/auth/totp";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ActionForm } from "@/components/auth/action-form";
import { Field, FormAlert } from "@/components/auth/form-bits";

export const metadata: Metadata = { title: "Two-factor login" };

/** Staff/admin set up their authenticator app here (required before /admin opens). */
export default async function SecurityPage() {
  const user = await requireUser("/account/security");
  if (!isStaffRole(user.role)) redirect("/account");

  if (user.twoFactorEnabled) {
    return (
      <Shell>
        <AuthHeading title="Two-factor is on" />
        <FormAlert tone="success">
          Your account asks for a 6-digit code from your authenticator app every time you log in.
        </FormAlert>
        <Link
          href="/admin"
          className="mt-6 block text-center text-sm font-semibold hover:underline"
        >
          Go to admin
        </Link>
      </Shell>
    );
  }

  // Create a secret on first visit; keep it until confirmed so the QR stays the same.
  let secret: string;
  if (user.twoFactorSecret) {
    secret = decrypt(user.twoFactorSecret);
  } else {
    secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: encrypt(secret) },
    });
  }
  const qr = await QRCode.toDataURL(totpUri(secret, user.email), { margin: 1, width: 220 });

  return (
    <Shell>
      <AuthHeading
        title="Set up two-factor login"
        subtitle="Admin and staff accounts need a code from an authenticator app to log in."
      />
      <ol className="mb-6 grid gap-4 text-sm">
        <li>
          <span className="font-semibold">1.</span> Install an authenticator app — Google
          Authenticator, Microsoft Authenticator, 1Password or Authy.
        </li>
        <li>
          <span className="font-semibold">2.</span> In the app, add an account and scan this code:
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data: URL */}
          <img
            src={qr}
            alt="QR code for your authenticator app"
            className="mx-auto mt-3 rounded-lg border border-border"
            width={220}
            height={220}
          />
          <span className="mt-2 block text-center text-xs text-muted-foreground">
            Can&apos;t scan? Enter this key instead:{" "}
            <code className="font-mono font-semibold break-all text-foreground">
              {secret.match(/.{1,4}/g)?.join(" ")}
            </code>
          </span>
        </li>
        <li>
          <span className="font-semibold">3.</span> Type the 6-digit code the app shows. You&apos;ll
          then log in again with it.
        </li>
      </ol>
      <ActionForm action={confirmTwoFactorAction} submitLabel="Turn on two-factor">
        <Field
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          placeholder="123 456"
          className="text-center text-lg tracking-[0.3em]"
        />
      </ActionForm>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-md">
        <ShieldCheck className="mx-auto mb-4 size-10 text-brand-accent" />
        {children}
      </div>
    </div>
  );
}
