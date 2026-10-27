/**
 * Dates in the admin are typed in shop time (Sydney), whatever time zone the
 * server or the admin's computer is in. These convert between a stored date and
 * the "2026-11-01T09:00" text a <input type="datetime-local"> uses.
 */

export const SHOP_TIME_ZONE = "Australia/Sydney";

const parts = new Intl.DateTimeFormat("en-AU", {
  timeZone: SHOP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** A date as Sydney wall-clock numbers. */
function sydney(date: Date) {
  const p = Object.fromEntries(parts.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Stored date → "2026-11-01T09:00" in Sydney time ("" for none). */
export function toShopInput(date: Date | null): string {
  if (!date) return "";
  const s = sydney(date);
  return `${s.y}-${pad(s.m)}-${pad(s.d)}T${pad(s.h)}:${pad(s.min)}`;
}

/** "2026-11-01T09:00" in Sydney time → the real moment; null if blank, NaN date if not a date. */
export function fromShopInput(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text.trim());
  if (!text.trim()) return null;
  if (!m) return new Date(NaN);
  const wanted = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Guess, see what Sydney time the guess is, and correct by the difference
  // (twice, so it settles correctly around daylight-saving changes).
  let t = wanted;
  for (let i = 0; i < 2; i++) {
    const s = sydney(new Date(t));
    t += wanted - Date.UTC(s.y, s.m - 1, s.d, s.h, s.min);
  }
  return new Date(t);
}

/** "1 Nov 2026, 9:00 am" in Sydney time, for lists. */
export function formatShopDate(date: Date): string {
  return date.toLocaleString("en-AU", { timeZone: SHOP_TIME_ZONE, dateStyle: "medium", timeStyle: "short" });
}
