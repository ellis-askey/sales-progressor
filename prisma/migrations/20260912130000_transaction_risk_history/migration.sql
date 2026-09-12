-- Append-only, change-only transaction risk history (Data Optionality capture-now, PR5).
-- A nightly sweep appends a row only when risk level or the triggered-factor set
-- changes. Additive + capture-only: no product surface reads it, no risk field is
-- added to PropertyTransaction. No FK (append-log precedent).
--
-- Authored with IF NOT EXISTS so it is safe to re-run: applied to staging via the
-- pooled connection at authoring time (the direct migrate endpoint is unreachable
-- from the dev machine), then Vercel's `migrate deploy` records + no-ops it on
-- staging and applies it cleanly on production.

CREATE TABLE IF NOT EXISTS "TransactionRiskHistory" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "fromLevel" TEXT,
    "toLevel" TEXT NOT NULL,
    "fromScore" INTEGER,
    "toScore" INTEGER NOT NULL,
    "factors" JSONB NOT NULL,
    "inputs" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nightly',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransactionRiskHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TransactionRiskHistory_transactionId_occurredAt_idx"
  ON "TransactionRiskHistory"("transactionId", "occurredAt");
