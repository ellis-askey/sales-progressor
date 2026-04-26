-- MOS received reminders fire immediately on file creation (no grace period)
UPDATE "ReminderRule"
SET "graceDays" = 0
WHERE "targetMilestoneCode" IN ('VM2', 'PM2')
  AND "anchorMilestoneId" IS NULL;
