-- Append-only milestone availability history (Data Optionality capture-now, PR3).
-- Records the genuinely-irrecoverable mid-life availability transitions
-- (prereq unlock, exchange-gate open/relock, reversal). Additive + capture-only:
-- no product surface reads it. No FK (append-log precedent, cf. Event).
--
-- Authored with IF NOT EXISTS so it is safe to re-run: applied to staging via the
-- pooled connection at authoring time (the direct migrate endpoint is unreachable
-- from the dev machine), then Vercel's `migrate deploy` records + no-ops it on
-- staging and applies it cleanly on production.

CREATE TABLE IF NOT EXISTS "MilestoneAvailabilityEvent" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "milestoneDefinitionId" TEXT NOT NULL,
    "milestoneCode" TEXT NOT NULL,
    "buyerRoundId" TEXT,
    "side" "MilestoneSide",
    "transition" TEXT NOT NULL,
    "cause" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MilestoneAvailabilityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MilestoneAvailabilityEvent_transactionId_occurredAt_idx"
  ON "MilestoneAvailabilityEvent"("transactionId", "occurredAt");
CREATE INDEX IF NOT EXISTS "MilestoneAvailabilityEvent_transactionId_milestoneCode_idx"
  ON "MilestoneAvailabilityEvent"("transactionId", "milestoneCode");
