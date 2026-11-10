-- Per-side free-text call notes the progressor types while running each intro
-- call (2026-11-10). Nullable scratchpad text + a last-edited timestamp per side,
-- sat alongside the existing introCall*CompletedAt stamps on PropertyTransaction.
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "introCallVendorNotes" TEXT;
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "introCallVendorNotesAt" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "introCallPurchaserNotes" TEXT;
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "introCallPurchaserNotesAt" TIMESTAMP(3);
