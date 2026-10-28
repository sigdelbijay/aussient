import "server-only";
import { emailText, sendEmail, shopInfo, siteUrl } from "@/lib/email";

const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] || "there";

/** Sent once an account is ready: after the email is confirmed, or straight away for Google sign-ups. */
export async function sendWelcomeEmail(user: { email: string; name: string | null }) {
  const [text, shop] = await Promise.all([emailText("welcome", { name: firstName(user.name) }), shopInfo()]);
  return sendEmail({
    to: user.email,
    store: shop.store,
    subject: text.subject,
    heading: `Welcome to ${shop.store}`,
    body: text.body,
    button: { label: "Start shopping", url: siteUrl("/") },
    footer: [shop.store + (shop.abn ? ` · ABN ${shop.abn}` : ""), ...(shop.supportEmail ? [`Questions? ${shop.supportEmail}`] : [])],
    replyTo: shop.supportEmail ?? undefined,
  });
}
