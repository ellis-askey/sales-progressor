-- Progressor Network profile columns on ProgressionBusiness (additive, non-destructive).
-- Mirrors the staging apply. See docs/active/progressor-network/SPEC.md.
ALTER TABLE "ProgressionBusiness" ADD COLUMN "networkListed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProgressionBusiness" ADD COLUMN "networkTagline" TEXT;
ALTER TABLE "ProgressionBusiness" ADD COLUMN "networkBlurb" TEXT;
ALTER TABLE "ProgressionBusiness" ADD COLUMN "networkLogoPath" TEXT;
ALTER TABLE "ProgressionBusiness" ADD COLUMN "networkBrandColor" TEXT;
ALTER TABLE "ProgressionBusiness" ADD COLUMN "networkRegions" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "ProgressionBusiness" ADD COLUMN "networkSpecialisms" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "ProgressionBusiness" ADD COLUMN "networkAvailability" TEXT DEFAULT 'accepting';
CREATE INDEX "ProgressionBusiness_networkListed_idx" ON "ProgressionBusiness"("networkListed");
