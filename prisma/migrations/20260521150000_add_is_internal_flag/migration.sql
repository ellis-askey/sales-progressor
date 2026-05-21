-- Add isInternal flag to Agency and User so detectors and the metric rollup can
-- exclude Ellis's internal accounts and the Zero Progressor test agency from
-- Founder Brief / Weekly Review aggregates.

ALTER TABLE "Agency" ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User"   ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: internal staff roles are always internal regardless of agency.
UPDATE "User"
   SET "isInternal" = true
 WHERE role IN ('admin', 'sales_progressor', 'superadmin');

-- Backfill: the Zero Progressor agency is an internal test agency.
UPDATE "Agency"
   SET "isInternal" = true
 WHERE name = 'Zero Progressor';

-- Backfill: any user belonging to an internal agency is also internal.
UPDATE "User"
   SET "isInternal" = true
 WHERE "agencyId" IN (SELECT id FROM "Agency" WHERE "isInternal" = true);
