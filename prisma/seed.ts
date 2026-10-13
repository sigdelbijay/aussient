import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

// Seeds connect over the DIRECT connection (port 5432), same as migrations.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Placeholder image until real Cloudinary assets are uploaded.
// PNG (not placehold.co's default SVG) so next/image can optimise it.
const img = (label: string, bg: string, size = "800x1000") =>
  `https://placehold.co/${size}/${bg}/ffffff/png?text=${encodeURIComponent(label)}`;

// Finishes every seeded product comes in (each gets its own SKU, stock and photo).
const finishes = [
  { name: "Gold", suffix: "GLD", bg: "c9a961" },
  { name: "Silver", suffix: "SLV", bg: "b8b8c0" },
  { name: "Rose Gold", suffix: "RSE", bg: "d9a7a0" },
];

type SeedProduct = {
  name: string;
  slug: string;
  category: "earrings" | "necklaces" | "rings";
  style: string;
  material: string;
  hypoallergenic?: boolean;
  description: string;
  price: number;
  salePrice?: number;
  /** Stock per finish, in the order of `finishes`. */
  stock: [number, number, number];
  featured?: boolean;
  /** Slugs for "Complete the look". */
  look?: string[];
  /** Own price per finish (null = the product's price), in the order of `finishes`. */
  finishPrices?: [number | null, number | null, number | null];
  /** A product video, shown after the photos in the gallery. */
  video?: string;
};

const DETAILS = (size: string) =>
  `Size: ${size}\nClosure: butterfly back / clasp as pictured\nNickel-free and lead-free\nSold individually as a pair or single piece as described`;
const CARE =
  "Keep away from water, perfume and lotions. Store in the Aussient pouch when you're not wearing it, and wipe gently with a soft cloth to keep it shining.";

const products: SeedProduct[] = [
  { name: "Nova Crystal Hoops", slug: "nova-crystal-hoops", category: "earrings", style: "hoops", material: "Gold-plated brass", description: "Faceted crystal hoops that catch the light from every angle.", price: 24.95, stock: [40, 40, 40], featured: true, look: ["bold-link-chain-necklace", "stacked-signet-ring"],
    // Sample video + a pricier Gold finish, to show the gallery video and price changing with the finish.
    finishPrices: [29.95, null, null], video: "https://res.cloudinary.com/demo/video/upload/q_auto,w_720/dog.mp4" },
  { name: "Molten Dome Studs", slug: "molten-dome-studs", category: "earrings", style: "studs", material: "Sterling silver", hypoallergenic: true, description: "Sculptural molten-finish dome studs for an everyday edge.", price: 16.95, stock: [70, 70, 60], look: ["snake-chain-choker"] },
  { name: "Pearl Drop Danglers", slug: "pearl-drop-danglers", category: "earrings", style: "drops", material: "Gold-plated brass", description: "Freshwater-look pearl drops on a delicate chain.", price: 22.95, salePrice: 17.95, stock: [30, 30, 25], look: ["pearl-pendant-necklace"] },
  { name: "Celeste Huggie Hoops", slug: "celeste-huggie-hoops", category: "earrings", style: "huggies", material: "Stainless steel", hypoallergenic: true, description: "Snug pavé huggies that stack beautifully up the ear.", price: 19.95, stock: [50, 50, 50], featured: true, look: ["mini-star-studs", "pave-band-ring"] },
  { name: "Mini Star Studs", slug: "mini-star-studs", category: "earrings", style: "studs", material: "Titanium", hypoallergenic: true, description: "Tiny star studs — the perfect second-piercing pick.", price: 12.95, stock: [100, 100, 100], look: ["celeste-huggie-hoops"] },
  // Rose Gold sold out — selecting it should show "Notify me".
  { name: "Aurora Chandelier Drops", slug: "aurora-chandelier-drops", category: "earrings", style: "drops", material: "Gold-plated brass", description: "Statement chandelier drops for a big night out.", price: 34.95, salePrice: 24.95, stock: [12, 8, 0], look: ["layered-coin-necklace"] },
  { name: "Twist Chunky Hoops", slug: "twist-chunky-hoops", category: "earrings", style: "hoops", material: "Stainless steel", hypoallergenic: true, description: "Bold twisted hoops with a chunky, confident profile.", price: 27.95, stock: [35, 30, 30], featured: true, look: ["bold-link-chain-necklace"] },
  { name: "Pavé Heart Studs", slug: "pave-heart-studs", category: "earrings", style: "studs", material: "Sterling silver", hypoallergenic: true, description: "Sparkling pavé hearts that go with absolutely everything.", price: 18.95, stock: [60, 60, 55], look: ["pave-band-ring"] },
  // Entirely sold out — the whole product shows "Sold out".
  { name: "Linked Chain Threaders", slug: "linked-chain-threaders", category: "earrings", style: "threaders", material: "Gold-plated brass", description: "Fluid chain threaders that move as you do.", price: 21.95, stock: [0, 0, 0] },
  // Silver low on stock — shows "Only 3 left".
  { name: "Baroque Pearl Hoops", slug: "baroque-pearl-hoops", category: "earrings", style: "hoops", material: "Gold-plated brass", description: "Irregular baroque pearls on a polished gold hoop.", price: 29.95, salePrice: 22.95, stock: [15, 3, 10], look: ["pearl-pendant-necklace"] },
  { name: "Bold Link Chain Necklace", slug: "bold-link-chain-necklace", category: "necklaces", style: "chains", material: "Stainless steel", hypoallergenic: true, description: "A chunky paperclip chain that layers with everything.", price: 34.95, stock: [25, 25, 20], featured: true, look: ["twist-chunky-hoops"] },
  { name: "Snake Chain Choker", slug: "snake-chain-choker", category: "necklaces", style: "chokers", material: "Gold-plated brass", description: "Liquid-smooth snake chain that sits right at the collarbone.", price: 27.95, stock: [30, 30, 30], look: ["molten-dome-studs"] },
  { name: "Pearl Pendant Necklace", slug: "pearl-pendant-necklace", category: "necklaces", style: "pendants", material: "Sterling silver", hypoallergenic: true, description: "A single freshwater-look pearl on a fine trace chain.", price: 39.95, salePrice: 29.95, stock: [20, 20, 15], look: ["pearl-drop-danglers"] },
  { name: "Layered Coin Necklace", slug: "layered-coin-necklace", category: "necklaces", style: "layered", material: "Gold-plated brass", description: "Two pre-layered chains with a hammered coin charm.", price: 44.95, stock: [4, 10, 10], look: ["aurora-chandelier-drops"] },
  { name: "Stacked Signet Ring", slug: "stacked-signet-ring", category: "rings", style: "signet", material: "Stainless steel", hypoallergenic: true, description: "A modern oval signet that looks great stacked or solo.", price: 29.95, stock: [20, 20, 20], look: ["nova-crystal-hoops"] },
  { name: "Pavé Band Ring", slug: "pave-band-ring", category: "rings", style: "stackable", material: "Sterling silver", hypoallergenic: true, description: "A slim band of sparkling pavé stones, made for stacking.", price: 24.95, stock: [30, 30, 30], look: ["pave-heart-studs"] },
  { name: "Molten Statement Ring", slug: "molten-statement-ring", category: "rings", style: "statement", material: "Gold-plated brass", description: "A sculptural, molten-look cocktail ring with real presence.", price: 32.95, salePrice: 26.95, stock: [15, 15, 15], look: ["molten-dome-studs"] },
];

async function main() {
  // ── Admin user ──────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env to seed the admin user.");
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    // The admin's email counts as confirmed; they still set up 2FA on first login.
    update: { role: "ADMIN", passwordHash, emailVerified: new Date() },
    create: {
      email: adminEmail,
      name: "Aussient Admin",
      role: "ADMIN",
      passwordHash,
      emailVerified: new Date(),
    },
  });
  console.log(`✓ Admin user ready: ${admin.email}`);

  // ── Categories ──────────────────────────────────────────────
  const categorySeed = [
    { name: "Earrings", slug: "earrings", order: 0, bg: "1a1a1a" },
    { name: "Necklaces", slug: "necklaces", order: 1, bg: "c9a961" },
    { name: "Rings", slug: "rings", order: 2, bg: "ff2d6f" },
  ];
  const categories: Record<string, string> = {};
  for (const c of categorySeed) {
    const category = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, order: c.order, image: img(c.name, c.bg) },
      create: {
        name: c.name,
        slug: c.slug,
        order: c.order,
        image: img(c.name, c.bg),
      },
    });
    categories[c.slug] = category.id;
  }
  console.log(`✓ ${categorySeed.length} categories ready`);

  // ── Products (with variants, per-finish photos and pairings) ──
  const ids: Record<string, string> = {};
  for (const p of products) {
    const data = {
      name: p.name,
      description: p.description,
      price: p.price,
      salePrice: p.salePrice ?? null,
      stock: p.stock.reduce((a, b) => a + b, 0),
      material: p.material,
      style: p.style,
      hypoallergenic: p.hypoallergenic ?? false,
      details: DETAILS(p.category === "rings" ? "Adjustable, fits sizes N–Q" : "As pictured"),
      care: CARE,
      status: "LIVE" as const,
      featured: p.featured ?? false,
      categoryId: categories[p.category],
    };
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: data,
      create: { ...data, slug: p.slug },
    });
    ids[p.slug] = product.id;

    // Rebuild media + variants so re-running the seed stays consistent.
    await prisma.productMedia.deleteMany({ where: { productId: product.id } });
    await prisma.productVariant.deleteMany({ where: { productId: product.id } });

    await prisma.productMedia.createMany({
      data: [
        { productId: product.id, url: img(p.name, "1a1a1a"), alt: `${p.name} — front`, order: 0 },
        { productId: product.id, url: img(`${p.name} — on model`, "ff2d6f"), alt: `${p.name} — on model`, order: 1 },
        ...(p.video
          ? [{ productId: product.id, url: p.video, type: "VIDEO" as const, alt: `${p.name} — video`, order: 10 }]
          : []),
      ],
    });

    for (const [i, f] of finishes.entries()) {
      // Variants inherit the product's price/sale price (null = same as product).
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          name: f.name,
          sku: `${p.slug.toUpperCase().replace(/-/g, "")}-${f.suffix}`,
          price: p.finishPrices?.[i] ?? null,
          stock: p.stock[i],
        },
      });
      await prisma.productMedia.create({
        data: {
          productId: product.id,
          variantId: variant.id,
          url: img(`${p.name} — ${f.name}`, f.bg),
          alt: `${p.name} in ${f.name}`,
          order: 2 + i,
        },
      });
    }
  }
  for (const p of products) {
    await prisma.product.update({
      where: { id: ids[p.slug] },
      data: { completeTheLook: { set: (p.look ?? []).map((slug) => ({ id: ids[slug] })) } },
    });
  }
  console.log(`✓ ${products.length} products ready (3 finishes each, per-finish photos, pairings)`);

  await seedStorefrontContent();
}

/**
 * Sample storefront content: site settings, announcement bar, menus, home page
 * sections and reviews. Each block only runs while its table is empty, so
 * re-running the seed never overwrites what the admin has edited.
 */
async function seedStorefrontContent() {
  const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  // ── Site settings ───────────────────────────────────────────
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      storeName: "Aussient",
      supportEmail: "hello@aussient.com.au",
      freeShippingThreshold: 50,
      flatShippingRate: 7.95,
      newsletterHeading: "Join the list",
      newsletterText:
        "Get 10% off your first order, early access to drops, and sale alerts before anyone else.",
      footerPerks: ["Free shipping over $50", "30-day easy returns", "Friendly support"],
      socials: {
        instagram: "https://instagram.com/aussient",
        tiktok: "https://tiktok.com/@aussient",
        youtube: "https://youtube.com/@aussient",
        threads: "https://threads.net/@aussient",
      },
    },
  });

  // ── Announcement bar ────────────────────────────────────────
  if ((await prisma.banner.count({ where: { placement: "announcement" } })) === 0) {
    const messages = [
      "Free shipping on orders over $50",
      "New drops every week",
      "Buy 3, get 1 free on earrings",
      "Afterpay & Zip available",
      "30-day easy returns",
    ];
    await prisma.banner.createMany({
      data: messages.map((title, order) => ({ title, placement: "announcement", order })),
    });
  }

  // ── Header menu (with mega-menu links + picture) ────────────
  if ((await prisma.menuItem.count({ where: { location: "header" } })) === 0) {
    const header = [
      {
        label: "Earrings",
        url: "/collections/earrings",
        bg: "ff2d6f",
        links: [
          ["Studs", "/collections/earrings?style=studs"],
          ["Hoops", "/collections/earrings?style=hoops"],
          ["Drops & Danglers", "/collections/earrings?style=drops"],
          ["Huggies", "/collections/earrings?style=huggies"],
          ["Threaders", "/collections/earrings?style=threaders"],
        ],
      },
      {
        label: "Necklaces",
        url: "/collections/necklaces",
        bg: "1a1a1a",
        links: [
          ["Pendants", "/collections/necklaces?style=pendants"],
          ["Chains", "/collections/necklaces?style=chains"],
          ["Chokers", "/collections/necklaces?style=chokers"],
          ["Layered Sets", "/collections/necklaces?style=layered"],
        ],
      },
      {
        label: "Rings",
        url: "/collections/rings",
        bg: "c9a961",
        links: [
          ["Statement", "/collections/rings?style=statement"],
          ["Stackable", "/collections/rings?style=stackable"],
          ["Signet", "/collections/rings?style=signet"],
          ["Adjustable", "/collections/rings?style=adjustable"],
        ],
      },
      {
        label: "Sale",
        url: "/sale",
        bg: "ff2d6f",
        links: [
          ["Up to 50% Off", "/sale"],
          ["Last Chance", "/sale"],
          ["Under $20", "/collections/all?price=under-20"],
        ],
      },
    ];
    for (const [order, item] of header.entries()) {
      await prisma.menuItem.create({
        data: {
          label: item.label,
          url: item.url,
          location: "header",
          order,
          image: img(`Shop ${item.label}`, item.bg, "800x600"),
          children: {
            create: item.links.map(([label, url], i) => ({
              label,
              url,
              location: "header",
              order: i,
            })),
          },
        },
      });
    }
  }

  // ── Footer menu (each top-level item is a column) ───────────
  if ((await prisma.menuItem.count({ where: { location: "footer" } })) === 0) {
    const footer = [
      {
        label: "Help",
        links: [
          ["Contact Us", "/help/contact"],
          ["Shipping", "/help/shipping"],
          ["Returns & Exchanges", "/help/returns"],
          ["Order Tracking", "/help/tracking"],
          ["FAQs", "/help/faqs"],
        ],
      },
      {
        label: "Legal",
        links: [
          ["Terms of Service", "/policies/terms"],
          ["Privacy Policy", "/policies/privacy"],
          ["Refund Policy", "/policies/refunds"],
          ["Accessibility", "/policies/accessibility"],
        ],
      },
    ];
    for (const [order, col] of footer.entries()) {
      await prisma.menuItem.create({
        data: {
          label: col.label,
          url: "#",
          location: "footer",
          order,
          children: {
            create: col.links.map(([label, url], i) => ({
              label,
              url,
              location: "footer",
              order: i,
            })),
          },
        },
      });
    }
  }

  // ── Home page sections ──────────────────────────────────────
  if ((await prisma.homeSection.count()) === 0) {
    const sections: {
      type: string;
      title?: string;
      config: object;
      startsAt?: Date;
      endsAt?: Date;
      active?: boolean;
    }[] = [
      {
        type: "hero",
        config: {
          eyebrow: "New Season",
          headline: "Shine loud. Spend little.",
          subheading: "Trend-led fashion jewellery dropping every week — priced to stack.",
          image: img("Aussient — New Season", "1a1a1a", "1920x1080"),
          button: { label: "Shop New In", href: "/new-in" },
          secondaryButton: { label: "Shop Sale", href: "/sale" },
        },
      },
      {
        type: "category-tiles",
        title: "Shop by style",
        config: {
          tiles: [
            { label: "Studs", href: "/collections/earrings?style=studs", image: img("Studs", "c9a961", "800x800") },
            { label: "Hoops", href: "/collections/earrings?style=hoops", image: img("Hoops", "ff2d6f", "800x800") },
            { label: "Drops", href: "/collections/earrings?style=drops", image: img("Drops", "1a1a1a", "800x800") },
            {
              label: "Huggies",
              href: "/collections/earrings?style=huggies",
              image: img("Huggies", "d9a7a0", "800x800"),
            },
            {
              label: "Threaders",
              href: "/collections/earrings?style=threaders",
              image: img("Threaders", "b8b8c0", "800x800"),
            },
          ],
        },
      },
      {
        type: "product-row",
        title: "New In",
        config: { source: "new", limit: 10, viewAll: { label: "Shop all", href: "/new-in" } },
      },
      {
        type: "promo-banner",
        config: {
          image: img("Buy 3 Get 1 Free", "ff2d6f", "1600x600"),
          heading: "Buy 3, get 1 free",
          text: "Mix and match any earrings — the cheapest one's on us. Discount applied at checkout.",
          button: { label: "Shop earrings", href: "/collections/earrings" },
        },
      },
      // Scheduled ahead of time: appears on Black Friday and disappears after Cyber Monday.
      {
        type: "promo-banner",
        startsAt: new Date("2026-11-27T00:00:00+11:00"),
        endsAt: new Date("2026-12-01T00:00:00+11:00"),
        config: {
          image: img("Black Friday", "000000", "1600x600"),
          heading: "Black Friday: 40% off everything",
          text: "Our biggest sale of the year. Four days only.",
          button: { label: "Shop the sale", href: "/sale" },
        },
      },
      { type: "product-row", title: "Best Sellers", config: { source: "bestsellers", limit: 10 } },
      {
        type: "countdown",
        endsAt: days(7),
        config: {
          heading: "Flash sale ends soon",
          text: "Up to 30% off selected styles.",
          button: { label: "Shop the sale", href: "/sale" },
        },
      },
      {
        type: "product-row",
        title: "Under $20",
        config: {
          source: "under",
          maxPrice: 20,
          limit: 10,
          viewAll: { label: "Shop all", href: "/collections/all?price=under-20" },
        },
      },
      {
        type: "image-text",
        config: {
          image: img("Made to stack", "c9a961", "1000x1250"),
          heading: "Made to stack",
          body: "Every piece is designed to mix, match and layer. Hypoallergenic posts, gold-plated finishes and prices that let you build the whole look.",
          button: { label: "Our story", href: "/about" },
          imageSide: "left",
        },
      },
      {
        type: "product-row",
        title: "On Sale",
        config: { source: "sale", limit: 10, viewAll: { label: "Shop sale", href: "/sale" } },
      },
      {
        type: "gift-guide",
        title: "Gift guide",
        config: {
          cards: [
            {
              title: "For her",
              subtitle: "Pieces she'll wear every day",
              href: "/collections/earrings",
              image: img("For Her", "d9a7a0"),
            },
            {
              title: "Under $20",
              subtitle: "Little luxuries",
              href: "/collections/all?price=under-20",
              image: img("Under $20", "ff2d6f"),
            },
            {
              title: "Gift sets",
              subtitle: "Ready to give",
              href: "/collections/necklaces",
              image: img("Gift Sets", "1a1a1a"),
            },
            {
              title: "Stocking fillers",
              subtitle: "Small but mighty",
              href: "/collections/all?price=under-20",
              image: img("Stocking Fillers", "c9a961"),
            },
          ],
        },
      },
      { type: "reviews", title: "Loved by thousands", config: { limit: 6 } },
      {
        type: "instagram",
        title: "#WearAussient",
        config: {
          handle: "@aussient",
          url: "https://instagram.com/aussient",
          images: ["ff2d6f", "c9a961", "1a1a1a", "d9a7a0", "b8b8c0", "ff2d6f"].map((bg, i) => ({
            src: img(`@aussient ${i + 1}`, bg, "800x800"),
            alt: `Customer photo ${i + 1}`,
          })),
        },
      },
      {
        type: "newsletter",
        config: {
          heading: "Get 10% off",
          text: "Join the list for early access to drops and members-only sales.",
        },
      },
    ];
    await prisma.homeSection.createMany({
      data: sections.map((s, order) => ({ ...s, order })),
    });
  }

  // ── Reviews ─────────────────────────────────────────────────
  if ((await prisma.review.count()) === 0) {
    const products = await prisma.product.findMany({ select: { id: true }, take: 6 });
    const reviews = [
      {
        authorName: "Mia",
        rating: 5,
        title: "Obsessed!",
        body: "Wore these every day for a month and they still look brand new. Already ordered another pair.",
      },
      {
        authorName: "Chloe",
        rating: 5,
        title: "So sparkly",
        body: "They catch the light so beautifully. Got so many compliments at my friend's wedding.",
      },
      {
        authorName: "Jess",
        rating: 5,
        title: "Perfect gift",
        body: "Bought for my sister's birthday — the packaging was gorgeous and she loved them.",
      },
      {
        authorName: "Olivia",
        rating: 4,
        title: "Great value",
        body: "Look way more expensive than they are. Lightweight and comfy for sensitive ears.",
      },
      {
        authorName: "Sophie",
        rating: 5,
        title: "Fast shipping",
        body: "Arrived in two days to Brisbane. Quality is amazing for the price.",
      },
      {
        authorName: "Ella",
        rating: 5,
        title: "My new favourites",
        body: "The huggies are the perfect size for stacking with my other piercings.",
      },
    ];
    await prisma.review.createMany({
      data: reviews.map((r, i) => ({
        ...r,
        productId: products[i % products.length].id,
        approved: true,
      })),
    });
    // One waiting for approval, to show it stays hidden on the site.
    await prisma.review.create({
      data: {
        productId: products[0].id,
        authorName: "Anon",
        rating: 1,
        body: "Not approved yet.",
        approved: false,
      },
    });
  }

  // ── Discounts ───────────────────────────────────────────────
  if ((await prisma.discount.count()) === 0) {
    const earrings = await prisma.category.findUniqueOrThrow({ where: { slug: "earrings" } });
    await prisma.discount.createMany({
      data: [
        // Automatic (no code): matches the "Buy 3 Get 1 Free" home banner.
        { type: "BUY_X_GET_Y", scope: "CATEGORY", categoryId: earrings.id, buyQuantity: 3, getQuantity: 1 },
        { code: "WELCOME10", type: "PERCENT", value: 10, firstOrderOnly: true, perCustomerLimit: 1 },
        { code: "FREESHIP", type: "FREE_SHIPPING", minSpend: 30 },
        { code: "SAVE5", type: "AMOUNT", value: 5, minSpend: 40 },
      ],
    });
    console.log("✓ Discounts ready (auto Buy 3 Get 1 on earrings; WELCOME10, FREESHIP, SAVE5)");
  }

  // ── Sample order ────────────────────────────────────────────
  // One shipped order for the admin, so "Write a review" can be tried on
  // Nova Crystal Hoops. (It also counts as one sale in "Best selling".)
  if ((await prisma.order.count()) === 0) {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL! } });
    const product = await prisma.product.findUniqueOrThrow({
      where: { slug: "nova-crystal-hoops" },
      include: { variants: { where: { name: "Silver" } } },
    });
    const variant = product.variants[0];
    const unitPrice = Number(variant?.price ?? product.salePrice ?? product.price);
    const shipping = 7.95;
    await prisma.order.create({
      data: {
        number: "AUS-1000",
        userId: admin.id,
        email: admin.email,
        name: admin.name ?? "Aussient Admin",
        shippingAddress: {
          fullName: admin.name ?? "Aussient Admin",
          line1: "1 Sample Street",
          city: "Sydney",
          state: "NSW",
          postcode: "2000",
          country: "Australia",
        },
        subtotal: unitPrice,
        shippingTotal: shipping,
        total: unitPrice + shipping,
        status: "SHIPPED",
        items: {
          create: {
            productId: product.id,
            variantId: variant?.id,
            name: product.name,
            variantName: variant?.name,
            unitPrice,
            quantity: 1,
            lineTotal: unitPrice,
          },
        },
      },
    });
    console.log("✓ Sample order AUS-1000 ready (admin bought Nova Crystal Hoops)");
  }

  console.log(
    "✓ Storefront content ready (settings, announcement bar, menus, home sections, reviews)",
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("🌱 Seed complete.");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
