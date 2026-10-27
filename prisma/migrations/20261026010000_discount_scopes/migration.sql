
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DiscountScope" ADD VALUE 'PRODUCT_TYPE';
ALTER TYPE "DiscountScope" ADD VALUE 'BRAND';
ALTER TYPE "DiscountScope" ADD VALUE 'COLLECTION';

-- AlterTable
ALTER TABLE "Discount" ADD COLUMN     "brandId" TEXT,
ADD COLUMN     "collectionId" TEXT,
ADD COLUMN     "productTypeId" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountCountedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

