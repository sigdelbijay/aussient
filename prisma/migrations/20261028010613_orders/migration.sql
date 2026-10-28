-- AlterTable
ALTER TABLE "BackInStockRequest" ADD COLUMN     "notifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "activityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "remindedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "adminNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "confirmationSentAt" TIMESTAMP(3),
ADD COLUMN     "refundTotal" DECIMAL(10,2),
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "stripePaymentIntentId" TEXT,
ADD COLUMN     "stripeRefundId" TEXT,
ADD COLUMN     "trackingUrl" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "options" JSONB,
ADD COLUMN     "sku" TEXT;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "orderAlertEmail" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketingOptInAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BackInStockRequest_notified_idx" ON "BackInStockRequest"("notified");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- Existing orders: record when they shipped, and treat their emails as already sent.
UPDATE "Order" SET "shippedAt" = "updatedAt" WHERE "status" = 'SHIPPED';
UPDATE "Order" SET "confirmationSentAt" = "createdAt", "adminNotifiedAt" = "createdAt";
-- Existing bags shouldn't all get a reminder email the first time the job runs.
UPDATE "Cart" SET "activityAt" = "updatedAt", "remindedAt" = "updatedAt";
