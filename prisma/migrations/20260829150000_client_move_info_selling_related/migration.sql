-- Related-sale signal (2026-08-29). A buyer who is also selling a property to
-- fund their purchase ("related sale", the mirror of a seller's buyingOnward).
-- Additive + nullable, so nothing changes for existing rows.
ALTER TABLE "ClientMoveInfo" ADD COLUMN "sellingRelated" BOOLEAN;
