-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "care" TEXT,
ADD COLUMN     "details" TEXT,
ADD COLUMN     "hypoallergenic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "style" TEXT;

-- AlterTable
ALTER TABLE "ProductMedia" ADD COLUMN     "variantId" TEXT;

-- CreateTable
CREATE TABLE "_CompleteTheLook" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CompleteTheLook_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CompleteTheLook_B_index" ON "_CompleteTheLook"("B");

-- CreateIndex
CREATE INDEX "BackInStockRequest_email_idx" ON "BackInStockRequest"("email");

-- CreateIndex
CREATE INDEX "Product_status_createdAt_idx" ON "Product"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompleteTheLook" ADD CONSTRAINT "_CompleteTheLook_A_fkey" FOREIGN KEY ("A") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompleteTheLook" ADD CONSTRAINT "_CompleteTheLook_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
