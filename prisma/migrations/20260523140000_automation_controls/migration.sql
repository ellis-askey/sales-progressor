-- Automation controls — Settings + per-file pause/hold
--
-- Adds:
--   Agency.chaseEmailsEnabled (master toggle for chase emails)
--   PropertyTransaction.clientEmailsPaused (per-file pause toggle)
--   PropertyTransaction.pausedAt + pausedById (audit columns for the pause)
--   PropertyTransaction.chaseRuleSnapshot (per-transaction snapshot of chase
--     rule values at creation time — Settings edits apply to new files only;
--     in-flight files keep their original schedule)
--
-- Backfill: every existing PropertyTransaction gets a chaseRuleSnapshot
-- populated from the current ReminderRule values, so the cron switching to
-- snapshot-reads doesn't reschedule any active file.

-- ─── Agency: master toggle ──────────────────────────────────────────────
ALTER TABLE "Agency"
  ADD COLUMN "chaseEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- ─── PropertyTransaction: pause toggle + audit + snapshot ──────────────
ALTER TABLE "PropertyTransaction"
  ADD COLUMN "clientEmailsPaused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pausedAt"           TIMESTAMP(3),
  ADD COLUMN "pausedById"         TEXT,
  ADD COLUMN "chaseRuleSnapshot"  JSONB;

ALTER TABLE "PropertyTransaction"
  ADD CONSTRAINT "PropertyTransaction_pausedById_fkey"
    FOREIGN KEY ("pausedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Backfill chaseRuleSnapshot for every existing transaction ─────────
-- Builds a JSON object keyed by milestone code → rule values. Reads from
-- the current (live) ReminderRule rows. Only includes rules whose target
-- has a code (skips the agency-default rule with NULL targetMilestoneCode).
-- Pre-existing transactions get a snapshot that mirrors today's live rules,
-- so the cron's switch to snapshot-reads is a no-op for them. Settings
-- edits after this migration update ReminderRule (which seeds new files'
-- snapshots) but don't touch existing snapshots.
UPDATE "PropertyTransaction" tx
SET "chaseRuleSnapshot" = (
  SELECT jsonb_object_agg(
    rr."targetMilestoneCode",
    jsonb_build_object(
      'graceDays',             rr."graceDays",
      'repeatEveryDays',       rr."repeatEveryDays",
      'useEventDate',          rr."useEventDate",
      'requiresExchangeReady', rr."requiresExchangeReady",
      'anchorMilestoneCode',   anchor."code"
    )
  )
  FROM "ReminderRule" rr
  LEFT JOIN "MilestoneDefinition" anchor ON anchor."id" = rr."anchorMilestoneId"
  WHERE rr."isActive" = true
    AND rr."targetMilestoneCode" IS NOT NULL
)
WHERE tx."chaseRuleSnapshot" IS NULL;
