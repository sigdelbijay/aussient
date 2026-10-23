-- General store, step 2 of 2: REMOVE the old earring-only columns.
--
-- Safety check: stop (changing nothing) if any product hasn't been moved
-- into a product type yet — run `pnpm db:move-to-types` first.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Product" WHERE "productTypeId" IS NULL)
     OR EXISTS (SELECT 1 FROM "ProductVariant" WHERE "price" IS NULL)
     OR EXISTS (SELECT 1 FROM "Product" p WHERE NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p."id"))
     OR EXISTS (SELECT 1 FROM "ProductMedia" WHERE "variantId" IS NOT NULL AND "optionValueId" IS NULL)
  THEN
    RAISE EXCEPTION 'Products have not been moved into product types yet. Run `pnpm db:move-to-types`, then `pnpm prisma migrate resolve --rolled-back 20261019010001_general_store_cleanup` and deploy again.';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "categoryId",
DROP COLUMN "hypoallergenic",
DROP COLUMN "material",
DROP COLUMN "price",
DROP COLUMN "salePrice",
DROP COLUMN "stock",
DROP COLUMN "style",
ALTER COLUMN "productTypeId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "name",
ALTER COLUMN "price" SET NOT NULL;

-- AlterTable
ALTER TABLE "ProductMedia" DROP COLUMN "variantId";

