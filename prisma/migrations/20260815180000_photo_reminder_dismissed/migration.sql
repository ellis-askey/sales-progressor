-- Founder "dismiss forever" flag for the Command Centre → Files no-photo upkeep
-- list. Nullable; set = the file drops off the list even though it still has no
-- photo. Additive. Apply staging-first, verify, then production (Law 3).
ALTER TABLE "PropertyTransaction" ADD COLUMN "photoReminderDismissedAt" TIMESTAMP(3);
