import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Runs after `prisma migrate dev` / `prisma migrate reset`.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI commands (migrate, studio, db pull) use the DIRECT connection
    // (Supabase port 5432). The pooled URL (pgbouncer, 6543) can't run DDL.
    // The app's runtime client uses the pooled DATABASE_URL — see src/lib/prisma.ts.
    url: process.env.DIRECT_URL,
  },
});
