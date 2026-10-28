import "server-only";
import { draftMode } from "next/headers";
import { isStaffRole } from "@/auth";
import { getCurrentUser } from "@/lib/auth/dal";
import type { DocKey } from "./docs";
import { loadDraft, loadPublished, type DocOf } from "./store";

/**
 * Preview: after an admin clicks "Preview", their browser carries Next.js's
 * draft-mode cookie (see /api/preview) and the shop shows unpublished drafts —
 * to them only. We also re-check they're still signed-in staff.
 */
export async function isPreview() {
  if (!(await draftMode()).isEnabled) return false;
  const user = await getCurrentUser();
  return !!user && isStaffRole(user.role) && user.twoFactorEnabled && !!user.mfa;
}

/** The draft if there is one, otherwise what's published — for preview pages. */
export async function previewDoc<K extends DocKey>(key: K): Promise<DocOf<K> | null> {
  return (await loadDraft(key)) ?? (await loadPublished(key));
}
