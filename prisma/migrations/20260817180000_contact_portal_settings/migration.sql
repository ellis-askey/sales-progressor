-- Client portal appearance + accessibility settings (Batch 4). One JSON blob
-- per contact; null = all defaults. "Hide money" is per-device (localStorage),
-- not stored here.
ALTER TABLE "Contact" ADD COLUMN "portalSettings" JSONB;
