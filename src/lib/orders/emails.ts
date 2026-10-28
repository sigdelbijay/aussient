import "server-only";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { emailText, escapeHtml, sendEmail, shopInfo, siteUrl, type EmailContent } from "@/lib/email";
import { addressLines, gstIncluded, optionsText, readAddress } from "./format";

/**
 * The emails about an order. Each send* function loads the order fresh from
 * the database, so it always shows what was actually saved.
 */

async function loadOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { id: "asc" } }, discount: { select: { code: true, title: true } } },
  });
}
type FullOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;
type Shop = Awaited<ReturnType<typeof shopInfo>>;

const money = (d: { toString(): string } | number) => formatPrice(Number(d));
const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" });

/** The money lines under the items: subtotal, discount, shipping, total and the GST inside it. */
function totals(o: FullOrder) {
  const lines: [string, string][] = [["Subtotal", money(o.subtotal)]];
  if (Number(o.discountTotal) > 0) lines.push([`Discount${o.discount?.code ? ` (${o.discount.code})` : ""}`, `−${money(o.discountTotal)}`]);
  lines.push(["Shipping", Number(o.shippingTotal) > 0 ? money(o.shippingTotal) : "Free"]);
  return lines;
}

/** The items and totals as an HTML table (everything escaped), plus a plain-text copy. */
function orderSummary(o: FullOrder, { invoice, shop, forShop = false }: { invoice: boolean; shop: Shop; forShop?: boolean }) {
  const cell = "padding:8px 0;border-bottom:1px solid #eee;font-size:14px;vertical-align:top";
  const rows = o.items
    .map((i) => {
      const opts = optionsText(i);
      return `<tr>
        <td style="${cell}">${escapeHtml(i.name)}${opts ? `<br><span style="color:#666;font-size:13px">${escapeHtml(opts)}</span>` : ""}</td>
        <td style="${cell};text-align:center;white-space:nowrap">× ${i.quantity}</td>
        <td style="${cell};text-align:right;white-space:nowrap">${escapeHtml(money(i.lineTotal))}</td>
      </tr>`;
    })
    .join("");
  const sum = (label: string, value: string, bold = false) =>
    `<tr><td colspan="2" style="padding:4px 0;font-size:14px${bold ? ";font-weight:700" : ""}">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:14px;text-align:right;white-space:nowrap${bold ? ";font-weight:700" : ""}">${escapeHtml(value)}</td></tr>`;
  const gst = `Includes GST of ${money(gstIncluded(Number(o.total)))}`;
  const address = addressLines(readAddress(o.shippingAddress));

  const heading = invoice ? "Tax invoice" : forShop ? "Order details" : "Your order";
  const meta = [
    `Order ${o.number} · ${dateFmt.format(o.createdAt)}`,
    ...(invoice ? [shop.store + (shop.abn ? ` · ABN ${shop.abn}` : "")] : []),
  ];

  const html = `
    <h2 style="font-size:16px;margin:0 0 4px">${escapeHtml(heading)}</h2>
    ${meta.map((m) => `<p style="font-size:13px;color:#666;margin:0">${escapeHtml(m)}</p>`).join("")}
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:12px 0 8px">${rows}
      ${totals(o).map(([l, v]) => sum(l, v)).join("")}
      ${sum("Total (AUD)", money(o.total), true)}
    </table>
    <p style="font-size:13px;color:#666;margin:0 0 20px">${escapeHtml(gst)}</p>
    ${address.length ? `<h2 style="font-size:16px;margin:0 0 4px">Delivering to</h2><p style="font-size:14px;line-height:1.5;margin:0">${address.map(escapeHtml).join("<br>")}</p>` : ""}`;

  const text = [
    `${heading.toUpperCase()}`,
    ...meta,
    "",
    ...o.items.map((i) => `${i.quantity} × ${i.name}${optionsText(i) ? ` (${optionsText(i)})` : ""} — ${money(i.lineTotal)}`),
    "",
    ...totals(o).map(([l, v]) => `${l}: ${v}`),
    `Total (AUD): ${money(o.total)}`,
    gst,
    ...(address.length ? ["", "Delivering to:", ...address] : []),
  ].join("\n");

  return { html, text };
}

function footerFor(shop: Shop) {
  const contact = [shop.supportEmail, shop.contactPhone].filter(Boolean).join(" · ");
  return [
    ...(contact ? [`Questions? Reply to this email or contact us: ${contact}`] : ["Questions? Just reply to this email."]),
    shop.store + (shop.abn ? ` · ABN ${shop.abn}` : ""),
  ];
}

async function sendToCustomer(o: FullOrder, shop: Shop, content: Omit<EmailContent, "to" | "store" | "footer" | "replyTo">) {
  return sendEmail({
    to: o.email,
    store: shop.store,
    footer: footerFor(shop),
    replyTo: shop.supportEmail ?? undefined,
    // Signed-in customers can see their orders in their account.
    button: o.userId ? { label: "View my orders", url: siteUrl("/account") } : undefined,
    ...content,
  });
}

/**
 * The customer's order confirmation (a tax invoice: items, GST and ABN).
 * Only ever sent once per order, however many times it's called.
 */
export async function sendOrderConfirmation(orderId: string) {
  // Claim it first, so two calls at once (e.g. a repeated Stripe webhook) can't both send.
  const { count } = await prisma.order.updateMany({ where: { id: orderId, confirmationSentAt: null }, data: { confirmationSentAt: new Date() } });
  if (count === 0) return false;
  const [o, shop] = await Promise.all([loadOrder(orderId), shopInfo()]);
  if (!o) return false;
  const text = await emailText("order-confirmation", { name: firstName(o.name), order: o.number });
  const summary = orderSummary(o, { invoice: true, shop });
  const sent = await sendToCustomer(o, shop, { subject: text.subject, heading: "Thanks for your order", body: text.body, extraHtml: summary.html, extraText: summary.text });
  // Couldn't send? Let the next try send it.
  if (!sent) await prisma.order.update({ where: { id: orderId }, data: { confirmationSentAt: null } });
  return sent;
}

/** "New order" email to the shop (Settings → order alert email, or every admin). Sent once per order. */
export async function sendNewOrderAlert(orderId: string) {
  const { count } = await prisma.order.updateMany({ where: { id: orderId, adminNotifiedAt: null }, data: { adminNotifiedAt: new Date() } });
  if (count === 0) return false;
  const [o, shop] = await Promise.all([loadOrder(orderId), shopInfo()]);
  if (!o) return false;
  const to = shop.orderAlertEmail
    ? [shop.orderAlertEmail]
    : (await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } })).map((u) => u.email);
  if (to.length === 0) return false;
  const text = await emailText("new-order-admin", { order: o.number, name: o.name, email: o.email, total: money(o.total) });
  const summary = orderSummary(o, { invoice: false, shop, forShop: true });
  const sent = await sendEmail({
    to,
    store: shop.store,
    subject: text.subject,
    heading: `New order ${o.number}`,
    body: text.body,
    button: { label: "Open the order", url: siteUrl(`/admin/orders/${o.id}`) },
    extraHtml: summary.html,
    extraText: summary.text,
    replyTo: o.email,
  });
  if (!sent) await prisma.order.update({ where: { id: orderId }, data: { adminNotifiedAt: null } });
  return sent;
}

export async function sendShippedEmail(orderId: string) {
  const [o, shop] = await Promise.all([loadOrder(orderId), shopInfo()]);
  if (!o) return false;
  const text = await emailText("order-shipped", { name: firstName(o.name), order: o.number, tracking: o.trackingNumber ?? "" });
  const summary = orderSummary(o, { invoice: false, shop });
  return sendToCustomer(o, shop, {
    subject: text.subject,
    heading: "Your order is on its way",
    body: text.body,
    ...(o.trackingUrl ? { button: { label: "Track my parcel", url: o.trackingUrl } } : {}),
    extraHtml: summary.html,
    extraText: summary.text,
  });
}

/** After a cancel or refund: says how much went back to their card. */
export async function sendRefundEmail(orderId: string, kind: "cancelled" | "refunded") {
  const [o, shop] = await Promise.all([loadOrder(orderId), shopInfo()]);
  if (!o) return false;
  const amount = money(o.refundTotal ?? o.total);
  const text = await emailText(kind === "cancelled" ? "order-cancelled" : "refund-confirmation", { name: firstName(o.name), order: o.number, amount });
  const summary = orderSummary(o, { invoice: false, shop });
  return sendToCustomer(o, shop, {
    subject: text.subject,
    heading: kind === "cancelled" ? "Your order has been cancelled" : "Your refund is on its way",
    body: text.body,
    extraHtml: summary.html,
    extraText: summary.text,
  });
}

export const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || "there";
