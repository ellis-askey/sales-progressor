-- Enquiries rework follow-up: "received implies raised".
--
-- Some files had "enquiries received" (seller side, VM10) confirmed while
-- "enquiries raised" (buyer side, PM14) was never ticked. Because "all
-- enquiries satisfied" (PM20) sits behind "raised", those files leave PM20
-- locked — so the team can't mark satisfied when the loop closes. You cannot
-- receive enquiries that were never raised, so mark "raised" complete wherever
-- "received" is, dated to match, and unlock "satisfied".
--
-- Idempotent. Targets existing rows only (every file gets a PM14 row at
-- initialisation, so no insert is needed). Additive — only sets a tick that
-- should already have been there; nothing is removed.

-- (1) "raised" (PM14) -> complete where "received" (VM10) is complete but
--     "raised" isn't. completedAt copied from "received" (raised necessarily
--     happened at or before receipt).
UPDATE "MilestoneCompletion" pm14
SET "state" = 'complete',
    "completedAt" = COALESCE(pm14."completedAt", vm10."completedAt", CURRENT_TIMESTAMP),
    "updatedAt" = CURRENT_TIMESTAMP
FROM "MilestoneCompletion" vm10
JOIN "MilestoneDefinition" vm10d ON vm10d."id" = vm10."milestoneDefinitionId"
WHERE pm14."milestoneDefinitionId" = (SELECT "id" FROM "MilestoneDefinition" WHERE "code" = 'PM14')
  AND pm14."state" <> 'complete'
  AND vm10d."code" = 'VM10'
  AND vm10."state" = 'complete'
  AND vm10."transactionId" = pm14."transactionId";

-- (2) "satisfied" (PM20) -> available where "raised" is now complete but PM20 is
--     still locked (mirrors the original migration's unlock step; PM20's only
--     prerequisite is PM14, so a complete PM14 always means PM20 should be
--     available, never locked).
UPDATE "MilestoneCompletion" mc
SET "state" = 'available', "updatedAt" = CURRENT_TIMESTAMP
FROM "MilestoneDefinition" d
WHERE mc."milestoneDefinitionId" = d."id"
  AND d."code" = 'PM20'
  AND mc."state" = 'locked'
  AND mc."transactionId" IN (
    SELECT c."transactionId" FROM "MilestoneCompletion" c
    JOIN "MilestoneDefinition" dd ON dd."id" = c."milestoneDefinitionId"
    WHERE dd."code" = 'PM14' AND c."state" = 'complete'
  );
