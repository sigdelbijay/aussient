import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Slows down bots that repeat something over and over (sign-ups, discount
 * codes, newsletter sign-ups, reset emails, checkout). Each try is written
 * down; past the limit within the time window, the answer is "too many".
 *
 * Kept in the database (not memory) because on Vercel every request can run
 * on a different server.
 */
export async function tooManyAttempts(
  action: string,
  who: string,
  { max, minutes }: { max: number; minutes: number },
) {
  const key = `${action}:${who}`.slice(0, 200);
  const since = new Date(Date.now() - minutes * 60_000);
  const recent = await prisma.rateLimitHit.count({ where: { key, createdAt: { gt: since } } });
  if (recent >= max) return true;
  await prisma.rateLimitHit.create({ data: { key } });
  return false;
}

/**
 * The visitor's IP address. Vercel puts the real one first in
 * "x-forwarded-for"; locally there's none, so everyone counts as "local".
 */
export function clientIp(h: Headers) {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** Old tries are only needed for an hour or so; the daily clean-up removes them. */
export async function deleteOldAttempts(olderThanHours = 24) {
  await prisma.rateLimitHit.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - olderThanHours * 3_600_000) } },
  });
}
