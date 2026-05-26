-- Adds plannedEndAt to TransactionHoldPeriod for the hub "expired holds"
-- widget. NULL = "indefinitely" (no auto-surface). Set means "I expect to
-- come back to this on date X" — the hub card surfaces files whose
-- plannedEndAt has passed and no human has yet actioned them.
--
-- Additive + nullable, safe to ship without backfill. Existing holds (no
-- planned date) stay invisible to the new card.

ALTER TABLE "TransactionHoldPeriod"
  ADD COLUMN "plannedEndAt" TIMESTAMP(3);

-- Composite index supports the hub query: find OPEN periods (endedAt IS NULL)
-- whose planned date has passed (plannedEndAt < now). Btree is fine here —
-- the cardinality on the leading column is low (only ~5% of rows are open)
-- but combined with the date scan it's a useful seek path.
CREATE INDEX "TransactionHoldPeriod_endedAt_plannedEndAt_idx"
  ON "TransactionHoldPeriod"("endedAt", "plannedEndAt");
