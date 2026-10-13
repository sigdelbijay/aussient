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

// Every seeded earring ships in these three finishes.
const finishes = [
  { name: "Gold", suffix: "GLD", bg: "c9a961" },
  { name: "Silver", suffix: "SLV", bg: "b8b8c0" },
  { name: "Rose Gold", suffix: "RSE", bg: "d9a7a0" },
];

type SeedProduct = {
  name: string;
  slug: string;
  description: string;
  price: number;
  salePrice?: number;
  stock: number;
  featured?: boolean;
};

const earrings: SeedProduct[] = [
  {
    name: "Nova Crystal Hoops",
    slug: "nova-crystal-hoops",
    description: "Faceted crystal hoops that catch the light from every angle.",
    price: 24.95,
    stock: 120,
    featured: true,
  },
  {
    name: "Molten Dome Studs",
    slug: "molten-dome-studs",
    description: "Sculptural molten-finish dome studs for an everyday edge.",
    price: 16.95,
    stock: 200,
  },
  {
    name: "Pearl Drop Danglers",
    slug: "pearl-drop-danglers",
    description: "Freshwater-look pearl drops on a delicate chain.",
    price: 22.95,
    salePrice: 17.95,
    stock: 85,
  },
  {
    name: "Celeste Huggie Hoops",
    slug: "celeste-huggie-hoops",
    description: "Snug pavé huggies that stack beautifully up the ear.",
    price: 19.95,
    stock: 150,
    featured: true,
  },
  {
    name: "Mini Star Studs",
    slug: "mini-star-studs",
    description: "Tiny star studs — the perfect second-piercing pick.",
    price: 12.95,
    stock: 300,
  },
  {
    name: "Aurora Chandelier Drops",
    slug: "aurora-chandelier-drops",
    description: "Statement chandelier drops for a big night out.",
    price: 34.95,
    salePrice: 24.95,
    stock: 40,
  },
  {
    name: "Twist Chunky Hoops",
    slug: "twist-chunky-hoops",
    description: "Bold twisted hoops with a chunky, confident profile.",
    price: 27.95,
    stock: 95,
    featured: true,
  },
  {
    name: "Pavé Heart Studs",
    slug: "pave-heart-studs",
    description: "Sparkling pavé hearts that go with absolutely everything.",
    price: 18.95,
    stock: 175,
  },
  {
    name: "Linked Chain Threaders",
    slug: "linked-chain-threaders",
    description: "Fluid chain threaders that move as you do.",
    price: 21.95,
    stock: 60,
  },
  {
    name: "Baroque Pearl Hoops",
    slug: "baroque-pearl-hoops",
    description: "Irregular baroque pearls on a polished gold hoop.",
    price: 29.95,
    salePrice: 22.95,
    stock: 50,
  },
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

  // ── Earrings (products + media + variants) ──────────────────
  for (const p of earrings) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
        salePrice: p.salePrice ?? null,
        stock: p.stock,
        material: "Gold-plated brass",
        status: "LIVE",
        featured: p.featured ?? false,
        categoryId: categories.earrings,
      },
      create: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        salePrice: p.salePrice ?? null,
        stock: p.stock,
        material: "Gold-plated brass",
        status: "LIVE",
        featured: p.featured ?? false,
        categoryId: categories.earrings,
      },
    });

    // Rebuild media + variants so re-running the seed stays consistent.
    await prisma.productMedia.deleteMany({ where: { productId: product.id } });
    await prisma.productVariant.deleteMany({ where: { productId: product.id } });

    await prisma.productMedia.createMany({
      data: [
        { productId: product.id, url: img(p.name, "1a1a1a"), alt: `${p.name} — front`, order: 0 },
        {
          productId: product.id,
          url: img(`${p.name} 2`, "c9a961"),
          alt: `${p.name} — on model`,
          order: 1,
        },
      ],
    });

    await prisma.productVariant.createMany({
      data: finishes.map((f) => ({
        productId: product.id,
        name: f.name,
        sku: `${p.slug.toUpperCase().replace(/-/g, "")}-${f.suffix}`,
        price: p.price,
        salePrice: p.salePrice ?? null,
        stock: Math.round(p.stock / finishes.length),
      })),
    });
  }
  console.log(`✓ ${earrings.length} earrings ready (with media + 3 finishes each)`);

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
        url: "/earrings",
        bg: "ff2d6f",
        links: [
          ["Studs", "/earrings/studs"],
          ["Hoops", "/earrings/hoops"],
          ["Drops & Danglers", "/earrings/drops"],
          ["Huggies", "/earrings/huggies"],
          ["Ear Stacks", "/earrings/stacks"],
        ],
      },
      {
        label: "Necklaces",
        url: "/necklaces",
        bg: "1a1a1a",
        links: [
          ["Pendants", "/necklaces/pendants"],
          ["Chains", "/necklaces/chains"],
          ["Chokers", "/necklaces/chokers"],
          ["Layered Sets", "/necklaces/layered"],
        ],
      },
      {
        label: "Rings",
        url: "/rings",
        bg: "c9a961",
        links: [
          ["Statement", "/rings/statement"],
          ["Stackable", "/rings/stackable"],
          ["Signet", "/rings/signet"],
          ["Adjustable", "/rings/adjustable"],
        ],
      },
      {
        label: "Sale",
        url: "/sale",
        bg: "ff2d6f",
        links: [
          ["Up to 50% Off", "/sale/50-off"],
          ["Last Chance", "/sale/last-chance"],
          ["Under $20", "/sale/under-20"],
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
          button: { label: "Shop New In", href: "/new" },
          secondaryButton: { label: "Shop Sale", href: "/sale" },
        },
      },
      {
        type: "category-tiles",
        title: "Shop by style",
        config: {
          tiles: [
            { label: "Studs", href: "/earrings/studs", image: img("Studs", "c9a961", "800x800") },
            { label: "Hoops", href: "/earrings/hoops", image: img("Hoops", "ff2d6f", "800x800") },
            { label: "Drops", href: "/earrings/drops", image: img("Drops", "1a1a1a", "800x800") },
            {
              label: "Huggies",
              href: "/earrings/huggies",
              image: img("Huggies", "d9a7a0", "800x800"),
            },
            {
              label: "Ear Stacks",
              href: "/earrings/stacks",
              image: img("Ear Stacks", "b8b8c0", "800x800"),
            },
          ],
        },
      },
      {
        type: "product-row",
        title: "New In",
        config: { source: "new", limit: 10, viewAll: { label: "Shop all", href: "/new" } },
      },
      {
        type: "promo-banner",
        config: {
          image: img("Buy 3 Get 1 Free", "ff2d6f", "1600x600"),
          heading: "Buy 3, get 1 free",
          text: "Mix and match any earrings — the cheapest one's on us. Discount applied at checkout.",
          button: { label: "Shop earrings", href: "/earrings" },
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
          viewAll: { label: "Shop all", href: "/sale/under-20" },
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
              href: "/gifts/for-her",
              image: img("For Her", "d9a7a0"),
            },
            {
              title: "Under $20",
              subtitle: "Little luxuries",
              href: "/sale/under-20",
              image: img("Under $20", "ff2d6f"),
            },
            {
              title: "Gift sets",
              subtitle: "Ready to give",
              href: "/gifts/sets",
              image: img("Gift Sets", "1a1a1a"),
            },
            {
              title: "Stocking fillers",
              subtitle: "Small but mighty",
              href: "/gifts/stocking-fillers",
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
