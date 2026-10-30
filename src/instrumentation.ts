import type { Instrumentation } from "next";

/**
 * Next.js calls this whenever a page, server action or route handler fails
 * on the server. We email the admins about it (see src/lib/error-alerts.ts).
 * The full details are always in Vercel → your project → Logs.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // the email code needs Node.js
  const { reportError } = await import("@/lib/error-alerts");
  await reportError(error, request, context);
};
