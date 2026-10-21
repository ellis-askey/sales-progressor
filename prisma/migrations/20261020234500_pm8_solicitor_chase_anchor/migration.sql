-- PM8 "searches ordered" now UNLOCKS on money on account alone (PM4) — see
-- lib/milestone-prerequisites.ts, founder decision 2026-10-20. Chasing must
-- NOT move with it (option B): the expectation is still that searches follow
-- the contract pack, so the solicitor chase keeps its clock on PM7. The rule
-- previously relied on the direct-prerequisite fallback (anchorMilestoneCode
-- NULL), which would now resolve to PM4 — pin it explicitly to PM7 instead.
-- Guarded so a hand-tuned anchor set via Settings -> Automation is never
-- clobbered. Data-only; additive; no schema change.
UPDATE "SolicitorReminderRule"
SET "anchorMilestoneCode" = 'PM7', "updatedAt" = CURRENT_TIMESTAMP
WHERE "milestoneCode" = 'PM8' AND "anchorMilestoneCode" IS NULL;
