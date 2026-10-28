-- AlterEnum
ALTER TYPE "AuthTokenType" ADD VALUE 'STAFF_INVITE';

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "linkType" TEXT NOT NULL DEFAULT 'url',
ADD COLUMN     "targetId" TEXT;

-- AlterTable
ALTER TABLE "Page" DROP COLUMN "body",
ADD COLUMN     "content" JSONB;

-- AlterTable
ALTER TABLE "Popup" ADD COLUMN     "buttonLabel" TEXT,
ADD COLUMN     "buttonLink" TEXT,
ADD COLUMN     "delaySeconds" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'sale',
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "abn" TEXT,
ADD COLUMN     "accentColor" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "expressShippingRate" DECIMAL(10,2),
ADD COLUMN     "logo" TEXT;

-- CreateTable
CREATE TABLE "ContentDraft" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentVersion_key_createdAt_idx" ON "ContentVersion"("key", "createdAt");

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: the header menu used to list the top-level categories automatically.
-- They're now ordinary menu links (pointing at each category) that the admin can
-- reorder or remove, placed before the existing extra links (New In, Sale).
UPDATE "MenuItem" SET "order" = "order" + (SELECT count(*) FROM "Category" WHERE "parentId" IS NULL)
WHERE "location" = 'header' AND "parentId" IS NULL;

INSERT INTO "MenuItem" ("id", "label", "linkType", "targetId", "url", "location", "order", "createdAt", "updatedAt")
SELECT 'menu_' || c."id", c."name", 'category', c."id", '/collections/' || c."slug", 'header',
       (ROW_NUMBER() OVER (ORDER BY c."order", c."name") - 1)::int, NOW(), NOW()
FROM "Category" c
WHERE c."parentId" IS NULL;
