-- One-off cleanup: null eventDate on MilestoneCompletion rows where the linked
-- MilestoneDefinition.eventDateRequired = false AND the completion is not a
-- claim-reconciliation row.
--
-- WHY: migrateCompleteMilestonesAction previously set
--   completedAt = eventDate = userSuppliedDate
-- on every ticked completion, regardless of whether the milestone definition
-- was event-bearing. That contaminated the eventDate column with values that
-- shouldn't be there, and the /agent/transactions/[id] Key Dates sidebar
-- consequently listed every completed milestone (memo of sale, instructed
-- solicitor, AML checks, mgmt-pack stages, etc.) instead of only the genuine
-- real-world event dates (survey, valuation, mortgage offer, exchange,
-- completion target). The migrate action is fixed in the same commit; this
-- migration only cleans pre-existing contamination so historical migrated
-- sales render correctly.
--
-- THE reconciledAtClaim GUARD IS CRITICAL. Two code paths rely on eventDate
-- being non-null for reconciled-at-claim completions:
--   - lib/services/reminders.ts:290-304 — anchors reminders on eventDate
--     when reconciledAtClaim is true. If eventDate is null, the reminder
--     is deactivated. Nulling without the guard would silently break
--     reminder scheduling for every reconciled-at-claim sale.
--   - lib/services/fees.ts:96-202 — uses the earliest non-null eventDate
--     among reconciledAtClaim completions as the 12-week prediction floor.
--     Nulling would shift floors.
-- The migrate action never sets reconciledAtClaim, so its contaminated rows
-- are safely cleanable. Reconciled-at-claim flows write eventDate via a
-- different code path and must be left intact.
--
-- Idempotent: re-running is a no-op (the WHERE clause already filters out
-- already-null rows). Safe to ship via `prisma migrate deploy`.

UPDATE "MilestoneCompletion" mc
SET "eventDate" = NULL
FROM "MilestoneDefinition" md
WHERE mc."milestoneDefinitionId" = md.id
  AND md."eventDateRequired" = false
  AND mc."eventDate" IS NOT NULL
  AND (mc."reconciledAtClaim" IS NULL OR mc."reconciledAtClaim" = false);
