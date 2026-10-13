import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** A random URL-safe token for emailed links (confirm email, reset password). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** We only store a SHA-256 hash of each link token, so a database leak can't be replayed. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// AES-256-GCM key derived from AUTH_SECRET, used to encrypt 2FA secrets at rest.
function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`aussient-2fa:${secret}`).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
