import { draftMode } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isStaffRole } from "@/auth";
import { getCurrentUser } from "@/lib/auth/dal";

/**
 * Preview on/off.
 *   /api/preview?to=/pages/about        → shows drafts (staff only), then opens that page
 *   /api/preview?exit=1&to=/pages/about → back to what shoppers see
 * Drafts are only ever shown to signed-in staff; see isPreview() in src/lib/content/preview.ts.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const wanted = params.get("to") ?? "/";
  // Only pages on this site.
  const to = wanted.startsWith("/") && !wanted.startsWith("//") && !wanted.startsWith("/\\") ? wanted : "/";
  const draft = await draftMode();

  if (params.get("exit")) {
    draft.disable();
    redirect(to);
  }

  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role) || !user.twoFactorEnabled || !user.mfa) notFound();
  draft.enable();
  redirect(to);
}
