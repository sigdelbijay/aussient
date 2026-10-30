-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "googleAnalyticsId" TEXT;

-- CreateTable
CREATE TABLE "CheckoutSession" (
    "id" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "userId" TEXT,
    "email" TEXT,
    "lines" JSONB NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discountTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_stripeSessionId_key" ON "CheckoutSession"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_orderId_key" ON "CheckoutSession"("orderId");

-- CreateIndex
CREATE INDEX "CheckoutSession_createdAt_idx" ON "CheckoutSession"("createdAt");

-- CreateIndex
CREATE INDEX "RateLimitHit_key_createdAt_idx" ON "RateLimitHit"("key", "createdAt");

-- Order numbers (AUS-1001, AUS-1002, …) come from this counter, so two
-- orders paid at the same moment can never get the same number.
CREATE SEQUENCE "order_number_seq";
SELECT setval(
  '"order_number_seq"',
  GREATEST(
    1000,
    COALESCE((SELECT MAX(CAST(SUBSTRING("number" FROM '[0-9]+$') AS INTEGER)) FROM "Order" WHERE "number" ~ '[0-9]+$'), 1000)
  )
);
