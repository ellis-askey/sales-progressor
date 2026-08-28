-- Living-signal lifecycle: an alert is one ongoing situation, not one row per night.

ALTER TABLE "Signal" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "Signal" ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Signal" ADD COLUMN "occurrences" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Signal" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "Signal" ADD COLUMN "snoozedUntil" TIMESTAMP(3);

CREATE INDEX "Signal_detectorName_dedupeKey_idx" ON "Signal"("detectorName", "dedupeKey");
CREATE INDEX "Signal_resolvedAt_idx" ON "Signal"("resolvedAt");

-- Backfill the dedupeKey column from the value we already stored inside payload.
UPDATE "Signal" SET "dedupeKey" = payload->>'dedupeKey' WHERE "dedupeKey" IS NULL;

-- Seed lastSeenAt from the existing detection time so history reads sensibly.
UPDATE "Signal" SET "lastSeenAt" = "detectedAt";

-- One-time collapse: for every (detectorName, dedupeKey) situation, keep only the
-- most recent unacknowledged row live and resolve the older nightly duplicates.
-- This turns the accumulated wall of repeats into one signal per real situation.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "detectorName", "dedupeKey"
      ORDER BY "detectedAt" DESC
    ) AS rn,
    MIN("detectedAt") OVER (PARTITION BY "detectorName", "dedupeKey") AS first_seen,
    COUNT(*)         OVER (PARTITION BY "detectorName", "dedupeKey") AS total
  FROM "Signal"
  WHERE "resolvedAt" IS NULL AND "dedupeKey" IS NOT NULL
)
UPDATE "Signal" s
SET "resolvedAt" = CURRENT_TIMESTAMP
FROM ranked r
WHERE s.id = r.id AND r.rn > 1;

-- On the survivor row, carry the true first-seen time and the occurrence count.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "detectorName", "dedupeKey"
      ORDER BY "detectedAt" DESC
    ) AS rn,
    MIN("detectedAt") OVER (PARTITION BY "detectorName", "dedupeKey") AS first_seen,
    COUNT(*)         OVER (PARTITION BY "detectorName", "dedupeKey") AS total
  FROM "Signal"
  WHERE "dedupeKey" IS NOT NULL
)
UPDATE "Signal" s
SET "detectedAt" = r.first_seen,
    "occurrences" = r.total
FROM ranked r
WHERE s.id = r.id AND r.rn = 1 AND s."resolvedAt" IS NULL;
