import "server-only";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { refreshStorefront, type CACHE_TAGS } from "@/lib/cache";

/**
 * Call at the end of EVERY admin change: records who did what in the activity
 * log, then refreshes the cached shop pages so the change shows straight away.
 */
export async function recordChange(
  user: { id: string },
  change: {
    action: string; // e.g. "product.update"
    entity: string; // e.g. "Product"
    entityId?: string | null;
    /** Short human summary plus any useful specifics (e.g. changed fields). */
    detail?: Prisma.InputJsonValue;
  },
  /** Which cached shop data to refresh: "products" (default) and/or "content" (settings, menus, home). */
  { refresh = ["products"] }: { refresh?: (keyof typeof CACHE_TAGS)[] } = {},
) {
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: change.action,
      entity: change.entity,
      entityId: change.entityId ?? null,
      detail: change.detail,
    },
  });
  if (refresh.length) refreshStorefront(...refresh);
  revalidatePath("/admin", "layout");
}

type Scalar = string | number | boolean | null;

/** Fields whose values differ, as { field: [before, after] } — for the activity log. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, [Scalar, Scalar]> = {};
  const norm = (v: unknown): Scalar =>
    v === undefined || v === null
      ? null
      : typeof v === "object" && "toString" in (v as object)
        ? String(v) // Decimal, Date
        : (v as Scalar);
  for (const key of Object.keys(after)) {
    const a = norm(before[key]);
    const b = norm(after[key]);
    if (String(a) !== String(b)) {
      // Keep long text short in the log.
      const clip = (x: Scalar) => (typeof x === "string" && x.length > 80 ? `${x.slice(0, 77)}…` : x);
      changes[key] = [clip(a), clip(b)];
    }
  }
  return changes;
}
