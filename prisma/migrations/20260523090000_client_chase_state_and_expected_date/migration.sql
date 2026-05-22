-- B2 of the client-chase arc (Sub-arc B foundation).
-- Two pure-additive schema changes:
--   1. New table "ClientChaseState" — per-(transaction, contact, milestone)
--      state for the chase pipeline. No callers in B2 (table is unused at
--      apply time); B7 reads/writes it.
--   2. New nullable column "MilestoneCompletion"."expectedDate" — client-
--      supplied speculation about when a milestone will happen. Distinct
--      from eventDate (real date on completion) and completedAt (system
--      clock when marked complete). Populated by the B5 confirm-page's
--      "Set a date" control.
--
-- Pre-validated (scripts/verify-b2-precheck.ts) against staging:
--   - ClientChaseState table did NOT exist
--   - MilestoneCompletion.expectedDate column did NOT exist
-- Production pre-check via Supabase SQL editor delivered in the B2
-- evidence post.

-- 1. ClientChaseState table
CREATE TABLE "ClientChaseState" (
    "id"             TEXT NOT NULL,
    "transactionId"  TEXT NOT NULL,
    "contactId"      TEXT NOT NULL,
    "milestoneCode"  TEXT NOT NULL,
    "chaseCount"     INTEGER NOT NULL DEFAULT 0,
    "firstChasedAt"  TIMESTAMP(3),
    "lastChasedAt"   TIMESTAMP(3),
    "lastEngagedAt"  TIMESTAMP(3),
    "status"         TEXT NOT NULL DEFAULT 'active',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientChaseState_pkey" PRIMARY KEY ("id")
);

-- Unique per (transaction, contact, milestone) — one chase-state row per
-- distinct chase target. Prevents duplicates if B7 re-evaluates the same
-- file in a single run.
CREATE UNIQUE INDEX "ClientChaseState_transactionId_contactId_milestoneCode_key"
  ON "ClientChaseState"("transactionId", "contactId", "milestoneCode");

-- Cron-pipeline indexes
CREATE INDEX "ClientChaseState_status_lastChasedAt_idx"
  ON "ClientChaseState"("status", "lastChasedAt");
CREATE INDEX "ClientChaseState_contactId_status_idx"
  ON "ClientChaseState"("contactId", "status");

-- FKs with ON DELETE CASCADE: when a transaction or contact is deleted,
-- any chase state for it goes too. No orphans.
ALTER TABLE "ClientChaseState"
  ADD CONSTRAINT "ClientChaseState_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientChaseState"
  ADD CONSTRAINT "ClientChaseState_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. MilestoneCompletion.expectedDate column
ALTER TABLE "MilestoneCompletion" ADD COLUMN "expectedDate" TIMESTAMP(3);
