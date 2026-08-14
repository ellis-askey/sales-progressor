-- Enquiries rework — clean up reminders for the retired enquiry sub-steps.
-- "Chase: initial replies reviewed" style reminders chase steps that no longer
-- exist under the collapsed model, so they must not linger or keep firing.
-- Mirrors autoCompleteRemindersForMilestone: cancel pending chase tasks, then
-- resolve the active logs, then deactivate the rules so none regenerate.
-- Idempotent (re-run leaves nothing active to change).

-- 1. Cancel pending chase tasks on active reminder logs whose rule targets or
--    is anchored on a retired enquiry milestone.
UPDATE "ChaseTask" SET "status" = 'cancelled'
WHERE "status" = 'pending' AND "reminderLogId" IN (
  SELECT rl."id" FROM "ReminderLog" rl
  WHERE rl."status" = 'active' AND rl."reminderRuleId" IN (
    SELECT rr."id" FROM "ReminderRule" rr
    LEFT JOIN "MilestoneDefinition" d ON d."id" = rr."anchorMilestoneId"
    WHERE rr."targetMilestoneCode" IN ('PM15','PM16','PM17','PM18','PM19','VM11','VM12','VM13','VM14','VM15')
       OR d."code" IN ('PM15','PM16','PM17','PM18','PM19','VM11','VM12','VM13','VM14','VM15')
  )
);

-- 2. Resolve the active reminder logs themselves.
UPDATE "ReminderLog" SET "status" = 'cancelled', "statusReason" = 'Enquiries rework: step retired'
WHERE "status" = 'active' AND "reminderRuleId" IN (
  SELECT rr."id" FROM "ReminderRule" rr
  LEFT JOIN "MilestoneDefinition" d ON d."id" = rr."anchorMilestoneId"
  WHERE rr."targetMilestoneCode" IN ('PM15','PM16','PM17','PM18','PM19','VM11','VM12','VM13','VM14','VM15')
     OR d."code" IN ('PM15','PM16','PM17','PM18','PM19','VM11','VM12','VM13','VM14','VM15')
);

-- 3. Deactivate the rules so no new reminders generate for retired steps.
UPDATE "ReminderRule" SET "isActive" = false
WHERE "id" IN (
  SELECT rr."id" FROM "ReminderRule" rr
  LEFT JOIN "MilestoneDefinition" d ON d."id" = rr."anchorMilestoneId"
  WHERE rr."targetMilestoneCode" IN ('PM15','PM16','PM17','PM18','PM19','VM11','VM12','VM13','VM14','VM15')
     OR d."code" IN ('PM15','PM16','PM17','PM18','PM19','VM11','VM12','VM13','VM14','VM15')
);
