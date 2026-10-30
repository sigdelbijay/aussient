/**
 * Saves DRAFTS of the Privacy, Terms, Shipping and Returns pages, written for
 * Australian law (Privacy Act 1988, Australian Consumer Law, Spam Act 2003).
 *
 *   pnpm db:legal-drafts
 *
 * Nothing goes live: each page gets a draft in Site Content → Pages. Open it,
 * fill in the [BRACKETED] details, check it fits how you actually trade, look
 * at it with Preview, then press Publish. Pages that already have a draft are
 * skipped, so your edits are never overwritten.
 *
 * These are a starting point, not legal advice — have them checked before launch.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ── A tiny bit of Markdown → the editor's document format ─────────
// "## Heading", "### Smaller heading", "- bullet", blank line = new paragraph,
// **bold** and [link text](https://…) inside lines.

type Node = Record<string, unknown>;

function inline(text: string): Node[] {
  const out: Node[] = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1]) out.push({ type: "text", text: m[1], marks: [{ type: "bold" }] });
    else out.push({ type: "text", text: m[2], marks: [{ type: "link", attrs: { href: m[3] } }] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

function toDoc(markdown: string) {
  const content: Node[] = [];
  let list: Node[] | null = null;
  for (const raw of markdown.trim().split("\n")) {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      if (!list) content.push({ type: "bulletList", content: (list = []) });
      list.push({
        type: "listItem",
        content: [{ type: "paragraph", content: inline(line.slice(2)) }],
      });
      continue;
    }
    list = null;
    if (!line) continue;
    const h = /^(#{2,3}) (.*)$/.exec(line);
    if (h) content.push({ type: "heading", attrs: { level: h[1].length }, content: inline(h[2]) });
    else content.push({ type: "paragraph", content: inline(line) });
  }
  return { type: "doc", content };
}

// ── The pages ─────────────────────────────────────────────────────

type Shop = { store: string; email: string; abn: string; freeOver: string; flat: string };

const ACL_TEXT =
  "Our goods come with guarantees that cannot be excluded under the Australian Consumer Law. You are entitled to a replacement or refund for a major failure and compensation for any other reasonably foreseeable loss or damage. You are also entitled to have the goods repaired or replaced if the goods fail to be of acceptable quality and the failure does not amount to a major failure.";

function pages(s: Shop) {
  return [
    {
      slug: "privacy",
      title: "Privacy policy",
      seoDescription: `How ${s.store} collects, uses and protects your personal information under the Australian Privacy Act.`,
      body: `
Last updated: [DATE]

${s.store} ("we", "us") is run by [BUSINESS LEGAL NAME], ABN ${s.abn}. We respect your privacy and handle your personal information in line with the Privacy Act 1988 (Cth) and the Australian Privacy Principles. This policy explains what we collect, why, who we share it with, and how you can see, correct or delete it.

## What we collect

- **Your details:** name, email address, phone number and delivery address when you order or create an account.
- **Your orders:** what you bought, when, what you paid, and any discount codes you used.
- **Your account:** your password (stored only in scrambled, one-way form — we can't read it), saved addresses, wishlist and reviews.
- **Your choices:** whether you've agreed to marketing emails, and your cookie choice.
- **Technical details:** your IP address and browser type, used to keep the site secure (for example, to stop repeated login attempts).
- **How the site is used:** only if you accept analytics cookies (see Cookies below).

We **never** see or store your full card details. Payments are handled by Stripe, which is certified to the highest payment-security standard (PCI DSS Level 1).

## Why we collect it

- To take, deliver and support your orders, and to send you order, shipping and refund emails.
- To run your account and keep it secure.
- To answer your questions and handle returns and warranty claims.
- To send marketing emails — **only if you've said yes** (see Marketing emails below).
- To keep records the law requires (for example, tax records, which we keep for 5 years).
- To improve the shop, using analytics if you've accepted analytics cookies.

If you don't give us your name, email and delivery address, we can't take your order. You can browse the shop without giving us anything.

## Who we share it with

We only share what each service needs to do its job:

- **Stripe** — takes your payment (and Afterpay, Zip or Klarna if you choose them).
- **Our delivery partners** (such as Australia Post) — your name, address and phone number, to deliver your parcel.
- **Supabase** — stores our database, in Sydney, Australia.
- **Vercel** — hosts the website.
- **Resend** — sends our emails.
- **Cloudinary** — stores product photos (no customer details).
- **Google** — if you sign in with Google, and for Google Analytics if you accept analytics cookies.

Some of these companies may store or process information outside Australia, mainly in the United States. We choose providers with strong security and privacy commitments. We never sell your personal information.

We may also disclose information when the law requires it, or to protect against fraud.

## Marketing emails

We only send news, offers and "you left something in your bag" reminders if you've agreed — for example by ticking the box when you sign up (it's never ticked for you) or joining our newsletter. Every marketing email says who it's from and has an unsubscribe link that works straight away. You can also change this any time under Account → Emails from us. Order and delivery emails still come either way, because they're about something you bought.

## Cookies

- **Needed cookies** keep you logged in and remember your bag. The shop can't work without them.
- **Analytics cookies** (Google Analytics) help us see which pages are useful. They only load if you press "Accept" on the cookie banner. You can change your choice with "Cookie settings" at the bottom of every page.

## Keeping it safe and for how long

We use secure connections (https), scrambled passwords, two-factor login for our staff, and limit who can see customer details. We keep order records for 5 years for tax purposes, and account details until you ask us to delete your account. If a data breach is likely to cause you serious harm, we'll tell you and the Office of the Australian Information Commissioner (OAIC), as the Notifiable Data Breaches scheme requires.

## Seeing, correcting or deleting your information

You can see and update most of your details in your account. To get a copy of the information we hold about you, correct it, or delete your account, email [${s.email}](mailto:${s.email}). We'll reply within 30 days. We may need to keep some order records for the law (such as tax), even after your account is deleted.

## Questions and complaints

Email [${s.email}](mailto:${s.email}) or write to [BUSINESS ADDRESS]. We'll respond within 30 days. If you're not happy with our answer, you can complain to the OAIC at [oaic.gov.au](https://www.oaic.gov.au) or on 1300 363 992.

We may update this policy from time to time; the date at the top shows when it last changed.
`,
    },
    {
      slug: "terms",
      title: "Terms of service",
      seoDescription: `The terms for shopping with ${s.store}: orders, prices, payment, delivery, returns and your Australian Consumer Law rights.`,
      body: `
Last updated: [DATE]

These terms apply when you use ${s.store} (aussient.com.au) or buy from us. The shop is run by [BUSINESS LEGAL NAME], ABN ${s.abn}, [BUSINESS ADDRESS]. Nothing in these terms takes away your rights under the Australian Consumer Law (ACL).

## Your rights under the Australian Consumer Law

${ACL_TEXT}

Read our [Returns & exchanges](/pages/returns) page for how to get a repair, replacement or refund.

## Prices and payment

- All prices are in Australian dollars (AUD) and include GST.
- Shipping is added at checkout and shown before you pay.
- Payment is taken securely by Stripe. If you choose Afterpay, Zip or Klarna, their own terms also apply.
- If a price on the site is clearly a mistake (for example $0 or a misplaced decimal point), we'll contact you before sending the order, and you can choose to pay the right price or get a full refund.

## Your order

When you pay, we email you an order confirmation (your tax invoice). If we can't send something you ordered — for example it sold out at the same moment — we'll tell you and refund that item in full straight away. We only sell to delivery addresses in Australia.

## Delivery

See our [Shipping](/pages/shipping) page for delivery times and costs. If your parcel is lost or damaged on the way to you, we'll send a replacement or give you a refund.

## Returns, exchanges and warranties

See our [Returns & exchanges](/pages/returns) page. It covers change-of-mind returns, size exchanges, earrings (hygiene), watch warranties, and faulty items.

## Discount codes

Each code has its own conditions (such as an end date or minimum spend), shown when you use it. Codes can't be swapped for cash and usually can't be combined. We'll always apply the single best offer available to your bag.

## Your account

Keep your password private and tell us if you think someone else has used your account. We may close accounts used for fraud or to abuse the shop.

## Reviews

Only customers who bought a product can review it. Reviews must be honest and about the product. We check reviews before they appear, and don't remove reviews just because they're negative.

## Product information

We take care to describe and photograph products accurately. Colours can look slightly different on different screens. Sizes and measurements are in each product's size guide.

## Our liability

We're responsible for loss or damage that's a reasonably foreseeable result of us breaking these terms or failing to use reasonable care. We're not responsible for loss that isn't foreseeable. Nothing here limits your rights under the Australian Consumer Law.

## Copyright

The text, photos and design of this site belong to us or the people who license them to us. Please don't copy them without permission.

## Privacy

See our [Privacy policy](/pages/privacy).

## Changes and law

We may update these terms; the version on the site when you order applies to that order. These terms are governed by the laws of [STATE, e.g. New South Wales], Australia.

## Contact

[${s.email}](mailto:${s.email}) · [BUSINESS ADDRESS]
`,
    },
    {
      slug: "shipping",
      title: "Shipping",
      seoDescription: `Delivery times and costs for ${s.store} orders across Australia, plus tracking and what happens if a parcel goes missing.`,
      body: `
## Where we deliver

We deliver anywhere in Australia, including PO Boxes and parcel lockers. We don't ship overseas yet.

## How much it costs

- **Standard shipping:** ${s.flat}, and **free on orders of ${s.freeOver} or more** (after discounts).
- **Express shipping:** where available, the price is shown at checkout.

You'll always see the exact shipping cost before you pay.

## How long it takes

- Orders placed before 2pm (AEST) on a business day are usually sent the same day. Orders after that, or on weekends and public holidays, go out the next business day.
- Standard delivery then takes about 2–7 business days, depending on where you live. Regional and remote areas can take longer.
- Busy times (such as Black Friday and Christmas) and carrier delays can add a few days. We'll let you know if something's held up on our side.

## Tracking

As soon as your order ships, we'll email you a tracking number and link.

## Check your address

Please check your delivery address at checkout. If you spot a mistake, email us straight away at [${s.email}](mailto:${s.email}) — we can fix it if the parcel hasn't left yet.

## Lost or damaged parcels

If your parcel hasn't arrived within 10 business days of shipping, or arrives damaged, email us at [${s.email}](mailto:${s.email}) (with photos if it's damaged). We'll work with the carrier and, if it's lost or damaged, send a replacement or give you a full refund — you won't be left out of pocket.

If tracking shows "delivered" but you can't find it, check with neighbours and your local post office first, then contact us and we'll help.
`,
    },
    {
      slug: "returns",
      title: "Returns & exchanges",
      seoDescription: `${s.store} returns, size exchanges, earring hygiene rules and watch warranties — plus your rights under the Australian Consumer Law.`,
      body: `
## If something is faulty or not as described

${ACL_TEXT}

This means that if an item is faulty, unsafe, doesn't match its description or photos, or doesn't last as long as it reasonably should, you can ask for a **repair, replacement or refund** — even after any change-of-mind period or warranty has ended, and even for sale items, earrings and anything else listed below. For a major problem, you choose a refund or a replacement.

Email [${s.email}](mailto:${s.email}) with your order number and a photo of the problem. **We pay the postage** to send faulty items back.

## Change of mind

We also offer change-of-mind returns, on top of your legal rights:

- Return within **30 days of delivery** for a refund or exchange.
- Items must be unworn, unused, in their original packaging, with all tags attached.
- Returns are free with the prepaid label in your parcel. [Check: if you don't include one, say who pays return postage.]
- Sale items can be returned for change of mind unless the product page says "final sale".

## Clothing: size exchanges

Ordered the wrong size? Swap it for another size of the same item within **30 days of delivery**, as long as it's unworn, unwashed and has its tags attached. We'll send the new size as soon as your return is on its way (we'll email you the tracking). If the size you want is sold out, we'll refund you instead. Check each product's size guide before ordering.

## Earrings: hygiene

For health and hygiene reasons, **we can't accept change-of-mind returns or exchanges on earrings for pierced ears** (studs, hooks, hoops, huggies, threaders and similar) once the packaging has been opened. This doesn't affect your rights if they're faulty or not as described — in that case they're covered like everything else (see the top of this page).

## Watches: manufacturer's warranty

Our watches come with the manufacturer's warranty shown on the product page and in the box ([e.g. 12 or 24 months] from purchase). This warranty is **in addition to** your rights under the Australian Consumer Law, not instead of them.

- **What it covers:** faults in materials and workmanship, such as the movement stopping or keeping poor time.
- **What it usually doesn't cover:** normal wear (scratches, worn straps), battery replacement, damage from accidents, misuse, or water beyond the watch's stated water resistance, and repairs by someone else.
- **How to claim:** email [${s.email}](mailto:${s.email}) with your order number and a description of the problem. We'll arrange the repair or replacement with the manufacturer, and we'll cover the postage for warranty claims. Warrantor: [BUSINESS LEGAL NAME], [BUSINESS ADDRESS], [PHONE], [${s.email}](mailto:${s.email}).
- **After the warranty ends:** if a watch fails sooner than it reasonably should, you may still be entitled to a repair, replacement or refund under the Australian Consumer Law — just contact us.

Change-of-mind returns on watches are welcome within 30 days if the watch is unworn, with all protective film, tags and packaging intact.

## How to return something

- Email [${s.email}](mailto:${s.email}) with your order number and what you'd like to return or exchange.
- Pack the item safely and include your order number.
- Send it with the prepaid label, or to the address we give you. Keep your postage receipt.

## Refunds

Refunds go back to your original payment method within 5 business days of us receiving your return. Your bank may take a few more days to show it. Shipping costs are refunded if the item was faulty or not as described, or if we sent the wrong thing.
`,
    },
  ];
}

async function main() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  const money = (d: unknown) => (d == null ? null : `$${Number(d).toFixed(2)}`);
  const shop: Shop = {
    store: settings?.storeName ?? "Aussient",
    email: settings?.supportEmail ?? "[SUPPORT EMAIL]",
    abn: settings?.abn ?? "[ABN]",
    freeOver: money(settings?.freeShippingThreshold) ?? "[AMOUNT]",
    flat: money(settings?.flatShippingRate) ?? "[PRICE]",
  };

  for (const p of pages(shop)) {
    const page =
      (await prisma.page.findUnique({ where: { slug: p.slug } })) ??
      (await prisma.page.create({ data: { slug: p.slug, title: p.title, published: false } }));
    const key = `page:${page.id}`;
    if (await prisma.contentDraft.findUnique({ where: { key } })) {
      console.log(`- ${p.title}: already has a draft — skipped (your edits are kept)`);
      continue;
    }
    const data = {
      title: p.title,
      slug: p.slug,
      content: toDoc(p.body),
      seoTitle: p.title,
      seoDescription: p.seoDescription.slice(0, 170),
      published: true, // live once you press Publish
    } as Prisma.InputJsonValue;
    await prisma.contentDraft.create({ data: { key, data } });
    console.log(
      `✓ ${p.title}: draft saved — review it in Admin → Site content → Pages, then Publish`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
