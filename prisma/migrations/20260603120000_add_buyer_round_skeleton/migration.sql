-- Phase 0 of the relist feature — shadow foundation only.
--
-- Stands up the BuyerRound entity and adds a nullable buyerRoundId FK
-- to nine child tables. Additive only: no existing column is dropped,
-- renamed, or made stricter. No existing read or write path consumes
-- the new columns; populated by the companion backfill script
-- (scripts/backfill-buyer-round-phase0.ts).
--
-- Reversibility: drop the FK columns, drop BuyerRound, drop the enum.
-- Safe to roll back.

-- ─── Enum + table ─────────────────────────────────────────────────────────

CREATE TYPE "BuyerRoundStatus" AS ENUM ('active', 'withdrawn', 'superseded');

CREATE TABLE "BuyerRound" (
  "id"                          TEXT NOT NULL,
  "transactionId"               TEXT NOT NULL,
  "roundNumber"                 INTEGER NOT NULL,
  "status"                      "BuyerRoundStatus" NOT NULL DEFAULT 'active',
  "fallThroughReason"           TEXT,
  "purchasePrice"               INTEGER,
  "purchaserSolicitorFirmId"    TEXT,
  "purchaserSolicitorContactId" TEXT,
  "brokerFirmId"                TEXT,
  "brokerContactId"             TEXT,
  "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt"                  TIMESTAMP(3),

  CONSTRAINT "BuyerRound_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BuyerRound_transactionId_roundNumber_key"
  ON "BuyerRound"("transactionId", "roundNumber");
CREATE INDEX "BuyerRound_transactionId_idx" ON "BuyerRound"("transactionId");
CREATE INDEX "BuyerRound_status_idx"        ON "BuyerRound"("status");

ALTER TABLE "BuyerRound"
  ADD CONSTRAINT "BuyerRound_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── PropertyTransaction.activeBuyerRoundId ───────────────────────────────

ALTER TABLE "PropertyTransaction"
  ADD COLUMN "activeBuyerRoundId" TEXT;

CREATE UNIQUE INDEX "PropertyTransaction_activeBuyerRoundId_key"
  ON "PropertyTransaction"("activeBuyerRoundId");

ALTER TABLE "PropertyTransaction"
  ADD CONSTRAINT "PropertyTransaction_activeBuyerRoundId_fkey"
  FOREIGN KEY ("activeBuyerRoundId") REFERENCES "BuyerRound"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Nullable buyerRoundId on 9 child tables ──────────────────────────────
-- Each table gets the column + index + FK with ON DELETE SET NULL.

ALTER TABLE "Contact"             ADD COLUMN "buyerRoundId" TEXT;
ALTER TABLE "MilestoneCompletion" ADD COLUMN "buyerRoundId" TEXT;
ALTER TABLE "OutboundMessage"     ADD COLUMN "buyerRoundId" TEXT;
ALTER TABLE "PortalMessage"       ADD COLUMN "buyerRoundId" TEXT;
ALTER TABLE "TransactionDocument" ADD COLUMN "buyerRoundId" TEXT;
ALTER TABLE "ReminderLog"         ADD COLUMN "buyerRoundId" TEXT;
ALTER TABLE "ChaseTask"           ADD COLUMN "buyerRoundId" TEXT;
ALTER TABLE "PriceHistory"        ADD COLUMN "buyerRoundId" TEXT;
ALTER TABLE "ClientChaseState"    ADD COLUMN "buyerRoundId" TEXT;

CREATE INDEX "Contact_buyerRoundId_idx"             ON "Contact"("buyerRoundId");
CREATE INDEX "MilestoneCompletion_buyerRoundId_idx" ON "MilestoneCompletion"("buyerRoundId");
CREATE INDEX "OutboundMessage_buyerRoundId_idx"     ON "OutboundMessage"("buyerRoundId");
CREATE INDEX "PortalMessage_buyerRoundId_idx"       ON "PortalMessage"("buyerRoundId");
CREATE INDEX "TransactionDocument_buyerRoundId_idx" ON "TransactionDocument"("buyerRoundId");
CREATE INDEX "ReminderLog_buyerRoundId_idx"         ON "ReminderLog"("buyerRoundId");
CREATE INDEX "ChaseTask_buyerRoundId_idx"           ON "ChaseTask"("buyerRoundId");
CREATE INDEX "PriceHistory_buyerRoundId_idx"        ON "PriceHistory"("buyerRoundId");
CREATE INDEX "ClientChaseState_buyerRoundId_idx"    ON "ClientChaseState"("buyerRoundId");

ALTER TABLE "Contact"             ADD CONSTRAINT "Contact_buyerRoundId_fkey"
  FOREIGN KEY ("buyerRoundId") REFERENCES "BuyerRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MilestoneCompletion" ADD CONSTRAINT "MilestoneCompletion_buyerRoundId_fkey"
  FOREIGN KEY ("buyerRoundId") REFERENCES "BuyerRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutboundMessage"     ADD CONSTRAINT "OutboundMessage_buyerRoundId_fkey"
  FOREIGN KEY ("buyerRoundId") REFERENCES "BuyerRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PortalMessage"       ADD CONSTRAINT "PortalMessage_buyerRoundId_fkey"
  FOREIGN KEY ("buyerRoundId") REFERENCES "BuyerRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_buyerRoundId_fkey"
  FOREIGN KEY ("buyerRoundId") REFERENCES "BuyerRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReminderLog"         ADD CONSTRAINT "ReminderLog_buyerRoundId_fkey"
  FOREIGN KEY ("buyerRoundId") REFERENCES "BuyerRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChaseTask"           ADD CONSTRAINT "ChaseTask_buyerRoundId_fkey"
  FOREIGN KEY ("buyerRoundId") REFERENCES "BuyerRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PriceHistory"        ADD CONSTRAINT "PriceHistory_buyerRoundId_fkey"
  FOREIGN KEY ("buyerRoundId") REFERENCES "BuyerRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientChaseState"    ADD CONSTRAINT "ClientChaseState_buyerRoundId_fkey"
  FOREIGN KEY ("buyerRoundId") REFERENCES "BuyerRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
