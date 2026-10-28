import "server-only";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { EMAIL_TEMPLATES, fillPlaceholders, type EmailKey } from "@/lib/email-templates";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export function siteUrl(path = "") {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}${path}`;
}

/** Makes text safe to put inside the email's HTML (and keeps line breaks). */
function html(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

/**
 * An email's subject and opening text: the admin's version (Site Content →
 * Emails) or the default, with {store} and the other {words} filled in.
 */
export async function emailText(key: EmailKey, values: Record<string, string> = {}) {
  const [row, settings] = await Promise.all([
    prisma.emailTemplate.findUnique({ where: { key } }),
    prisma.siteSettings.findUnique({ where: { id: "singleton" }, select: { storeName: true } }),
  ]);
  const store = settings?.storeName ?? "Aussient";
  const all = { store, ...values };
  return {
    store,
    subject: fillPlaceholders(row?.subject ?? EMAIL_TEMPLATES[key].subject, all),
    body: fillPlaceholders(row?.body ?? EMAIL_TEMPLATES[key].body, all),
  };
}

/**
 * Sends a simple branded email with one button. In development the link is also
 * printed to the terminal, so you can test without a verified sending domain.
 */
export async function sendActionEmail(opts: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  buttonLabel: string;
  url: string;
  /** Shown at the top of the email. */
  store?: string;
}) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n✉️  [email to ${opts.to}] ${opts.subject}\n    ${opts.url}\n`);
  }
  if (!resend) {
    console.warn("RESEND_API_KEY is not set — email not sent.");
    return;
  }

  const body = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
    <p style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin:0 0 24px;text-transform:uppercase">${html(opts.store ?? "Aussient")}</p>
    <h1 style="font-size:22px;margin:0 0 12px">${html(opts.heading)}</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 24px">${html(opts.body)}</p>
    <a href="${html(opts.url)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">${html(opts.buttonLabel)}</a>
    <p style="font-size:12px;color:#666;margin:24px 0 0">If the button doesn't work, paste this link into your browser:<br>${html(opts.url)}</p>
    <p style="font-size:12px;color:#666;margin:16px 0 0">Didn't ask for this? You can ignore this email.</p>
  </div>`;

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Aussient <onboarding@resend.dev>",
    to: opts.to,
    subject: opts.subject,
    html: body,
  });
  if (error) console.error("Resend failed to send email:", error);
}
