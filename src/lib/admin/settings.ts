import "server-only";
import { prisma } from "@/lib/prisma";

/** The "low stock" alert level set in Settings: variants with this many or fewer left are flagged. */
export async function lowStockAlert() {
  const s = await prisma.siteSettings.findUnique({ where: { id: "singleton" }, select: { lowStockAlert: true } });
  return s?.lowStockAlert ?? 5;
}
