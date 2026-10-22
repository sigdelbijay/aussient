/**
 * One-off: moves the existing jewellery products into product types.
 * Run it ONCE, between the two "general_store" migrations:
 *
 *   pnpm prisma migrate deploy   # step 1 adds the new tables (step 2 waits for this script)
 *   pnpm db:move-to-types        # this script
 *   pnpm prisma migrate deploy   # step 2 removes the old columns
 *
 * For each product it:
 *   - puts it in a product type named after its category ("earrings" → "Earrings";
 *     necklaces and rings get "Necklace" and "Ring" with the same options and specs)
 *   - moves material, style, hypoallergenic and the "Closure:" line from Details into specs
 *   - links it to its category (products can now be in several)
 *   - turns each finish (Gold, Silver…) into a "Finish" option value with a swatch colour,
 *     and gives every variant its own price (finishes without one used the product's)
 *   - creates one default variant for products that had no finishes (keeping price and stock)
 *   - points finish photos and saved bags at the new option values / variants
 *
 * Safe to run again: products that already have a type are skipped.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import type { SpecField } from "../src/lib/product-types";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }) });

// Old category slug → product type name. Any other category uses its own name.
const TYPE_FOR_CATEGORY: Record<string, string> = { earrings: "Earrings", necklaces: "Necklace", rings: "Ring" };

// The swatch colours the shop used to hard-code, now saved on each option value.
const SWATCHES: Record<string, string> = {
  gold: "#d8bc7c",
  silver: "#cfd0d6",
  "rose gold": "#dfa99b",
  black: "#18161d",
};

type OldProduct = {
  id: string;
  name: string;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  price: Prisma.Decimal | null;
  salePrice: Prisma.Decimal | null;
  stock: number;
  material: string | null;
  style: string | null;
  hypoallergenic: boolean;
  details: string | null;
};
type OldVariant = {
  id: string;
  name: string | null;
  price: Prisma.Decimal | null;
  salePrice: Prisma.Decimal | null;
  stock: number;
};

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const unique = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();

/** "Closure: butterfly back" line → its value, and the details without that line. */
function takeClosure(details: string | null) {
  if (!details) return { closure: null, details };
  const match = details.match(/^\s*Closure:\s*(.+)$/im);
  if (!match) return { closure: null, details };
  const rest = details
    .split("\n")
    .filter((line) => !/^\s*Closure:/i.test(line))
    .join("\n")
    .trim();
  return { closure: capitalise(match[1].trim()), details: rest || null };
}

async function main() {
  const products = await prisma.$queryRaw<OldProduct[]>`
    SELECT p."id", p."name", p."categoryId", c."slug" AS "categorySlug", c."name" AS "categoryName",
           p."price", p."salePrice", p."stock", p."material", p."style", p."hypoallergenic", p."details"
    FROM "Product" p LEFT JOIN "Category" c ON c."id" = p."categoryId"
    WHERE p."productTypeId" IS NULL
    ORDER BY p."createdAt"`;
  if (products.length === 0) {
    console.log("Nothing to move — every product already has a product type.");
    return;
  }

  // ── 1. Product types (one per old category) ─────────────────
  const typeName = (p: OldProduct) =>
    (p.categorySlug && TYPE_FOR_CATEGORY[p.categorySlug]) || p.categoryName || "Earrings";
  const typeIds = new Map<string, string>();
  for (const name of unique(products.map(typeName))) {
    const mine = products.filter((p) => typeName(p) === name);
    const specFields: SpecField[] = [
      { label: "Material", kind: "pick", choices: unique(mine.map((p) => p.material)), filterable: true },
      { label: "Style", kind: "pick", choices: unique(mine.map((p) => p.style && capitalise(p.style))), filterable: true },
      { label: "Closure", kind: "text" },
      { label: "Hypoallergenic", kind: "yes-no", filterable: true },
    ];
    const existing = await prisma.productType.findUnique({ where: { name } });
    const type =
      existing ??
      (await prisma.productType.create({
        data: { name, optionNames: ["Finish"], specFields: specFields as unknown as Prisma.InputJsonValue },
      }));
    typeIds.set(name, type.id);
    console.log(`${existing ? "•" : "✓"} Product type "${name}" ${existing ? "already exists" : "created"}`);
  }

  // ── 2. Each product ─────────────────────────────────────────
  const before = { variants: 0, stock: 0 };
  const after = { variants: 0, stock: 0 };
  for (const p of products) {
    const variants = await prisma.$queryRaw<OldVariant[]>`
      SELECT "id", "name", "price", "salePrice", "stock" FROM "ProductVariant"
      WHERE "productId" = ${p.id} ORDER BY "createdAt"`;
    before.variants += variants.length;
    before.stock += variants.length ? variants.reduce((n, v) => n + v.stock, 0) : p.stock;

    const { closure, details } = takeClosure(p.details);
    const specs: Record<string, string | boolean> = { Hypoallergenic: p.hypoallergenic };
    if (p.material) specs.Material = p.material;
    if (p.style) specs.Style = capitalise(p.style);
    if (closure) specs.Closure = closure;

    await prisma.$transaction(async (tx) => {
      // Finishes → "Finish" option values; each variant gets its own price.
      for (const [order, v] of variants.entries()) {
        const ownPrice = v.price !== null;
        const price = v.price ?? p.price;
        if (price === null) throw new Error(`${p.name}: no price on the product or the "${v.name}" finish`);
        let optionId: string | null = null;
        if (v.name) {
          const value = await tx.productOptionValue.upsert({
            where: { productId_option_value: { productId: p.id, option: "Finish", value: v.name } },
            update: {},
            create: { productId: p.id, option: "Finish", value: v.name, swatchColor: SWATCHES[v.name.toLowerCase()] ?? null, order },
          });
          optionId = value.id;
          // Photos of this finish now belong to its option value.
          await tx.$executeRaw`UPDATE "ProductMedia" SET "optionValueId" = ${value.id} WHERE "variantId" = ${v.id}`;
        }
        await tx.productVariant.update({
          where: { id: v.id },
          data: { option1Id: optionId, price, salePrice: ownPrice ? v.salePrice : p.salePrice },
        });
      }

      // No finishes → one default variant with the product's price and stock.
      if (variants.length === 0) {
        if (p.price === null) throw new Error(`${p.name}: has no price`);
        const v = await tx.productVariant.create({
          data: { productId: p.id, price: p.price, salePrice: p.salePrice, stock: p.stock },
        });
        // Bags that saved this product without a finish now point at that variant.
        await tx.cartItem.updateMany({ where: { productId: p.id, variantId: null }, data: { variantId: v.id } });
        await tx.backInStockRequest.updateMany({ where: { productId: p.id, variantId: null }, data: { variantId: v.id } });
      }

      await tx.product.update({
        where: { id: p.id },
        data: {
          productTypeId: typeIds.get(typeName(p))!,
          specs,
          details,
          ...(p.categoryId && { categories: { connect: { id: p.categoryId } } }),
        },
      });
    });

    const now = await prisma.productVariant.findMany({ where: { productId: p.id }, select: { stock: true } });
    after.variants += now.length;
    after.stock += now.reduce((n, v) => n + v.stock, 0);
    console.log(`✓ ${p.name} → ${typeName(p)} (${now.length} ${now.length === 1 ? "variant" : "variants"})`);
  }

  // ── 3. Check nothing was lost ───────────────────────────────
  const unlinkedPhotos = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "ProductMedia" WHERE "variantId" IS NOT NULL AND "optionValueId" IS NULL`;
  console.log(
    `\nMoved ${products.length} products. Variants: ${before.variants} before → ${after.variants} after ` +
      `(+1 default for each product that had none). Stock: ${before.stock} before → ${after.stock} after. ` +
      `Finish photos not linked: ${unlinkedPhotos[0].n}.`,
  );
  if (before.stock !== after.stock || Number(unlinkedPhotos[0].n) > 0) {
    throw new Error("Something didn't move over — check the output above before running the next migration.");
  }
  console.log("All done. Now run `pnpm prisma migrate deploy` to remove the old columns.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
