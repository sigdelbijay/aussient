import "server-only";
import { notFound, permanentRedirect } from "next/navigation";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getRedirects } from "@/lib/storefront";

/**
 * Redirects send an old link to a new one (e.g. after a product is renamed),
 * so links in old emails, posts and Google results keep working. They're
 * checked only when a page isn't found, so they cost nothing on normal visits.
 */

/** "/Old-Link/" → "/Old-Link": one leading slash, no trailing slash, no #part. */
export function normalizePath(path: string) {
  let p = path.trim().split("#")[0];
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p;
}

/** Call instead of notFound() on shop pages: follows a redirect for this path if there is one. */
export async function redirectOrNotFound(path: string): Promise<never> {
  const to = (await getRedirects())[normalizePath(path)];
  if (to) permanentRedirect(to);
  notFound();
}

/**
 * Adds (or updates) a redirect from → to. Older redirects that pointed at
 * `from` now go straight to `to` (no chains), and any redirect away from `to`
 * is removed, since that address is in use again.
 */
export async function addRedirect(from: string, to: string, db: PrismaClient | Prisma.TransactionClient = prisma) {
  from = normalizePath(from);
  if (from === to) return;
  await db.redirect.deleteMany({ where: { from: to } });
  await db.redirect.updateMany({ where: { to: from }, data: { to } });
  await db.redirect.upsert({ where: { from }, create: { from, to }, update: { to } });
}
