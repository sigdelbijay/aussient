import { prisma } from "@/lib/prisma";

/**
 * For the uptime monitor (e.g. UptimeRobot): answers "ok" when the site AND
 * its database are working, or a 503 error if the database can't be reached.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { ok: false, problem: "database" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
