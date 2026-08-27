-- Adds PropertyTransaction.outsourcedAt: when a file became outsourced (needing
-- an SP progressor). Drives the SP unassigned-file waiting clock / SLA flag.
ALTER TABLE "PropertyTransaction" ADD COLUMN "outsourcedAt" TIMESTAMP(3);

-- Backfill existing outsourced files to their creation date (they were born
-- outsourced, so createdAt is the correct "since when" anchor). Self-managed
-- files stay null.
UPDATE "PropertyTransaction"
SET "outsourcedAt" = "createdAt"
WHERE "serviceType" = 'outsourced' AND "outsourcedAt" IS NULL;
