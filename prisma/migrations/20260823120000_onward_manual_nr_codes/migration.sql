-- Manual not-required steps on the onward tracker (e.g. the seller skipping the
-- survey), merged with the auto-not-required set on read.
ALTER TABLE "OnwardTracker" ADD COLUMN "manualNrCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
