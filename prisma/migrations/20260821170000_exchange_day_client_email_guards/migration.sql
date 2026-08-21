-- Per-slot send stamps for the exchange-day CLIENT emails (09:00 informational
-- + 11:00 authority nudge). "Sent this activation" = stamp >=
-- exchangeDayStartedAt, so re-activating the next day resets them with no
-- backfill. Mirrors the solicitor slot guards.
ALTER TABLE "PropertyTransaction" ADD COLUMN "exchangeDayClientMorningEmailAt" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "exchangeDayClientAuthorityEmailAt" TIMESTAMP(3);
