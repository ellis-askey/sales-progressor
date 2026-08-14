-- Enquiries rework follow-up: date the VM21 seller-mirror rows.
--
-- The active-file backfill (20260815240000, step 2) inserted VM21 ("all
-- enquiries satisfied", seller side) as 'complete' but omitted completedAt from
-- its column list, so those rows carry a NULL date. The activity feed then
-- falls back to "now" for an undated row, making an old historical tick read as
-- "just now" (and, with no author, "A colleague"). The later non-active backfill
-- (20260815270000) copied PM20's date correctly; this closes the same gap on the
-- active files it skipped.
--
-- Copy the date from the paired PM20 (the buyer's real tick) so the seller mirror
-- shares the exact moment enquiries were satisfied. Idempotent (WHERE completedAt
-- IS NULL). One-time historical repair; the completeMilestone reflection dates new
-- VM21 rows correctly going forward.
UPDATE "MilestoneCompletion" v
SET "completedAt" = pm20c."completedAt",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "MilestoneCompletion" pm20c
JOIN "MilestoneDefinition" pm20d ON pm20d."id" = pm20c."milestoneDefinitionId"
WHERE v."milestoneDefinitionId" = (SELECT "id" FROM "MilestoneDefinition" WHERE "code" = 'VM21')
  AND v."state" = 'complete'
  AND v."completedAt" IS NULL
  AND pm20d."code" = 'PM20'
  AND pm20c."state" = 'complete'
  AND pm20c."transactionId" = v."transactionId";
