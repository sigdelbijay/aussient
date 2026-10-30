import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** Test-only helpers: database jobs (see db-tasks.mts), authenticator codes and the email outbox. */

/** Runs a job from db-tasks.mts and returns its answer. */
export function dbTask<T>(task: string, ...args: string[]): T {
  const out = execFileSync(
    "pnpm",
    ["exec", "tsx", "--env-file=.env", "e2e/db-tasks.mts", task, ...args],
    { encoding: "utf8" },
  );
  return JSON.parse(out.trim().split("\n").pop()!);
}

export const OUTBOX = ".emails/e2e";

/** Waits for an email to arrive in the test outbox and returns its HTML. */
export async function waitForEmail(to: string, subjectPart: RegExp, timeoutMs = 20_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const files = await readdir(OUTBOX).catch(() => [] as string[]);
    for (const f of files.sort().reverse()) {
      const html = await readFile(path.join(OUTBOX, f), "utf8");
      const head = html.split("\n", 1)[0];
      if (head.includes(`to: ${to}`) && subjectPart.test(head)) return html;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email to ${to} matching ${subjectPart}`);
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** The current 6-digit authenticator code for a secret (same maths as src/lib/auth/totp.ts). */
export function totpCode(secret: string, at = Date.now()) {
  let bits = "";
  for (const ch of secret) bits += BASE32.indexOf(ch).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const hmac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}
