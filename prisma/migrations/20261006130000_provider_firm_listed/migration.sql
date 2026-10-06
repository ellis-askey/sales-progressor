-- Keep a firm in the data but off the client referral picker (critique #211).
-- Existing firms stay listed. Idempotent for shared-repo safety.
ALTER TABLE "ProviderFirm" ADD COLUMN IF NOT EXISTS "listed" BOOLEAN NOT NULL DEFAULT true;
