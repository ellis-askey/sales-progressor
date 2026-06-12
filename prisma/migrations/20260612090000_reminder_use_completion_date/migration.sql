-- Post-exchange reminders (VM20 "Sale completed", PM27 "Purchase completed")
-- now anchor on PropertyTransaction.completionDate instead of the exchange
-- milestone's completedAt + 1 day. Pre-fix behaviour fired the reminder the
-- morning after exchange regardless of the agreed completion date — for the
-- Akeman Residential pair on 2026-06-11 (completion 2026-06-16) the chase
-- showed "Due today" 4 days early. See PR notes / plan file.
--
-- Default false → no behaviour change for any existing rule. The UPDATE
-- below flips the two completion-anchored rules and drops their graceDays
-- to 0 so the reminder fires on completion day itself.

ALTER TABLE "ReminderRule"
  ADD COLUMN "useCompletionDate" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ReminderRule"
   SET "useCompletionDate" = true,
       "graceDays"         = 0
 WHERE "targetMilestoneCode" IN ('VM20', 'PM27');
