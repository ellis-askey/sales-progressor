-- Enquiries rework follow-up — close the VM21 backfill gap on NON-active files.
--
-- The original backfill (20260815240000, step 2) only created VM21 ("all
-- enquiries satisfied", seller side) on files with status = 'active'. Files
-- that were already completed / withdrawn / on_hold past enquiries (PM20
-- complete) got no VM21 row, so PM20 and its seller-side mirror disagree in
-- history and — if such a file ever returns to active — VM21 would sit locked
-- and block the seller exchange gate with no way to tick it (VM21 is auto-only).
--
-- This makes VM21 agree with PM20 on EVERY file regardless of status, dated to
-- the same moment enquiries were satisfied so the history reads as if it had
-- always been there. Idempotent (guarded by NOT EXISTS / state <> complete).
-- Going forward the completeMilestone reflection keeps the two in sync, so this
-- is a one-time historical repair.

-- (1) Files with PM20 complete but NO VM21 row at all → insert VM21 complete,
--     completedAt copied from PM20 so the two sides share a timestamp.
INSERT INTO "MilestoneCompletion" ("id","transactionId","milestoneDefinitionId","state","completedAt","createdAt","updatedAt")
SELECT
  gen_random_uuid()::text,
  pm20c."transactionId",
  (SELECT "id" FROM "MilestoneDefinition" WHERE "code" = 'VM21'),
  'complete'::"MilestoneState",
  pm20c."completedAt",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "MilestoneCompletion" pm20c
JOIN "MilestoneDefinition" pm20d ON pm20d."id" = pm20c."milestoneDefinitionId"
WHERE pm20d."code" = 'PM20'
  AND pm20c."state" = 'complete'
  AND NOT EXISTS (
    SELECT 1 FROM "MilestoneCompletion" v
    WHERE v."transactionId" = pm20c."transactionId"
      AND v."milestoneDefinitionId" = (SELECT "id" FROM "MilestoneDefinition" WHERE "code" = 'VM21')
  );

-- (2) Files with PM20 complete and a VM21 row that ISN'T complete (locked /
--     available desync) → promote VM21 to complete, preserving any existing
--     completedAt, else copying PM20's.
UPDATE "MilestoneCompletion" v
SET "state" = 'complete',
    "completedAt" = COALESCE(v."completedAt", pm20c."completedAt"),
    "updatedAt" = CURRENT_TIMESTAMP
FROM "MilestoneCompletion" pm20c
JOIN "MilestoneDefinition" pm20d ON pm20d."id" = pm20c."milestoneDefinitionId"
WHERE v."milestoneDefinitionId" = (SELECT "id" FROM "MilestoneDefinition" WHERE "code" = 'VM21')
  AND v."state" <> 'complete'
  AND pm20d."code" = 'PM20'
  AND pm20c."state" = 'complete'
  AND pm20c."transactionId" = v."transactionId";
