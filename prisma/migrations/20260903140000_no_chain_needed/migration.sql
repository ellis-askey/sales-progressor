-- No-chain confirmation (2026-09-03). Additive: two nullable columns on
-- PropertyTransaction recording that the team confirmed a live sale needs no
-- chain, so the /agent/chains "Needs chain setup" queue can reach zero.
-- noChainNeededById is the acting user's id (no relation; resolve name at read).
-- No backfill, no change to existing rows.

ALTER TABLE "PropertyTransaction" ADD COLUMN "noChainNeededAt" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "noChainNeededById" TEXT;
