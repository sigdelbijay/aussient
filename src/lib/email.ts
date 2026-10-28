import "server-only";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { EMAIL_TEMPLATES, fillPlaceholders, type EmailKey } from "@/lib/email-templates";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export function siteUrl(path = "") {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}${path}`;
}

/** Makes text safe to put inside an email's HTML (and keeps line breaks). */
export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}
const html = escapeHtml;

/** The shop details printed at the bottom of emails (from Settings). */
export async function shopInfo() {
  const s = await prisma.siteSettings.findUnique({
    where: { id: "singleton" },
    select: { storeName: true, abn: true, supportEmail: true, contactPhone: true, orderAlertEmail: true },
  });
  return {
    store: s?.storeName ?? "Aussient",
    abn: s?.abn ?? null,
    supportEmail: s?.supportEmail ?? null,
    contactPhone: s?.contactPhone ?? null,
    orderAlertEmail: s?.orderAlertEmail ?? null,
  };
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

export type EmailContent = {
  to: string | string[];
  subject: string;
  /** Shown at the top of the email. */
  store?: string;
  heading: string;
  /** Plain text (escaped for you). */
  body: string;
  button?: { label: string; url: string };
  /** Extra HTML under the text, e.g. an order's items. Build it with escapeHtml(). */
  extraHtml?: string;
  /** Plain-text version of extraHtml, for email apps that don't show HTML. */
  extraText?: string;
  /** Small print at the bottom, one line per entry (plain text). */
  footer?: string[];
  /** Marketing emails must have a working "unsubscribe" link. */
  unsubscribeUrl?: string;
  replyTo?: string;
};

/** The HTML and plain-text versions of an email (also used to preview emails in tests). */
export function renderEmail(c: EmailContent) {
  const button = c.button
    ? `<p style="margin:0 0 24px"><a href="${html(c.button.url)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">${html(c.button.label)}</a></p>`
    : "";
  const footer = [...(c.footer ?? [])];
  const small = footer.map((line) => `<p style="font-size:12px;color:#666;margin:8px 0 0">${html(line)}</p>`).join("");
  const unsubscribe = c.unsubscribeUrl
    ? `<p style="font-size:12px;color:#666;margin:8px 0 0">Don't want these emails? <a href="${html(c.unsubscribeUrl)}" style="color:#666">Unsubscribe</a>.</p>`
    : "";

  const body = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111">
    <p style="font-size:20px;font-weight:800;letter-spacing:-0.02em;margin:0 0 24px;text-transform:uppercase">${html(c.store ?? "Aussient")}</p>
    <h1 style="font-size:22px;margin:0 0 12px">${html(c.heading)}</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 24px">${html(c.body)}</p>
    ${button}
    ${c.extraHtml ?? ""}
    <div style="border-top:1px solid #e5e5e5;margin-top:32px;padding-top:8px">${small}${unsubscribe}</div>
  </div>`;

  const text = [
    c.heading,
    "",
    c.body,
    c.button ? `\n${c.button.label}: ${c.button.url}` : "",
    c.extraText ? `\n${c.extraText}` : "",
    "",
    ...footer,
    c.unsubscribeUrl ? `Unsubscribe: ${c.unsubscribeUrl}` : "",
  ]
    .join("\n")
    .trim();

  return { html: body, text };
}

/**
 * Sends an email through Resend. Returns false if it couldn't be sent. In
 * development the subject is also printed to the terminal, so you can test
 * without a verified sending domain.
 */
export async function sendEmail(c: EmailContent): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n✉️  [email to ${[c.to].flat().join(", ")}] ${c.subject}${c.button ? `\n    ${c.button.url}` : ""}\n`);
  }
  const { html: body, text } = renderEmail(c);
  if (!resend) {
    // For testing: with EMAIL_OUTBOX_DIR set, emails are saved as files to open in a browser instead.
    if (process.env.EMAIL_OUTBOX_DIR) return saveToOutbox(process.env.EMAIL_OUTBOX_DIR, c, body);
    console.warn("RESEND_API_KEY is not set — email not sent.");
    return false;
  }
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Aussient <onboarding@resend.dev>",
    to: c.to,
    subject: c.subject,
    html: body,
    text,
    ...(c.replyTo ? { replyTo: c.replyTo } : {}),
    ...(c.unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${c.unsubscribeUrl}>` } } : {}),
  });
  if (error) {
    console.error("Resend failed to send email:", error);
    return false;
  }
  return true;
}

async function saveToOutbox(dir: string, c: EmailContent, body: string) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  await mkdir(dir, { recursive: true });
  const slug = c.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
  const head = `<!-- to: ${[c.to].flat().join(", ")} | subject: ${c.subject} -->\n`;
  await writeFile(path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${slug}.html`), head + body);
  return true;
}

/** A simple email with one button (confirm email, reset password, staff invite). */
export async function sendActionEmail(opts: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  buttonLabel: string;
  url: string;
  store?: string;
}) {
  await sendEmail({
    to: opts.to,
    subject: opts.subject,
    store: opts.store,
    heading: opts.heading,
    body: opts.body,
    button: { label: opts.buttonLabel, url: opts.url },
    footer: [`If the button doesn't work, paste this link into your browser: ${opts.url}`, "Didn't ask for this? You can ignore this email."],
  });
}
