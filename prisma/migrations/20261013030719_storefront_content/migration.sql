-- AlterTable
ALTER TABLE "HomeSection" ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "startsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "image" TEXT;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "footerPerks" JSONB,
ADD COLUMN     "newsletterHeading" TEXT,
ADD COLUMN     "newsletterText" TEXT;
