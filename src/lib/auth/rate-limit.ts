import "server-only";
import { prisma } from "@/lib/prisma";

/** 5 failed sign-ins within 15 minutes locks that email for 15 minutes. */
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

/**
 * Minutes left on a lockout for this email, or 0 if they may try again.
 * Only failures since the last successful sign-in count.
 */
export async function lockoutMinutesLeft(email: string): Promise<number> {
  const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60_000);
  const lastSuccess = await prisma.loginAttempt.findFirst({
    where: { email, success: true, createdAt: { gt: windowStart } },
    orderBy: { createdAt: "desc" },
  });
  const failures = await prisma.loginAttempt.findMany({
    where: { email, success: false, createdAt: { gt: lastSuccess?.createdAt ?? windowStart } },
    orderBy: { createdAt: "desc" },
    take: MAX_FAILED_LOGINS,
  });
  if (failures.length < MAX_FAILED_LOGINS) return 0;

  // Locked until 15 minutes after the 5th-most-recent failure.
  const unlockAt = failures[MAX_FAILED_LOGINS - 1].createdAt.getTime() + LOCKOUT_MINUTES * 60_000;
  return Math.max(0, Math.ceil((unlockAt - Date.now()) / 60_000));
}

/**
 * A bot trying many different emails from one connection: 20 failed sign-ins
 * from the same IP address within 15 minutes blocks that IP for a while.
 */
export const MAX_FAILED_PER_IP = 20;

export async function ipBlocked(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000);
  const failures = await prisma.loginAttempt.count({
    where: { ip, success: false, createdAt: { gt: since } },
  });
  return failures >= MAX_FAILED_PER_IP;
}

export async function recordLoginAttempt(email: string, success: boolean, ip?: string | null) {
  await prisma.loginAttempt.create({ data: { email, success, ip: ip ?? null } });
}

/** Clears failures for an email, e.g. after the owner resets their password. */
export async function clearFailedLogins(email: string) {
  await prisma.loginAttempt.deleteMany({ where: { email, success: false } });
}
