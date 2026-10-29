-- Onward/related → check-in bridge: carry the confirmer's role (for the side-
-- tinted avatar on a client-confirmed line) and the bridged check-in beat key
-- (so an undo on that side can remove the exact line). Both nullable + additive.
ALTER TABLE "ChainLinkEntry" ADD COLUMN IF NOT EXISTS "authorRole" TEXT;
ALTER TABLE "ChainLinkEntry" ADD COLUMN IF NOT EXISTS "checkInStepKey" TEXT;
