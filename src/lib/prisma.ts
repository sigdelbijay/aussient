import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Shared Prisma client for the app.
 *
 * Prisma 7 connects through a driver adapter. We use the pooled Supabase
 * connection (DATABASE_URL, pgbouncer on port 6543) — the right choice for
 * serverless where many short-lived instances each open few connections.
 * Migrations and seeds use the DIRECT_URL instead (see prisma7.config.ts).
 *
 * In dev we cache the client on `globalThis` so Next's hot-reload doesn't
 * open a new pool on every change.
 */
const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
