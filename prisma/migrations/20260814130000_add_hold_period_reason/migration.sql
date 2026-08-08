-- Add optional free-text reason to hold periods. Captured at hold time,
-- surfaced on the hub's holds-needing-attention card.
ALTER TABLE "TransactionHoldPeriod" ADD COLUMN "reason" TEXT;
