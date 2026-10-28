# Running the Aussient shop: admin guide

This guide is for whoever looks after the shop each day. You don't need to know any code. Everything here is done in the admin area at **aussient.com.au/admin**.

---

## Getting in

1. Go to **/admin** and log in with your email and password.
2. Type the 6-digit code from your authenticator app (for example Google Authenticator or 1Password).

New to the team? An admin invites you by email. Click the link in the email, choose a password, then log in. The first time, the shop asks you to set up an authenticator app: scan the QR code with the app on your phone. The link in the email lasts 7 days. If it has expired, ask an admin to press **Resend invite**.

**Who can do what**

- **Staff** can manage products, orders, discounts, reviews and everything under Site Content.
- **Admins** can do all of that, plus **Settings**, payments and **Staff**.

---

## How saving works on Site Content: draft, preview, publish, undo

Everything under **Site Content** (the home page, menus, announcement bar, pages and pop-ups) has a bar along the bottom of the screen:

- **Save draft** keeps your changes without showing them to shoppers.
- **Preview** opens the shop in a new tab with your drafts showing. A yellow bar at the top reminds you it's a preview. Only signed-in staff can see drafts. Click **Exit preview** in the yellow bar when you're done.
- **Publish** makes the changes live straight away. If something is missing, such as a picture or a link, the shop lists what to fix and nothing goes live until it's fixed.
- **Discard draft** throws your draft away and goes back to what's live.

**Undo a change:** each editor has a **Version history** box listing the last 10 times it was published. Click **Restore** next to an older one, then **Yes**, and that version goes back live. Settings has the same history box.

The dot in the bottom bar tells you where things stand:
- **Green, "Everything is live":** shoppers see exactly what you see.
- **Amber, "Draft saved" or "Unsaved changes":** you have changes that aren't live yet.

If you try to leave a page with unsaved changes, the browser asks first.

---

## Adding a product

1. Go to **Products**, then **Add product**.
2. **What are you adding?** Pick the product type (for example Earrings, Watch or T-shirt). The type decides which details the product has and what shoppers choose, such as size or colour.
3. Fill in the **Name**, **Description** and any **Details** and **Care** notes.
4. Set the **Price** (including GST) and **Stock**.
5. Under **Organise**, choose its categories, brand and tags. Tags are words like *gift* or *summer* that search and collections use.
6. Leave **Status** on **Draft** while you work, then click **Create product**.
7. On the next screen:
   - **Photos & videos:** upload pictures and drag them into order. The first is the main photo. The second shows when shoppers hover over the product.
   - **Options and variants:** add the choices, such as Gold or Silver, or S, M and L. Each combination gets its own price, stock and SKU. You can link a photo to a colour so it shows when that colour is picked.
8. When it's ready, set **Status** to **Live** and click **Save product**.

**Tips**
- **Duplicate** makes a copy of a similar product, which saves time.
- Changing a product's **web address** is safe. The shop adds a redirect, so old links in emails or on Google still work.
- To add lots of products at once, use **Products → Import** with a spreadsheet (CSV).

---

## Running a sale

There are three ways to take money off. Use whichever suits the sale.

**1. Sale prices (simplest)**
Open a product and put a **Sale price** on the variants you want to reduce. The shop shows the old price crossed out, adds a **SALE** badge and lists the product on **/sale**. Clear the sale price to end it.

**2. Discount codes (for example SUMMER20)**
1. Go to **Discounts**, then **Add discount**, and choose **Code**.
2. Type the code shoppers will enter, such as `SUMMER20`.
3. Choose what it gives: a percent off, a dollar amount off, free shipping, or buy X get Y. For buy X get Y, "buy 3 get 1" makes the cheapest item free.
4. Choose what it applies to: the whole store, a category, a product type, a brand, a collection, or chosen products.
5. Optional limits:
   - a minimum spend;
   - a start and end date (in Sydney time);
   - how many times it can be used, in total and per customer;
   - first order only.
6. Click **Create discount**. The list shows whether each code is *Scheduled*, *Active* or *Expired*, and how many times it's been used. A use is only counted once the order is paid.

**3. Automatic offers (no code needed)**
Same as a code, but choose **Automatic offer** and write the **Announcement text**, for example "Buy 3, get 1 free on earrings". While it's running:
- it shows at the front of the announcement bar;
- it appears as a badge on the products it covers;
- it's taken off in the bag by itself.

**Make the sale noticeable**
- **Site Content → Announcement bar:** add a message such as "30% off everything this weekend" with a link to **/sale**. Set **Show from** and **Hide after** so it appears and disappears on its own.
- **Site Content → Home page:** add a **Promo banner** or **Countdown** section.
- **Site Content → Pop-ups:** add a **Sale** pop-up with a button to **/sale**, set its dates and tick **Switched on**.

Remember to **Publish** each one, or set them up days ahead using the dates.

---

## Changing the home page

1. Go to **Site Content → Home page**. Each row is one section of the home page, from top to bottom.
2. Click a section to open it and change its words, pictures, buttons or dates.
3. Use the arrows to move a section up or down, untick **Show** to hide it, or use the bin icon to remove it.
4. To add a section, pick one from **Add a section** at the bottom and click **Add**:
   - **Hero:** the big picture or video at the top, with a headline and buttons. For video, upload a short MP4 clip; it plays silently on a loop.
   - **Product row:** a row of products from any collection, such as *New In* or *Watches under $200*. To change which products show, edit the collection under **Collections**.
   - **Category tiles, Promo banner, Picture with text, Countdown, Reviews, Instagram grid, Gift guide cards and Newsletter signup.**
5. Click **Preview** to check it, then **Publish**.

Pictures and videos upload straight from your computer or phone. Use wide pictures, at least 1600 pixels across, for the hero.

---

## Editing a page (About, FAQ, Shipping, Returns, Privacy, Terms, Contact)

1. Go to **Site Content → Pages** and click the page.
2. Edit the text in the editor box. The toolbar has:
   - **bold**, *italic* and underline;
   - two sizes of heading;
   - bullet and numbered lists;
   - quote and divider line;
   - **link**: select some words, click the link button, then type a page like `/pages/returns`, a web address, or `mailto:` followed by an email address;
   - undo and redo.
3. **In Google** (optional): the title and short description Google shows. If you leave them blank, the page title and the start of the text are used.
4. Click **Preview** to check it, then **Publish**.

**Adding a new page:** type a title under **Pages** and click **Add page**. New pages start hidden. Tick **Show on the shop** and publish when it's ready. To link to it, go to **Site Content → Menus**, add a link, choose **Page** and pick it.

Changing a page's **web address** after publishing is safe: the old address redirects to the new one.

---

## Shipping an order

1. Go to **Orders** and click the **To ship** tab. These orders are paid and waiting to be sent.
2. For each order, pick the items and pack them. Check the variant (for example the colour or size) against the order.
3. Book the parcel with your courier and keep the tracking number.

> **Coming soon:** online checkout and order management are the next part of the build. They'll add an order page with a **Mark as shipped** button, where you paste the tracking number. That moves the order to **Shipped** and emails the customer their tracking link, using the **Order shipped** email under Site Content → Emails. Until then, the Orders page is a read-only list.

---

## Everything else

**Menus** (Site Content → Menus)
- **Header:** the links across the top. A link to a category automatically lists its sub-categories in the drop-down menu. You can add extra links under it and a **Promo picture**.
- **Footer:** each item is a column heading with its links underneath.
- Each link can point at a category, collection, brand, page, or any web address.

**Announcement bar:** short scrolling messages at the top of every page. Each can have a link and its own start and end dates.

**Pop-ups:** a newsletter signup or a sale message that appears a few seconds after someone arrives. Each visitor sees it once.

**Redirects:** send an old link to a new one, for example after you rename something or move from another website. Product and page renames add these for you.

**Emails:** change the subject line and opening words of the emails the shop sends. Words in {curly brackets}, like {store}, are filled in automatically. **Use the original text** puts the wording back to how it was.

**Settings** (admins only):
- store name, logo and brand colour;
- contact email, phone and ABN, shown in the footer;
- social media links;
- shipping prices: standard, express, and the free-shipping amount;
- the footer's perks and newsletter text;
- the low-stock alert level.

All prices include GST.

**Staff** (admins only):
- Invite someone by email as **Staff** or **Admin**, change their role, or remove their access.
- Removing someone signs them out straight away.
- The shop always keeps at least one admin.

**Activity log:** shows who changed what, and when.

---

## If something goes wrong

- **A change isn't showing in the shop.** Check that you clicked **Publish**, not just Save draft. Check its **Show from** / **Hide after** dates and that **Show** / **Switched on** is ticked. Then refresh the shop page.
- **"Fix these before publishing".** The list says exactly what's missing, for example "image — required". Fix those items and publish again.
- **You published a mistake.** Open **Version history** and **Restore** the version before it.
- **You can't log in.** After several wrong tries the account pauses for a few minutes. If you've lost your authenticator app, ask an admin.
