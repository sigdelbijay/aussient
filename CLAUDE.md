@AGENTS.md

# Aussient — project rules

Aussient (aussient.com.au) is an Australian online store selling a handful of product kinds (earrings, watches, clothing and more) — a few hundred products in total. The owner is an intermediate developer: keep code simple and readable, avoid clever abstractions, and explain changes in plain English.

## Stack

Next.js (latest stable, App Router, TypeScript), Tailwind CSS, shadcn/ui, Prisma with Supabase PostgreSQL (database only), Auth.js, Cloudinary, Stripe Checkout (AUD), Resend, hosted on Vercel.

## Product model

Category tree (up to 3 levels) → ProductType (sets the options and spec fields) → Product (specs, brand, tags) → ProductVariant (up to 3 option values, SKU, price, sale price, stock). Collections group products for banners and home rows. Never hard-code a product kind — everything works from product types.

## Rules

- Prices are in AUD and include GST.
- Anything a shopper sees (text, images, banners, menus, pages, prices, product types) comes from the database and can be edited in the admin area. No hard-coded shop content.
- Only ADMIN and STAFF users can use /admin (STAFF can't change settings, payments or staff). Always check this on the server.
- Never trust prices or discounts sent from the browser; recalculate them on the server.
- Make every page mobile-friendly and fast.
- Don't add extra libraries or paid services without asking.
- When a task is finished, report: what changed, how to test it, and the git commit message to use.
