-- Director-set "what clients see on the portal" display defaults, plus a
-- per-file override for key dates.
--
-- Agency flags are agency-wide defaults (Account → Client portal), all
-- defaulting true = today's behaviour. Only key-dates is overridable per file
-- via PropertyTransaction.portalKeyDatesOverride (null = follow agency default,
-- true = force show, false = force hide). SetAt/SetById form an audit trail:
--   SELECT id, "propertyAddress" FROM "PropertyTransaction"
--   WHERE "portalKeyDatesOverride" IS NOT NULL;

ALTER TABLE "Agency"
  ADD COLUMN "showPortalKeyDates"        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showPortalCosts"           BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showPortalProgressPercent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showPortalWelcomeSheet"    BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "PropertyTransaction"
  ADD COLUMN "portalKeyDatesOverride"        BOOLEAN,
  ADD COLUMN "portalKeyDatesOverrideSetAt"   TIMESTAMP(3),
  ADD COLUMN "portalKeyDatesOverrideSetById" TEXT;
