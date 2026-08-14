-- Enquiries rework tidy: retired granular enquiry steps left in a live state.
--
-- The retire migration zeroed the weight + exchange-gating of the ten retired
-- steps (PM15-19, VM11-15) but left their per-file completion rows in whatever
-- state they were in — some sit "available" or "locked" on files that were
-- mid-loop at migration time. They're hidden from every screen and carry zero
-- weight, so this changes nothing a user sees, but leaving them "available"
-- reads as unfinished work in a raw data check.
--
-- Mark the never-completed ones "not required" so the record is honest.
-- Completed retired rows are left untouched (they are real history of a step
-- that genuinely happened). Idempotent.
UPDATE "MilestoneCompletion" mc
SET "state" = 'not_required', "updatedAt" = CURRENT_TIMESTAMP
FROM "MilestoneDefinition" d
WHERE mc."milestoneDefinitionId" = d."id"
  AND d."code" IN ('PM15','PM16','PM17','PM18','PM19','VM11','VM12','VM13','VM14','VM15')
  AND mc."state" IN ('available','locked');
