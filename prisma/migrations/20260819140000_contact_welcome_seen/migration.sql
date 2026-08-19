-- Server-side gate for the first-visit portal welcome sheet.
--
-- Was localStorage-only (per browser), so the sheet re-appeared on every new
-- device and after clearing storage. Stamping a timestamp on the Contact makes
-- it show once per person, forever, across all their devices.
ALTER TABLE "Contact" ADD COLUMN "welcomeSeenAt" TIMESTAMP(3);
