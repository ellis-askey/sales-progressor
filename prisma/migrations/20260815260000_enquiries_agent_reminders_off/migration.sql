-- Enquiries rework: the enquiries loop is chased by the tracker-driven chase
-- (lib/enquiries/chase.ts), not the agent reminder system. Deactivate the
-- agent-reminder rules that TARGET the surviving enquiries steps (PM14 raised,
-- VM10 received) so no ReminderLog / ChaseTask is generated for them, and cancel
-- any that are already live. (PM20's rule was already deactivated in
-- 20260815250000. PM21 / VM16 are POST-enquiries steps that merely anchor on
-- PM20 — they stay active.) Idempotent.

-- Cancel pending chase tasks on active logs for these rules.
UPDATE "ChaseTask" SET "status" = 'cancelled'
WHERE "status" = 'pending' AND "reminderLogId" IN (
  SELECT rl."id" FROM "ReminderLog" rl
  WHERE rl."status" = 'active' AND rl."reminderRuleId" IN (
    SELECT "id" FROM "ReminderRule" WHERE "targetMilestoneCode" IN ('PM14','VM10')
  )
);

-- Resolve the active logs.
UPDATE "ReminderLog" SET "status" = 'cancelled', "statusReason" = 'Enquiries rework: enquiries chased by the tracker'
WHERE "status" = 'active' AND "reminderRuleId" IN (
  SELECT "id" FROM "ReminderRule" WHERE "targetMilestoneCode" IN ('PM14','VM10')
);

-- Deactivate the rules so nothing regenerates.
UPDATE "ReminderRule" SET "isActive" = false WHERE "targetMilestoneCode" IN ('PM14','VM10');
