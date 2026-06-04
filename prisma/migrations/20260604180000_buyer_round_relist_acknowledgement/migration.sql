-- Phase 1 commit 8b — hub card for unacknowledged relisted outsourced files.
--
-- Two additive nullable columns on BuyerRound. Persisting acknowledgement
-- on the round (not on the tx) means each relist creates a fresh
-- unacknowledged state — a second relist (round 3) re-raises the card
-- without any explicit reset logic.
--
-- The query that drives the hub card is:
--   SELECT * FROM "BuyerRound" br
--   JOIN   "PropertyTransaction" pt ON pt."activeBuyerRoundId" = br.id
--   WHERE  pt."serviceType" = 'outsourced'
--     AND  br."roundNumber" > 1
--     AND  br."relistAcknowledgedAt" IS NULL;
--
-- Index on (relistAcknowledgedAt) so the hub query stays cheap as
-- BuyerRound grows. Partial index on the NULL state since acknowledged
-- rows dominate over time.

ALTER TABLE "BuyerRound"
  ADD COLUMN "relistAcknowledgedAt"   TIMESTAMP(3),
  ADD COLUMN "relistAcknowledgedById" TEXT;

ALTER TABLE "BuyerRound"
  ADD CONSTRAINT "BuyerRound_relistAcknowledgedById_fkey"
  FOREIGN KEY ("relistAcknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BuyerRound_relistAck_pending_idx"
  ON "BuyerRound" ("relistAcknowledgedAt")
  WHERE "relistAcknowledgedAt" IS NULL;
