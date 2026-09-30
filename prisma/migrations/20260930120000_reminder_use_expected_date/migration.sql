-- Critique #23: "searches due back" re-anchoring.
--
-- A chase rule with useExpectedDate re-anchors on the TARGET milestone's
-- MilestoneCompletion.expectedDate when one is set, instead of the fixed
-- "predecessor + graceDays". This lets a solicitor or agent record when
-- searches are expected back so the system doesn't chase before they're due.
--
-- Default false → no behaviour change for any existing rule. The UPDATE flips
-- the PM13 (search results received) chase rule on. No expectedDate set on a
-- file → the rule falls back to today's predecessor anchor, so files without a
-- due-back date are unaffected.

ALTER TABLE "ReminderRule"
  ADD COLUMN "useExpectedDate" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ReminderRule"
   SET "useExpectedDate" = true
 WHERE "targetMilestoneCode" = 'PM13';
