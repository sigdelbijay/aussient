import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/email";

/**
 * Marketing-email consent. Australian law (the Spam Act) says marketing
 * emails — the newsletter and "you left something in your bag" — only go to
 * people who said yes, and every one needs a working unsubscribe link.
 *
 * One yes/no per email address: the tick box at sign-up, the switch on the
 * account page and the newsletter signup all set the same thing.
 */
export async function setMarketingConsent(email: string, yes: boolean) {
  const now = new Date();
  await prisma.$transaction([
    prisma.user.updateMany({ where: { email }, data: { marketingOptIn: yes, marketingOptInAt: yes ? now : null } }),
    yes
      ? prisma.newsletterSubscriber.upsert({ where: { email }, update: { unsubscribedAt: null }, create: { email } })
      : prisma.newsletterSubscriber.updateMany({ where: { email, unsubscribedAt: null }, data: { unsubscribedAt: now } }),
  ]);
}

// ── Unsubscribe links ──────────────────────────────────────────
// The link carries the email and a signature made with AUTH_SECRET, so it
// works without logging in but nobody can make one for someone else's email.

function signature(email: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`unsubscribe:${email}`).digest("base64url");
}

export function unsubscribeUrl(email: string) {
  return siteUrl(`/unsubscribe?e=${encodeURIComponent(email)}&t=${signature(email)}`);
}

export function isValidUnsubscribe(email: string, token: string) {
  const expected = Buffer.from(signature(email));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
