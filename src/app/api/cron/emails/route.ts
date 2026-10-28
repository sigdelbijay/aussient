import { timingSafeEqual } from "node:crypto";
import { SendBudget, sendBackInStockEmails, sendBagReminders } from "@/lib/customer-emails";

/**
 * Run by Vercel Cron (see vercel.json) every 15 minutes: sends back-in-stock
 * emails and "you left something in your bag" reminders.
 *
 * Vercel sends "Authorization: Bearer <CRON_SECRET>", so nobody else can
 * trigger it. Set CRON_SECRET in the Vercel project's environment variables.
 */
export const maxDuration = 60;

function authorised(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorised(request)) return new Response("Unauthorised", { status: 401 });

  // Up to 60 emails a run; anything left over goes out next run.
  const budget = new SendBudget(60);
  const backInStock = await sendBackInStockEmails(budget);
  const bagReminders = await sendBagReminders(budget);
  return Response.json({ backInStock, bagReminders }, { headers: { "Cache-Control": "no-store" } });
}
