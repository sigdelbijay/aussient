import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.ts";

/**
 * Database jobs for the browser tests, run with tsx (Playwright can't load
 * Prisma's generated client itself):
 *   tsx --env-file=.env e2e/db-tasks.mts create-admin
 *   tsx --env-file=.env e2e/db-tasks.mts pick-variant
 *   tsx --env-file=.env e2e/db-tasks.mts clean-up a@example.test b@example.test
 * Each prints its answer as JSON.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Same encryption as src/lib/auth/crypto.ts, so the app can read the 2FA secret. */
function encrypt(plain: string) {
  const key = createHash("sha256").update(`aussient-2fa:${process.env.AUTH_SECRET}`).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

/** A throwaway admin with its own random password and authenticator secret. */
async function createAdmin() {
  const email = `e2e-admin-${Date.now()}@example.test`;
  const password = randomBytes(18).toString("base64url");
  const secret = Array.from(randomBytes(32), (b) => BASE32[b % 32]).join("");
  await db.user.create({
    data: {
      email,
      name: "E2E Admin",
      role: "ADMIN",
      emailVerified: new Date(),
      passwordHash: await bcrypt.hash(password, 10),
      twoFactorSecret: encrypt(secret),
      twoFactorEnabled: true,
    },
  });
  return { email, password, secret };
}

/** The cheapest live item with a few in stock. */
async function pickVariant() {
  const v = await db.productVariant.findFirstOrThrow({
    where: { stock: { gte: 3 }, price: { gte: 1 }, product: { status: "LIVE" } },
    include: { product: { select: { slug: true, name: true } } },
    orderBy: { price: "asc" },
  });
  return { id: v.id, slug: v.product.slug, name: v.product.name };
}

/** Removes everything a test run made, and puts the stock back. */
async function cleanUp(emails: string[]) {
  const orders = await db.order.findMany({
    where: { email: { in: emails } },
    include: { items: true },
  });
  for (const o of orders) {
    for (const i of o.items) {
      if (i.variantId)
        await db.productVariant.update({
          where: { id: i.variantId },
          data: { stock: { increment: i.quantity } },
        });
    }
  }
  const orderIds = orders.map((o) => o.id);
  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  await db.checkoutSession.deleteMany({
    where: { OR: [{ orderId: { in: orderIds } }, { userId: { in: userIds } }] },
  });
  await db.activityLog.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { entityId: { in: orderIds } }] },
  });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.newsletterSubscriber.deleteMany({ where: { email: { in: emails } } });
  await db.loginAttempt.deleteMany({ where: { email: { in: emails } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  return { orders: orders.length, users: userIds.length };
}

if (process.env.STRIPE_SECRET_KEY?.startsWith("sk_live")) {
  throw new Error("Refusing to run browser tests with a LIVE Stripe key — use your sk_test_ key.");
}

const [task, ...args] = process.argv.slice(2);
const jobs: Record<string, () => Promise<unknown>> = {
  "create-admin": createAdmin,
  "pick-variant": pickVariant,
  "clean-up": () => cleanUp(args),
};
if (!jobs[task]) throw new Error(`Unknown task: ${task}`);
console.log(JSON.stringify(await jobs[task]()));
await db.$disconnect();
