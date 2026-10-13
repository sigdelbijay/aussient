import "server-only";
import type { AuthTokenType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/auth/crypto";

export const EMAIL_VERIFY_MINUTES = 24 * 60;
export const PASSWORD_RESET_MINUTES = 30;

/** Creates a one-time link token (replacing any unused one of the same type) and returns it. */
export async function createAuthToken(userId: string, type: AuthTokenType, minutes: number) {
  await prisma.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
  const token = generateToken();
  await prisma.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + minutes * 60_000),
    },
  });
  return token;
}

/** True if a token of this type was sent to the user in the last 2 minutes (stops email spam). */
export async function sentRecently(userId: string, type: AuthTokenType) {
  const recent = await prisma.authToken.findFirst({
    where: { userId, type, createdAt: { gt: new Date(Date.now() - 2 * 60_000) } },
  });
  return recent !== null;
}

/** Looks up a still-valid token without using it up (e.g. to show the reset form). */
export async function findValidToken(token: string, type: AuthTokenType) {
  return prisma.authToken.findFirst({
    where: { tokenHash: hashToken(token), type, usedAt: null, expiresAt: { gt: new Date() } },
  });
}

/** Marks a token used and returns its userId — or null if invalid, expired or already used. */
export async function consumeAuthToken(token: string, type: AuthTokenType) {
  const found = await findValidToken(token, type);
  if (!found) return null;
  // Conditional update so two simultaneous clicks can't both succeed.
  const { count } = await prisma.authToken.updateMany({
    where: { id: found.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1 ? found.userId : null;
}
