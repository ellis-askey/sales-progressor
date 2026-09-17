-- Hub "Exchange date passed" reminder: a snooze so a file can drop off the
-- overdue list for a few days without setting a fake date. Additive, nullable.
ALTER TABLE "PropertyTransaction" ADD COLUMN "exchangeReminderSnoozedUntil" TIMESTAMP(3);
