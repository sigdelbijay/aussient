import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

// Seeds connect over the DIRECT connection (port 5432), same as migrations.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Placeholder image until real Cloudinary assets are uploaded.
const img = (label: string, bg: string) =>
  `https://placehold.co/800x1000/${bg}/ffffff?text=${encodeURIComponent(label)}`;

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
