-- Per-side WhatsApp group links (2026-11-10). Seller and buyer get SEPARATE
-- groups so the two sides never share a chat. Backfill the seller link from the
-- old single link (the drawer always opened seller-first, so an existing link
-- was seller-intended). The old column is kept, not dropped, to avoid data loss.
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "whatsappSellerGroupUrl" TEXT;
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "whatsappBuyerGroupUrl" TEXT;

UPDATE "PropertyTransaction"
  SET "whatsappSellerGroupUrl" = "whatsappGroupInviteUrl"
  WHERE "whatsappGroupInviteUrl" IS NOT NULL
    AND "whatsappSellerGroupUrl" IS NULL;
