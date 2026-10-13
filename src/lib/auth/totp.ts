import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Authenticator-app codes (TOTP, RFC 6238): 6 digits, 30-second steps, SHA-1 —
 * the defaults every app (Google Authenticator, 1Password, Authy…) understands.
 */

const STEP_SECONDS = 30;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** A new random secret, base32-encoded for the authenticator app. */
export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(input: string): Buffer {
  let bits = "";
  for (const ch of input.replace(/=+$/, "").toUpperCase()) {
    const v = BASE32.indexOf(ch);
    if (v === -1) throw new Error("Invalid base32 secret");
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function codeAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const n = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return n.toString().padStart(6, "0");
}

/**
 * Checks a 6-digit code, allowing one step of clock drift either way.
 * Returns the matched time-step (store it to block reuse), or null if invalid.
 * Codes at or before `lastUsedStep` are rejected so a code can't be replayed.
 */
export function verifyTotp(
  secret: string,
  code: string,
  lastUsedStep?: number | null,
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (const step of [now - 1, now, now + 1]) {
    if (lastUsedStep != null && step <= lastUsedStep) continue;
    if (timingSafeEqual(Buffer.from(codeAt(secret, step)), Buffer.from(code))) return step;
  }
  return null;
}

/** The otpauth:// link encoded in the QR code the app scans. */
export function totpUri(secret: string, email: string): string {
  const label = encodeURIComponent(`Aussient:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=Aussient&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}
