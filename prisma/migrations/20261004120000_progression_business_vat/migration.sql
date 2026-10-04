-- Audit C2b: VAT on the invoices a progression business sends its clients.
-- Additive, nullable columns — safe to apply with no backfill.
ALTER TABLE "ProgressionBusiness" ADD COLUMN "vatRegisteredAt" TIMESTAMP(3);
ALTER TABLE "ProgressionBusiness" ADD COLUMN "vatRateBps" INTEGER;
ALTER TABLE "ProgressionBusiness" ADD COLUMN "vatNumber" TEXT;
