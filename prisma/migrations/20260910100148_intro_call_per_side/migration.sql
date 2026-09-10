-- Per-side intro completion: buyer and seller intros complete independently.
ALTER TABLE "PropertyTransaction" ADD COLUMN "introCallVendorCompletedAt" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "introCallVendorCompletedById" TEXT;
ALTER TABLE "PropertyTransaction" ADD COLUMN "introCallPurchaserCompletedAt" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "introCallPurchaserCompletedById" TEXT;

-- Backfill: an existing (single) completed intro counts as done for both sides,
-- so no file's "Start intro call" opener reappears after the migration.
UPDATE "PropertyTransaction"
SET "introCallVendorCompletedAt" = "introCallCompletedAt",
    "introCallVendorCompletedById" = "introCallCompletedById",
    "introCallPurchaserCompletedAt" = "introCallCompletedAt",
    "introCallPurchaserCompletedById" = "introCallCompletedById"
WHERE "introCallCompletedAt" IS NOT NULL;
