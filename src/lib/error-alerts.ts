import "server-only";
import { createHash } from "node:crypto";
import { sendEmail, shopInfo } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { tooManyAttempts } from "@/lib/rate-limit";

/**
 * Emails the admins when something breaks on the live site.
 *
 * So a broken page that thousands of people visit doesn't flood your inbox:
 * the same error is emailed at most once every 30 minutes, and never more
 * than 20 alerts a day in total. Only on the live site (not `pnpm dev`).
 * Goes to "Order alerts" in Settings, or every admin if that's blank.
 */
export async function reportError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string },
) {
  if (process.env.NODE_ENV !== "production") return;
  try {
    const message = error instanceof Error ? error.message : String(error);
    const digest =
      typeof error === "object" && error && "digest" in error
        ? String((error as { digest: unknown }).digest)
        : null;
    // The same kind of error on the same page counts as one.
    const fingerprint = createHash("sha256")
      .update(`${context.routePath}|${message}`)
      .digest("hex")
      .slice(0, 16);

    if (await tooManyAttempts("error-alert", fingerprint, { max: 1, minutes: 30 })) return;
    if (await tooManyAttempts("error-alert", "all", { max: 20, minutes: 24 * 60 })) return;

    const shop = await shopInfo();
    const to = shop.orderAlertEmail
      ? [shop.orderAlertEmail]
      : (await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } })).map(
          (u) => u.email,
        );
    if (to.length === 0) return;

    // Only the address and error text — never cookies or form data, which can hold private details.
    const path = request.path.split("?")[0];
    await sendEmail({
      to,
      store: shop.store,
      subject: `Site error on ${path}`,
      heading: "Something went wrong on the shop",
      body: [
        `A shopper (or admin) hit an error.`,
        ``,
        `Page: ${request.method} ${path}`,
        `Where: ${context.routeType} — ${context.routePath}`,
        `Error: ${message.slice(0, 500)}`,
        ...(digest ? [`Error code: ${digest}`] : []),
        `Time: ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}`,
        ``,
        `Search for the error code in Vercel → your project → Logs for the full details. You won't get another email about this same error for 30 minutes.`,
      ].join("\n"),
    });
  } catch (e) {
    // Never let the alert itself cause more trouble.
    console.error("Couldn't send the error alert", e);
  }
}
