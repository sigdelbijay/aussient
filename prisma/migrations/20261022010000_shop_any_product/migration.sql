-- Shop pages for any product kind: brand pages, collection sort order,
-- and shop-wide text (tagline, delivery, returns) moved into the database.
ALTER TABLE "Brand" ADD COLUMN "description" TEXT;
ALTER TABLE "Collection" ADD COLUMN "sort" TEXT NOT NULL DEFAULT 'newest';
ALTER TABLE "SiteSettings" ADD COLUMN "tagline" TEXT,
  ADD COLUMN "metaDescription" TEXT,
  ADD COLUMN "deliveryInfo" TEXT,
  ADD COLUMN "returnsInfo" TEXT;
