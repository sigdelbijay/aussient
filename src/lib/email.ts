import "server-only";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export function siteUrl(path = "") {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}${path}`;
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
}) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n✉️  [email to ${opts.to}] ${opts.subject}\n    ${opts.url}\n`);
  }
  if (!resend) {
    console.warn("RESEND_API_KEY is not set — email not sent.");
    return;
  }

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
    <p style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin:0 0 24px">AUSSIENT</p>
    <h1 style="font-size:22px;margin:0 0 12px">${opts.heading}</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 24px">${opts.body}</p>
    <a href="${opts.url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">${opts.buttonLabel}</a>
    <p style="font-size:12px;color:#666;margin:24px 0 0">If the button doesn't work, paste this link into your browser:<br>${opts.url}</p>
    <p style="font-size:12px;color:#666;margin:16px 0 0">Didn't ask for this? You can ignore this email.</p>
  </div>`;

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Aussient <onboarding@resend.dev>",
    to: opts.to,
    subject: opts.subject,
    html,
  });
  if (error) console.error("Resend failed to send email:", error);
}
