-- Client-portal display defaults on the progression business. The business-wide
-- default a new client agency is seeded with, and that the owner's Client-portal
-- settings page writes through to all current client agencies. Mirrors the four
-- Agency.showPortal* flags. All default true (today's behaviour).
ALTER TABLE "ProgressionBusiness"
  ADD COLUMN "showPortalKeyDates" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showPortalCosts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showPortalProgressPercent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showPortalWelcomeSheet" BOOLEAN NOT NULL DEFAULT true;
