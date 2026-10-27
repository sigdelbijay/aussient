import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import type { SpecField } from "../src/lib/product-types";

// Seeds connect over the DIRECT connection (port 5432), same as migrations.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Placeholder image until real Cloudinary assets are uploaded.
// PNG (not placehold.co's default SVG) so next/image can optimise it.
const img = (label: string, bg: string, size = "800x1000") =>
  `https://placehold.co/${size}/${bg}/ffffff/png?text=${encodeURIComponent(label)}`;

// Shop-wide text shoppers see (Site settings). Lines become bullet points.
const SHOP_TEXT = {
  tagline: "Fashion, accessories & lifestyle",
  metaDescription: "On-trend clothing, watches, jewellery and accessories. New arrivals weekly, free shipping over $50 and easy returns.",
  deliveryInfo: "Orders placed before 2pm (AEST) on a weekday ship the same day.\nStandard delivery takes 2–6 business days Australia-wide.\nYou'll get a tracking link by email as soon as it ships.",
  returnsInfo: "Changed your mind? Return unworn, unused items within 30 days.\nEarrings can't be returned for hygiene reasons unless faulty.\nReturns are free with the prepaid label in your parcel.",
};

// Finishes every seeded jewellery product comes in (each gets its own SKU, stock and photo).
const finishes = [
  { name: "Gold", color: "#d8bc7c", bg: "c9a961" },
  { name: "Silver", color: "#cfd0d6", bg: "b8b8c0" },
  { name: "Rose Gold", color: "#dfa99b", bg: "d9a7a0" },
];

// Old jewellery categories → their product types.
const JEWELLERY_TYPE = { earrings: "Earrings", necklaces: "Necklace", rings: "Ring" } as const;
const CLOSURE: Record<string, string | undefined> = { earrings: "Butterfly back", necklaces: "Lobster clasp" };
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
  `Size: ${size}\nNickel-free and lead-free\nSold individually as a pair or single piece as described`;
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

  // ── Size guide ──────────────────────────────────────────────
  const teeGuide =
    (await prisma.sizeGuide.findFirst({ where: { name: "T-shirt sizes" } })) ??
    (await prisma.sizeGuide.create({
      data: {
        name: "T-shirt sizes",
        table: {
          columns: ["Size", "Chest (cm)", "Length (cm)"],
          rows: [
            ["S", "92", "70"],
            ["M", "100", "72"],
            ["L", "108", "74"],
            ["XL", "116", "76"],
          ],
        },
        notes: "AU sizes. Measurements are of the garment laid flat, in cm.",
      },
    }));

  // ── Product types ───────────────────────────────────────────
  // Each type sets what shoppers pick (options) and the facts listed (specs).
  const jewellerySpecs: SpecField[] = [
    { label: "Material", kind: "pick", choices: ["Gold-plated brass", "Stainless steel", "Sterling silver", "Titanium"], filterable: true },
    { label: "Style", kind: "pick", choices: [...new Set(products.map((p) => capitalise(p.style)))].sort(), filterable: true },
    { label: "Closure", kind: "text" },
    { label: "Hypoallergenic", kind: "yes-no", filterable: true },
  ];
  const typeSeed: { name: string; optionNames: string[]; specFields: SpecField[]; sizeGuideId?: string }[] = [
    { name: "Earrings", optionNames: ["Finish"], specFields: jewellerySpecs },
    { name: "Necklace", optionNames: ["Finish"], specFields: jewellerySpecs },
    { name: "Ring", optionNames: ["Finish"], specFields: jewellerySpecs },
    {
      name: "Watch",
      optionNames: ["Strap colour"],
      specFields: [
        { label: "Movement", kind: "pick", choices: ["Quartz", "Automatic", "Solar"], filterable: true },
        { label: "Case size", kind: "number", unit: "mm", filterable: true },
        { label: "Water resistance", kind: "pick", choices: ["30 m", "50 m", "100 m"], filterable: true },
        { label: "Warranty", kind: "text" },
      ],
    },
    {
      name: "T-shirt",
      optionNames: ["Size", "Colour"],
      specFields: [
        { label: "Fabric", kind: "pick", choices: ["100% cotton", "Organic cotton", "Cotton blend"], filterable: true },
        { label: "Fit", kind: "pick", choices: ["Regular", "Relaxed", "Slim"], filterable: true },
        { label: "Care", kind: "text" },
      ],
      sizeGuideId: teeGuide.id,
    },
  ];
  const types: Record<string, string> = {};
  for (const t of typeSeed) {
    const data = { optionNames: t.optionNames, specFields: t.specFields, sizeGuideId: t.sizeGuideId ?? null };
    const type = await prisma.productType.upsert({ where: { name: t.name }, update: data, create: { name: t.name, ...data } });
    types[t.name] = type.id;
  }
  console.log(`✓ ${typeSeed.length} product types ready (${typeSeed.map((t) => t.name).join(", ")})`);

  // ── Brands ──────────────────────────────────────────────────
  const brand = await prisma.brand.upsert({
    where: { slug: "southern-time" },
    update: {},
    create: {
      name: "Southern Time",
      slug: "southern-time",
      logo: img("Southern Time", "1a1a1a", "400x200"),
      description: "Everyday watches designed in Melbourne, built to last.",
    },
  });
  if (!brand.description) {
    await prisma.brand.update({ where: { id: brand.id }, data: { description: "Everyday watches designed in Melbourne, built to last." } });
  }

  // ── Categories (nested up to 3 levels) ──────────────────────
  const categorySeed: { name: string; slug: string; order: number; bg: string; parent?: string }[] = [
    { name: "Jewellery", slug: "jewellery", order: 0, bg: "c9a961" },
    { name: "Earrings", slug: "earrings", order: 0, bg: "1a1a1a", parent: "jewellery" },
    { name: "Necklaces", slug: "necklaces", order: 1, bg: "c9a961", parent: "jewellery" },
    { name: "Rings", slug: "rings", order: 2, bg: "ff2d6f", parent: "jewellery" },
    { name: "Watches", slug: "watches", order: 1, bg: "3a4a5a" },
    { name: "Clothing", slug: "clothing", order: 2, bg: "6b8f71" },
    { name: "Tops", slug: "tops", order: 0, bg: "6b8f71", parent: "clothing" },
    { name: "T-shirts", slug: "t-shirts", order: 0, bg: "6b8f71", parent: "tops" },
  ];
  const categories: Record<string, string> = {};
  for (const c of categorySeed) {
    const data = { name: c.name, order: c.order, image: img(c.name, c.bg), parentId: c.parent ? categories[c.parent] : null };
    const category = await prisma.category.upsert({ where: { slug: c.slug }, update: data, create: { ...data, slug: c.slug } });
    categories[c.slug] = category.id;
  }
  console.log(`✓ ${categorySeed.length} categories ready (Jewellery > Earrings…, Watches, Clothing > Tops > T-shirts)`);

  // ── Products ────────────────────────────────────────────────
  const ids: Record<string, string> = {};

  /**
   * Creates (or refreshes) a product with its option values, one variant per
   * combination, and photos. Re-running the seed rebuilds options, variants and photos.
   */
  async function seedProduct(p: {
    slug: string;
    name: string;
    type: string;
    categories: string[];
    description: string;
    specs: Record<string, string | number | boolean>;
    details?: string;
    care?: string;
    featured?: boolean;
    brandId?: string;
    tags?: string[];
    /** Option values per option, in the type's order. `color` = swatch hex, `bg` = placeholder photo colour. */
    options: { value: string; color?: string; bg?: string }[][];
    /** One per combination (in the order of `options`); return null to skip a combination. */
    variant: (values: string[]) => { price: number; salePrice?: number; stock: number } | null;
    video?: string;
    /** Placeholder photo shape: square (watches, jewellery) or tall (clothing). */
    photo?: "square" | "tall";
  }) {
    const size = p.photo === "tall" ? "800x1067" : "1000x1000";
    const data = {
      name: p.name,
      description: p.description,
      productTypeId: types[p.type],
      brandId: p.brandId ?? null,
      specs: p.specs,
      tags: p.tags ?? [],
      details: p.details ?? null,
      care: p.care ?? null,
      status: "LIVE" as const,
      featured: p.featured ?? false,
      categories: { set: p.categories.map((slug) => ({ id: categories[slug] })) },
    };
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: data,
      create: { ...data, slug: p.slug, categories: { connect: data.categories.set } },
    });
    ids[p.slug] = product.id;

    await prisma.productMedia.deleteMany({ where: { productId: product.id } });
    await prisma.productOptionValue.deleteMany({ where: { productId: product.id } }); // also removes their variants
    await prisma.productVariant.deleteMany({ where: { productId: product.id } });

    await prisma.productMedia.createMany({
      data: [
        { productId: product.id, url: img(p.name, "1a1a1a", size), alt: `${p.name} — front`, order: 0 },
        { productId: product.id, url: img(`${p.name} — on model`, "ff2d6f", size), alt: `${p.name} — on model`, order: 1 },
        ...(p.video ? [{ productId: product.id, url: p.video, type: "VIDEO" as const, alt: `${p.name} — video`, order: 10 }] : []),
      ],
    });

    // Option values (plus a photo for each one that has a colour, e.g. the Navy photo).
    const optionNames = typeSeed.find((t) => t.name === p.type)!.optionNames;
    const valueIds: Record<string, string>[] = [];
    let photo = 2;
    for (const [slot, values] of p.options.entries()) {
      valueIds[slot] = {};
      for (const [order, v] of values.entries()) {
        const row = await prisma.productOptionValue.create({
          data: { productId: product.id, option: optionNames[slot], value: v.value, swatchColor: v.color ?? null, order },
        });
        valueIds[slot][v.value] = row.id;
        if (v.bg) {
          await prisma.productMedia.create({
            data: { productId: product.id, optionValueId: row.id, url: img(`${p.name} — ${v.value}`, v.bg, size), alt: `${p.name} in ${v.value}`, order: photo++ },
          });
        }
      }
    }

    // Every combination of the option values (just one when there are no options).
    const combos = p.options.reduce<string[][]>((acc, values) => acc.flatMap((c) => values.map((v) => [...c, v.value])), [[]]);
    let count = 0;
    for (const combo of combos) {
      const v = p.variant(combo);
      if (!v) continue;
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          option1Id: combo[0] ? valueIds[0][combo[0]] : null,
          option2Id: combo[1] ? valueIds[1][combo[1]] : null,
          option3Id: combo[2] ? valueIds[2][combo[2]] : null,
          sku: [p.slug.toUpperCase().replace(/-/g, ""), ...combo.map((c) => c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))].join("-"),
          price: v.price,
          salePrice: v.salePrice ?? null,
          stock: v.stock,
        },
      });
      count++;
    }
    return count;
  }

  // Jewellery: three finishes each.
  for (const p of products) {
    await seedProduct({
      slug: p.slug,
      name: p.name,
      type: JEWELLERY_TYPE[p.category],
      categories: [p.category],
      description: p.description,
      specs: {
        Material: p.material,
        Style: capitalise(p.style),
        Hypoallergenic: p.hypoallergenic ?? false,
        ...(CLOSURE[p.category] && { Closure: CLOSURE[p.category] }),
      },
      details: DETAILS(p.category === "rings" ? "Adjustable, fits sizes N–Q" : "As pictured"),
      care: CARE,
      featured: p.featured,
      video: p.video,
      options: [finishes.map((f) => ({ value: f.name, color: f.color, bg: f.bg }))],
      variant: ([finish]) => {
        const i = finishes.findIndex((f) => f.name === finish);
        return { price: p.finishPrices?.[i] ?? p.price, salePrice: p.finishPrices?.[i] ? undefined : p.salePrice, stock: p.stock[i] };
      },
    });
  }

  // Watches: one option (strap colour), with a brand.
  await seedProduct({
    slug: "coastline-mesh-watch",
    name: "Coastline Mesh Watch",
    type: "Watch",
    categories: ["watches"],
    brandId: brand.id,
    description: "A slim minimalist watch on a fine mesh strap that adjusts to any wrist.",
    specs: { Movement: "Quartz", "Case size": 36, "Water resistance": "30 m", Warranty: "2 years" },
    tags: ["gift"],
    featured: true,
    options: [
      [
        { value: "Silver", color: "#cfd0d6", bg: "b8b8c0" },
        { value: "Gold", color: "#d8bc7c", bg: "c9a961" },
        { value: "Black", color: "#18161d", bg: "1a1a1a" },
      ],
    ],
    variant: ([strap]) => ({ price: 89.95, stock: strap === "Black" ? 4 : 25 }),
  });
  await seedProduct({
    slug: "outback-field-watch",
    name: "Outback Field Watch",
    type: "Watch",
    categories: ["watches"],
    brandId: brand.id,
    description: "A rugged automatic field watch with a leather strap and easy-read dial.",
    specs: { Movement: "Automatic", "Case size": 40, "Water resistance": "100 m", Warranty: "2 years" },
    tags: ["gift"],
    options: [
      [
        { value: "Tan leather", color: "#a0703c", bg: "a0703c" },
        { value: "Black leather", color: "#18161d", bg: "1a1a1a" },
      ],
    ],
    variant: ([strap]) => (strap === "Tan leather" ? { price: 149.95, salePrice: 129.95, stock: 12 } : { price: 149.95, stock: 8 }),
  });

  // T-shirts: two options (Size × Colour), with the size guide from the product type.
  const sizes = ["S", "M", "L", "XL"].map((value) => ({ value }));
  await seedProduct({
    slug: "everyday-crew-tee",
    photo: "tall",
    name: "Everyday Crew Tee",
    type: "T-shirt",
    categories: ["t-shirts"],
    description: "A soft, mid-weight crew neck tee you'll reach for every day.",
    specs: { Fabric: "100% cotton", Fit: "Regular", Care: "Machine wash cold, line dry" },
    tags: ["basics"],
    featured: true,
    options: [
      sizes,
      [
        { value: "White", color: "#f5f5f0", bg: "e8e8e0" },
        { value: "Black", color: "#18161d", bg: "1a1a1a" },
        { value: "Navy", color: "#1f2a44", bg: "1f2a44" },
      ],
    ],
    // No XL in White — choosing it shows "This combination isn't available". Small Navy is sold out.
    variant: ([size, colour]) =>
      size === "XL" && colour === "White"
        ? null
        : { price: size === "XL" ? 36.95 : 34.95, stock: size === "S" && colour === "Navy" ? 0 : 20 },
  });
  await seedProduct({
    slug: "relaxed-pocket-tee",
    photo: "tall",
    name: "Relaxed Pocket Tee",
    type: "T-shirt",
    categories: ["t-shirts"],
    description: "A boxy, relaxed-fit tee in organic cotton with a chest pocket.",
    specs: { Fabric: "Organic cotton", Fit: "Relaxed", Care: "Machine wash cold, line dry" },
    tags: ["basics", "summer"],
    options: [
      sizes,
      [
        { value: "Sage", color: "#9caf88", bg: "9caf88" },
        { value: "Sand", color: "#d8c7a8", bg: "d8c7a8" },
      ],
    ],
    variant: () => ({ price: 39.95, salePrice: 29.95, stock: 15 }),
  });

  for (const p of products) {
    await prisma.product.update({
      where: { id: ids[p.slug] },
      data: { completeTheLook: { set: (p.look ?? []).map((slug) => ({ id: ids[slug] })) } },
    });
  }
  console.log(`✓ ${Object.keys(ids).length} products ready (jewellery with finishes, 2 watches, 2 T-shirts)`);

  // ── Collections ─────────────────────────────────────────────
  await prisma.collection.upsert({
    where: { slug: "gifts-under-50" },
    update: {},
    create: {
      name: "Gifts under $50",
      slug: "gifts-under-50",
      description: "Easy gifts that look like you spent more.",
      image: img("Gifts under $50", "ff2d6f", "1600x600"),
      type: "AUTOMATIC",
      rulePriceUnder: 50,
    },
  });
  await prisma.collection.upsert({
    where: { slug: "staff-picks" },
    update: { products: { set: ["coastline-mesh-watch", "everyday-crew-tee", "nova-crystal-hoops"].map((s) => ({ id: ids[s] })) } },
    create: {
      name: "Staff picks",
      slug: "staff-picks",
      description: "What the Aussient team is wearing right now.",
      type: "MANUAL",
      products: { connect: ["coastline-mesh-watch", "everyday-crew-tee", "nova-crystal-hoops"].map((s) => ({ id: ids[s] })) },
    },
  });
  // Automatic collections behind the home page rows and the /new-in and /sale pages.
  // (No rules = every product; the sort sets the order.)
  const autoCollections = [
    { slug: "new-in", name: "New In", description: "The latest arrivals, added every week.", sort: "newest" },
    { slug: "best-sellers", name: "Best Sellers", description: "What everyone's buying right now.", sort: "best-selling" },
    { slug: "sale", name: "Sale", description: "Great prices on selected styles, while stock lasts.", sort: "newest", ruleOnSale: true },
    { slug: "under-20", name: "Under $20", description: "Little treats that don't break the bank.", sort: "price-asc", rulePriceUnder: 20 },
  ];
  for (const c of autoCollections) {
    await prisma.collection.upsert({ where: { slug: c.slug }, update: {}, create: { ...c, type: "AUTOMATIC" } });
  }
  console.log("✓ 6 collections ready (gifts-under-50, staff-picks, new-in, best-sellers, sale, under-20)");

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
      tagline: SHOP_TEXT.tagline,
      metaDescription: SHOP_TEXT.metaDescription,
      deliveryInfo: SHOP_TEXT.deliveryInfo,
      returnsInfo: SHOP_TEXT.returnsInfo,
      socials: {
        instagram: "https://instagram.com/aussient",
        tiktok: "https://tiktok.com/@aussient",
        youtube: "https://youtube.com/@aussient",
        threads: "https://threads.net/@aussient",
      },
    },
  });

  // Fill in shop text added later (tagline, delivery, returns) without touching anything already set.
  const current = await prisma.siteSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  await prisma.siteSettings.update({
    where: { id: "singleton" },
    data: {
      tagline: current.tagline ?? SHOP_TEXT.tagline,
      metaDescription: current.metaDescription ?? SHOP_TEXT.metaDescription,
      deliveryInfo: current.deliveryInfo ?? SHOP_TEXT.deliveryInfo,
      returnsInfo: current.returnsInfo ?? SHOP_TEXT.returnsInfo,
    },
  });

  // ── Upgrade the old jewellery-only sample content ───────────
  // The header menu is now built from the category tree, and home rows/tiles
  // from collections and categories. If the old sample content is still there
  // (never edited — there's no admin editor for it yet), replace it.
  if (await prisma.menuItem.findFirst({ where: { location: "header", url: "/collections/earrings" } })) {
    await prisma.menuItem.deleteMany({ where: { location: "header" } });
    console.log("  ↻ Replaced the old header menu (categories now fill it automatically)");
  }
  const oldSections = await prisma.homeSection.findMany({ where: { type: { in: ["product-row", "category-tiles"] } } });
  if (oldSections.some((s) => s.config && typeof s.config === "object" && ("source" in s.config || "tiles" in s.config))) {
    await prisma.homeSection.deleteMany({});
    console.log("  ↻ Replaced the old home page sections");
  }

  // ── Announcement bar ────────────────────────────────────────
  if ((await prisma.banner.count({ where: { placement: "announcement" } })) === 0) {
    const messages = [
      "Free shipping on orders over $50",
      "New drops every week",
      // "Buy 3, get 1 free on Earrings" comes from the automatic offer under Discounts.
      "Afterpay & Zip available",
      "30-day easy returns",
    ];
    await prisma.banner.createMany({
      data: messages.map((title, order) => ({ title, placement: "announcement", order })),
    });
  }

  // ── Header menu ─────────────────────────────────────────────
  // Top-level categories (and their sub-categories) fill the menu automatically;
  // these are extra links shown after them.
  if ((await prisma.menuItem.count({ where: { location: "header" } })) === 0) {
    await prisma.menuItem.createMany({
      data: [
        { label: "New In", url: "/new-in", location: "header", order: 0 },
        { label: "Sale", url: "/sale", location: "header", order: 1 },
      ],
    });
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
          headline: "New season. New you.",
          subheading: "Fashion, accessories and lifestyle pieces — new arrivals every week.",
          image: img("Aussient — New Season", "1a1a1a", "1920x1080"),
          button: { label: "Shop New In", href: "/new-in" },
          secondaryButton: { label: "Shop Sale", href: "/sale" },
        },
      },
      // Tiles come from the top-level categories (name + picture).
      { type: "category-tiles", title: "Shop by category", config: {} },
      // Product rows come from collections.
      { type: "product-row", title: "New In", config: { collection: "new-in", limit: 10 } },
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
      { type: "product-row", title: "Best Sellers", config: { collection: "best-sellers", limit: 10 } },
      { type: "product-row", title: "Staff picks", config: { collection: "staff-picks", limit: 10 } },
      {
        type: "countdown",
        endsAt: days(7),
        config: {
          heading: "Flash sale ends soon",
          text: "Up to 30% off selected styles.",
          button: { label: "Shop the sale", href: "/sale" },
        },
      },
      { type: "product-row", title: "Under $20", config: { collection: "under-20", limit: 10 } },
      {
        type: "image-text",
        config: {
          image: img("Made for every day", "c9a961", "1000x1250"),
          heading: "Made for every day",
          body: "Clothing, watches and accessories picked to mix, match and last — at prices that let you build the whole look.",
          button: { label: "Our story", href: "/about" },
          imageSide: "left",
        },
      },
      { type: "product-row", title: "On Sale", config: { collection: "sale", limit: 10 } },
      {
        type: "gift-guide",
        title: "Gift guide",
        config: {
          cards: [
            { title: "Gifts under $50", subtitle: "Look like you spent more", href: "/collections/gifts-under-50", image: img("Under $50", "d9a7a0") },
            { title: "Under $20", subtitle: "Little luxuries", href: "/collections/under-20", image: img("Under $20", "ff2d6f") },
            { title: "Watches", subtitle: "A gift that lasts", href: "/collections/watches", image: img("Watches", "3a4a5a") },
            { title: "Staff picks", subtitle: "What we're wearing", href: "/collections/staff-picks", image: img("Staff Picks", "c9a961") },
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
      include: { variants: { where: { option1: { value: "Silver" } } } },
    });
    const variant = product.variants[0];
    const unitPrice = Number(variant.salePrice ?? variant.price);
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
            variantName: "Silver",
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
