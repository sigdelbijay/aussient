# Launching Aussient

A step-by-step guide to putting the shop live on **aussient.com.au**, plus what to set up so you know when something's wrong. Do the steps in order. Tick each box as you go.

---

## 1. Before you start

- [ ] **Vercel Pro plan** (US$20/month). The free Hobby plan is for non-commercial sites only. It also runs scheduled jobs just once a day, which is too slow for the 15-minute bag reminders and back-in-stock emails.
- [ ] **Supabase Pro plan** (US$25/month). The Free plan has no automatic backups and pauses inactive projects. See section 7.
- [ ] **Stripe account activated** for live payments: business details, ABN and bank account under **Settings → Business**.
- [ ] **Resend domain verified** for aussient.com.au (section 5), so emails come from your own address.
- [ ] The legal pages are filled in and published: **Admin → Site content → Pages**, then Privacy policy, Terms of service, Shipping and Returns & exchanges. They are waiting as drafts. Fill in everything in [square brackets].

**Which database?** Your current Supabase project already holds your products, pages and settings, so use it as the live database. Before launch:

- delete the sample products and the sample order **AUS-1000** in the admin;
- don't run `pnpm db:seed` against it again (that would reset the admin password and the sample content);
- after launch, make a second, free Supabase project for development, and point your local `.env` at that one.

---

## 2. Deploy to Vercel (Sydney)

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repository. Vercel detects Next.js and pnpm by itself.
2. The app already runs in the **Sydney region (syd1)** because of `vercel.json`, right next to your Supabase database (also Sydney). Check it after the first deploy under **Settings → Functions → Function Region**.
3. Before clicking **Deploy**, add the environment variables (section 3 below). If you deploy first, add them afterwards and click **Redeploy**.

## 3. Environment variables

In Vercel, go to **Project → Settings → Environment Variables**. Add each of these for **Production** (and for Preview too if you use preview links). The values come from `.env.example`, which explains where to find each one.

| Name                                                                     | Production value                                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                   | `https://aussient.com.au`                                                     |
| `DATABASE_URL`                                                           | Supabase pooled connection (port 6543, `?pgbouncer=true`)                     |
| `DIRECT_URL`                                                             | Supabase direct connection (port 5432)                                        |
| `AUTH_SECRET`                                                            | a **new** random value: `openssl rand -base64 32`. Don't reuse your local one |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`                                  | from Google Cloud (only if you use "Continue with Google")                    |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | same as local                                                                 |
| `STRIPE_SECRET_KEY`                                                      | the **live** key, `sk_live_…` (section 6)                                     |
| `STRIPE_WEBHOOK_SECRET`                                                  | the **live** webhook's `whsec_…` (section 6)                                  |
| `RESEND_API_KEY`                                                         | from Resend                                                                   |
| `EMAIL_FROM`                                                             | `Aussient <orders@aussient.com.au>`                                           |
| `CRON_SECRET`                                                            | a random value: `openssl rand -base64 32`                                     |

Notes:

- Don't add `ADMIN_EMAIL`, `ADMIN_PASSWORD` or `EMAIL_OUTBOX_DIR` to Vercel. They're only for your computer.
- Changing a variable later only takes effect after a **Redeploy**.
- `AUTH_SECRET` signs everyone's login. Changing it signs everybody out, admins included.

## 4. Database migrations

Migrations bring the live database's tables up to date with the code. Run them **from your computer**, using the live database's direct connection, every time you deploy code that adds a migration (a new folder in `prisma/migrations`):

```bash
DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres" pnpm db:deploy
```

- It only applies migrations that haven't run yet, so running it twice is safe.
- Run it **before** the new code goes live: migrate first, then push or deploy.
- If you're using your current database, that's what `.env` already points at. Just run `pnpm db:deploy`.

## 5. Connect aussient.com.au

1. In Vercel, go to **Project → Settings → Domains**. Add `aussient.com.au`, then `www.aussient.com.au`, and choose to redirect `www` to `aussient.com.au`.
2. Vercel shows the DNS records to create. Usually that's an **A** record for `@` and a **CNAME** for `www`; use the exact values Vercel gives you. Add them at the company where you bought the domain (your .com.au registrar).
3. Wait for Vercel to show **Valid Configuration**. That takes minutes, occasionally a few hours. The https certificate is automatic.

Then point the other services at the real address:

- [ ] **Resend → Domains:** add `aussient.com.au` and create the DNS records it lists (SPF, DKIM), then click Verify.
- [ ] **Google Cloud → Credentials → your OAuth client:** add the redirect URI `https://aussient.com.au/api/auth/callback/google`, and publish the consent screen.
- [ ] **Cloudinary:** nothing to change.

## 6. Switch Stripe to live

1. In the Stripe dashboard, turn **Test mode** off (top right).
2. **Developers → API keys:** copy the **Secret key** (`sk_live_…`) into Vercel as `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint:**
   - Endpoint URL: `https://aussient.com.au/api/webhooks/stripe`
   - Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
   - Save, then reveal the **Signing secret** (`whsec_…`) and put it in Vercel as `STRIPE_WEBHOOK_SECRET`.
4. **Settings → Payment methods:** switch on what you want to offer.
   - The shop mentions **Afterpay** on product pages and in the bag, so switch **Afterpay** on. Your test account currently offers Zip and Klarna but not Afterpay.
   - Also update the payment badges in the footer (`src/components/site-footer.tsx`) to match. They currently list PayPal, which Stripe Checkout doesn't offer in Australia.
5. **Settings → Branding:** add your logo and colours. They appear on the payment page.
6. **Settings → Public details:** set the statement descriptor (what customers see on their bank statement), e.g. `AUSSIENT`.
7. Redeploy in Vercel so the live keys take effect.
8. **Do one real order** with your own card. Check that it shows in **Admin → Orders** and that both emails arrive. Then refund it from the order page.

Your test-mode keys keep working on your computer, and `pnpm test:e2e` refuses to run with a live key.

---

## 7. Backups (Supabase)

**Check they're on:** in the Supabase dashboard, open your project and go to **Database → Backups → Scheduled backups**.

- On the **Pro** plan you'll see a backup for each of the last 7 days.
- On the **Free** plan there are none. Upgrade before launch.
- The **Point-in-Time Recovery** add-on (extra cost) lets you restore to any second, not just the daily snapshot.

**Restore a backup:**

1. Click **Restore** next to the day you want and confirm.
2. The **whole database** goes back to that moment. Orders, customers and changes made since then are lost.
3. The shop is unavailable for a few minutes while it runs, depending on size.
4. Before restoring, export the recent orders: **Admin → Orders → Export CSV**. That way you can re-enter anything made after the backup.

**Your own extra copy (recommended monthly):**

```bash
pg_dump "$DIRECT_URL" --format=custom --file="aussient-$(date +%F).dump"
```

- This needs the PostgreSQL tools: `brew install postgresql@17`.
- Keep the file somewhere safe and private. It contains customer details.
- To restore it into an empty database: `pg_restore --clean --if-exists --no-owner -d "<DIRECT_URL>" aussient-YYYY-MM-DD.dump`

---

## 8. Watching the site

**Error emails (already set up):**

- When something breaks on the live site, every admin gets an email saying which page and what error. If you fill in **Settings → Order alerts**, it goes to that address instead.
- You get at most one email per problem every 30 minutes, and 20 a day.
- Full details are under **Vercel → your project → Logs**.

**Uptime monitor (free, 5 minutes to set up):**

1. Sign up at [uptimerobot.com](https://uptimerobot.com) (free plan: checks every 5 minutes, email alerts).
2. Click **New monitor**, choose **HTTP(s)**:
   - URL: `https://aussient.com.au/api/health`
   - Name: Aussient
   - Alert contact: your email
3. That address answers "ok" only when **both** the website and the database are working. If either is down, you get an email, and another when it's back.
4. Optional: add a second monitor for `https://aussient.com.au/` itself.

---

## 9. Final checks on the live site

- [ ] Home, a product page and a category load on your phone.
- [ ] Sign up, confirm the email, log in.
- [ ] A real order goes through, appears in Admin, and both emails arrive (section 6, step 8).
- [ ] `https://aussient.com.au/robots.txt` and `https://aussient.com.au/sitemap.xml` load.
- [ ] Add the site to [Google Search Console](https://search.google.com/search-console) and submit `https://aussient.com.au/sitemap.xml`.
- [ ] If you set a Google Analytics ID, the cookie banner shows and analytics only starts after **Accept**.
- [ ] Check the speed at [pagespeed.web.dev](https://pagespeed.web.dev) (mobile). Run it twice: the first visit to each page makes the resized images.
- [ ] The UptimeRobot monitor is green.

## Testing before each launch-day change

```bash
pnpm test        # quick checks (prices, discounts, emails…)
pnpm test:e2e    # full shop test: sign up → bag → pay with Stripe's test card → order in admin
```

`pnpm test:e2e` builds the shop and runs it on port 3100 against the database in `.env`, using Stripe **test** mode. Emails are saved to `.emails/e2e` instead of being sent. Everything it creates (a test customer, a temporary admin, the test order) is deleted afterwards and the stock put back. The first time, run `pnpm exec playwright install chromium` to download the test browser.
