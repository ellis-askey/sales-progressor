-- Per-slot send stamps for the exchange-day solicitor emails (08:45 / 12:30 /
-- 15:30 UK). "Sent this activation" = stamp >= exchangeDayStartedAt, so
-- re-activating the next day resets them with no backfill.
ALTER TABLE "PropertyTransaction" ADD COLUMN "exchangeDayMorningEmailAt" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "exchangeDayMiddayEmailAt" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "exchangeDayAfternoonEmailAt" TIMESTAMP(3);
