-- Append-only exchange-prediction history (Data Optionality capture-now, PR4).
-- Records, change-only, the trajectory of expectedExchangeDate / overridePredictedDate.
-- Additive + capture-only: no product surface reads it. No FK (append-log precedent).
--
-- Authored with IF NOT EXISTS so it is safe to re-run: applied to staging via the
-- pooled connection at authoring time (the direct migrate endpoint is unreachable
-- from the dev machine), then Vercel's `migrate deploy` records + no-ops it on
-- staging and applies it cleanly on production.

CREATE TABLE IF NOT EXISTS "ExchangePredictionHistory" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "buyerRoundId" TEXT,
    "field" TEXT NOT NULL,
    "previousDate" TIMESTAMP(3),
    "predictedDate" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "changedByUserId" TEXT,
    "inputsSnapshot" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExchangePredictionHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExchangePredictionHistory_transactionId_occurredAt_idx"
  ON "ExchangePredictionHistory"("transactionId", "occurredAt");
