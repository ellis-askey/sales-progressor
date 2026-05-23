-- Audit + duration tracking for periods where a transaction is on hold.
-- One row per hold period. startedAt = when status flipped to on_hold,
-- endedAt = when it flipped back to active (null while currently on hold).
--
-- Consumed by lib/services/hold-duration.ts:activeElapsedMs() so that
-- time-based signals (on_track, weeks elapsed, predicted exchange,
-- file-time tracker) freeze while paused, and so future platform median
-- calculations can subtract hold time.
--
-- Backfill (best-effort): every transaction currently sitting at
-- status='on_hold' gets one open hold period with startedAt = updatedAt.
-- We don't have a status-change audit log, so updatedAt is the closest
-- approximation. Pre-launch (~5 test users) so this is acceptable. New
-- holds going forward use the real now() at the moment of the action.

CREATE TABLE "TransactionHoldPeriod" (
    "id"            TEXT         NOT NULL,
    "transactionId" TEXT         NOT NULL,
    "startedAt"     TIMESTAMP(3) NOT NULL,
    "startedById"   TEXT         NOT NULL,
    "endedAt"       TIMESTAMP(3),
    "endedById"     TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionHoldPeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransactionHoldPeriod_transactionId_endedAt_idx"
  ON "TransactionHoldPeriod"("transactionId", "endedAt");

ALTER TABLE "TransactionHoldPeriod"
  ADD CONSTRAINT "TransactionHoldPeriod_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransactionHoldPeriod"
  ADD CONSTRAINT "TransactionHoldPeriod_startedById_fkey"
  FOREIGN KEY ("startedById") REFERENCES "User"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "TransactionHoldPeriod"
  ADD CONSTRAINT "TransactionHoldPeriod_endedById_fkey"
  FOREIGN KEY ("endedById") REFERENCES "User"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- Backfill: for every transaction currently on hold, insert an OPEN hold
-- period (endedAt NULL) attributed to the file's assignedUserId (preferred)
-- or agentUserId (fallback). If neither exists, attribute to the agency's
-- oldest director user. If even that fails, skip the row — the missing
-- backfill is non-fatal (UI will treat it as "no hold periods recorded"
-- which means it starts ticking accumulator from the next on-hold event).

INSERT INTO "TransactionHoldPeriod" ("id", "transactionId", "startedAt", "startedById", "endedAt", "createdAt")
SELECT
  -- cuid-like fallback using gen_random_uuid() prefixed for visibility
  'h_' || REPLACE(gen_random_uuid()::text, '-', ''),
  tx."id",
  tx."updatedAt",
  COALESCE(
    tx."assignedUserId",
    tx."agentUserId",
    (SELECT u."id" FROM "User" u WHERE u."agencyId" = tx."agencyId" AND u."role" = 'director' ORDER BY u."createdAt" ASC LIMIT 1)
  ),
  NULL,
  CURRENT_TIMESTAMP
FROM "PropertyTransaction" tx
WHERE tx."status" = 'on_hold'
  AND COALESCE(
    tx."assignedUserId",
    tx."agentUserId",
    (SELECT u."id" FROM "User" u WHERE u."agencyId" = tx."agencyId" AND u."role" = 'director' ORDER BY u."createdAt" ASC LIMIT 1)
  ) IS NOT NULL;
