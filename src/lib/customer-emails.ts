import "server-only";
import { prisma } from "@/lib/prisma";
import { calculateTotals } from "@/lib/cart/totals";
import { formatPrice } from "@/lib/format";
import { emailText, escapeHtml, sendEmail, shopInfo, siteUrl } from "@/lib/email";
import { unsubscribeUrl } from "@/lib/marketing";
import { firstName } from "@/lib/orders/emails";
import { variantLabel } from "@/lib/product-types";

/**
 * Emails the cron job sends (src/app/api/cron/emails): back in stock, and
 * the "you left something in your bag" reminder.
 */

/** A small copy of a Cloudinary photo, so emails load quickly. */
function smallImage(url: string | null) {
  if (!url) return null;
  return url.includes("res.cloudinary.com") && url.includes("/image/upload/") ? url.replace("/image/upload/", "/image/upload/w_240,c_limit,q_auto/") : url;
}

function productRow(p: { name: string; detail?: string | null; price?: string; image: string | null; url: string }) {
  const img = smallImage(p.image);
  return `<tr>
    <td style="padding:8px 12px 8px 0;width:72px;vertical-align:top">${img ? `<a href="${escapeHtml(p.url)}"><img src="${escapeHtml(img)}" alt="" width="72" style="display:block;width:72px;border-radius:6px"></a>` : ""}</td>
    <td style="padding:8px 0;font-size:14px;vertical-align:top"><a href="${escapeHtml(p.url)}" style="color:#111;font-weight:700;text-decoration:none">${escapeHtml(p.name)}</a>${p.detail ? `<br><span style="color:#666;font-size:13px">${escapeHtml(p.detail)}</span>` : ""}</td>
    <td style="padding:8px 0;font-size:14px;text-align:right;vertical-align:top;white-space:nowrap">${p.price ? escapeHtml(p.price) : ""}</td>
  </tr>`;
}
const table = (rows: string) => `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 8px">${rows}</table>`;

function footer(shop: Awaited<ReturnType<typeof shopInfo>>) {
  return [shop.store + (shop.abn ? ` · ABN ${shop.abn}` : ""), ...(shop.supportEmail ? [`Questions? ${shop.supportEmail}`] : [])];
}

// ── Sending in batches ─────────────────────────────────────────

/**
 * How many emails one cron run may send. Resend allows about 2 a second, so
 * each send waits a moment; anything left over goes out on the next run.
 */
export class SendBudget {
  sent = 0;
  constructor(readonly max: number) {}
  get left() {
    return this.max - this.sent;
  }
  async send(fn: () => Promise<boolean>) {
    if (this.sent > 0) await new Promise((r) => setTimeout(r, 550));
    this.sent++;
    return fn();
  }
}

// ── Back in stock ──────────────────────────────────────────────

/** Emails everyone whose "Notify me" product (or size/colour) has stock again. Each request is emailed once. */
export async function sendBackInStockEmails(budget: SendBudget) {
  const pending = await prisma.backInStockRequest.findMany({
    where: { notified: false, product: { status: "LIVE" } },
    orderBy: { createdAt: "asc" },
    take: 500,
    include: {
      product: {
        select: {
          name: true,
          slug: true,
          media: { where: { type: "IMAGE" }, orderBy: { order: "asc" }, take: 1, select: { url: true } },
          variants: { select: { id: true, stock: true, option1: { select: { value: true } }, option2: { select: { value: true } }, option3: { select: { value: true } } } },
        },
      },
    },
  });
  const shop = await shopInfo();
  let sent = 0;

  for (const r of pending) {
    if (budget.left <= 0) break;
    const variant = r.variantId ? r.product.variants.find((v) => v.id === r.variantId) : null;
    if (r.variantId && !variant) continue; // that size/colour was removed; nothing to tell them yet
    const inStock = variant ? variant.stock > 0 : r.product.variants.some((v) => v.stock > 0);
    if (!inStock) continue;

    // Claim it first, so it can't be sent twice if two runs overlap.
    const { count } = await prisma.backInStockRequest.updateMany({ where: { id: r.id, notified: false }, data: { notified: true, notifiedAt: new Date() } });
    if (count === 0) continue;

    const choice = variant ? variantLabel([variant.option1?.value, variant.option2?.value, variant.option3?.value]) : null;
    const productName = choice ? `${r.product.name} (${choice})` : r.product.name;
    const url = siteUrl(`/products/${r.product.slug}`);
    const text = await emailText("back-in-stock", { product: productName });
    const ok = await budget.send(() =>
      sendEmail({
        to: r.email,
        store: shop.store,
        subject: text.subject,
        heading: "It's back!",
        body: text.body,
        button: { label: "Shop it now", url },
        extraHtml: table(productRow({ name: r.product.name, detail: choice, image: r.product.media[0]?.url ?? null, url })),
        footer: [...footer(shop), "You asked us to email you when this was back in stock. We won't email you about it again."],
      }),
    );
    if (ok) sent++;
    else await prisma.backInStockRequest.update({ where: { id: r.id }, data: { notified: false, notifiedAt: null } });
  }
  return sent;
}

// ── Left-behind bags ───────────────────────────────────────────

export const REMINDER_AFTER_HOURS = 2;
/** Bags left longer than this are too old to remind about (e.g. the first time this runs). */
const REMINDER_MAX_DAYS = 3;

/**
 * One reminder per left-behind bag, 2 hours after the shopper last changed
 * it — only for signed-in customers who agreed to marketing emails, and not
 * if they've ordered since. Changing the bag again allows one more reminder later.
 */
export async function sendBagReminders(budget: SendBudget, now = new Date()) {
  const remindable = {
    activityAt: { lte: new Date(now.getTime() - REMINDER_AFTER_HOURS * 3600_000), gte: new Date(now.getTime() - REMINDER_MAX_DAYS * 86400_000) },
    OR: [{ remindedAt: null }, { remindedAt: { lt: prisma.cart.fields.activityAt } }],
    items: { some: {} },
    user: { marketingOptIn: true },
  };
  const carts = await prisma.cart.findMany({
    where: remindable,
    orderBy: { activityAt: "asc" },
    take: 100,
    include: { user: { select: { id: true, email: true, name: true } }, items: { orderBy: { createdAt: "asc" } } },
  });
  const shop = await shopInfo();
  let sent = 0;

  for (const cart of carts) {
    if (budget.left <= 0) break;
    // Claim it, so overlapping runs can't both send.
    const { count } = await prisma.cart.updateMany({ where: { id: cart.id, ...remindable }, data: { remindedAt: now } });
    if (count === 0) continue;

    // Ordered since? Then the bag isn't really left behind.
    const ordered = await prisma.order.findFirst({ where: { OR: [{ userId: cart.user.id }, { email: cart.user.email }], createdAt: { gte: cart.activityAt } }, select: { id: true } });
    if (ordered) continue;

    // Today's prices and stock — and only things that can still be bought.
    const totals = await calculateTotals(
      cart.items.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.quantity })),
      { customer: { userId: cart.user.id, email: cart.user.email } },
    );
    const lines = totals.lines.filter((l) => !l.issue || l.issue === "reduced");
    if (lines.length === 0) continue;

    const text = await emailText("bag-reminder", { name: firstName(cart.user.name) });
    const rows = lines.map((l) =>
      productRow({
        name: l.name,
        detail: [l.variantName, l.qty > 1 ? `Qty ${l.qty}` : null].filter(Boolean).join(" · ") || null,
        price: formatPrice(l.lineTotal),
        image: l.image,
        url: siteUrl(`/products/${l.slug}`),
      }),
    );
    const ok = await budget.send(() =>
      sendEmail({
        to: cart.user.email,
        store: shop.store,
        subject: text.subject,
        heading: "Still thinking it over?",
        body: text.body,
        button: { label: "Back to my bag", url: siteUrl("/cart") },
        extraHtml: table(rows.join("")),
        extraText: lines.map((l) => `${l.qty} × ${l.name}${l.variantName ? ` (${l.variantName})` : ""} — ${formatPrice(l.lineTotal)}`).join("\n"),
        footer: footer(shop),
        unsubscribeUrl: unsubscribeUrl(cart.user.email),
      }),
    );
    if (ok) sent++;
    else await prisma.cart.update({ where: { id: cart.id }, data: { remindedAt: cart.remindedAt } });
  }
  return sent;
}
