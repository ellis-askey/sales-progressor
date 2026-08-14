-- Enquiries rework, Stage 1.10 — move existing files onto the new shape.
-- See docs/active/enquiries-stage-rework-SPEC.md. Idempotent (safe to re-run):
-- every step is guarded by NOT EXISTS / state conditions.

-- 1. Unlock "enquiries satisfied" (PM20) on files where enquiries were raised
--    (PM14 complete) but PM20 is still locked behind the now-retired chain, so
--    the progressor can mark it in one click.
UPDATE "MilestoneCompletion" mc
SET "state" = 'available'
FROM "MilestoneDefinition" d
WHERE mc."milestoneDefinitionId" = d."id"
  AND d."code" = 'PM20'
  AND mc."state" NOT IN ('complete', 'available', 'not_required')
  AND mc."transactionId" IN (
    SELECT c."transactionId" FROM "MilestoneCompletion" c
    JOIN "MilestoneDefinition" dd ON dd."id" = c."milestoneDefinitionId"
    WHERE dd."code" = 'PM14' AND c."state" = 'complete'
  );

-- 2. Backfill the seller "All enquiries satisfied" (VM21) completion on every
--    active file that has none. State mirrors the buyer's outcome: complete if
--    enquiries are satisfied (PM20 complete), available once the seller has
--    received enquiries (VM10 complete), else locked.
INSERT INTO "MilestoneCompletion" ("id","transactionId","milestoneDefinitionId","state","createdAt","updatedAt")
SELECT
  gen_random_uuid()::text,
  t."id",
  (SELECT "id" FROM "MilestoneDefinition" WHERE "code" = 'VM21'),
  CASE
    WHEN EXISTS (SELECT 1 FROM "MilestoneCompletion" c JOIN "MilestoneDefinition" d ON d."id" = c."milestoneDefinitionId" WHERE c."transactionId" = t."id" AND d."code" = 'PM20' AND c."state" = 'complete') THEN 'complete'::"MilestoneState"
    WHEN EXISTS (SELECT 1 FROM "MilestoneCompletion" c JOIN "MilestoneDefinition" d ON d."id" = c."milestoneDefinitionId" WHERE c."transactionId" = t."id" AND d."code" = 'VM10' AND c."state" = 'complete') THEN 'available'::"MilestoneState"
    ELSE 'locked'::"MilestoneState"
  END,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "PropertyTransaction" t
WHERE t."status" = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM "MilestoneCompletion" c
    WHERE c."transactionId" = t."id"
      AND c."milestoneDefinitionId" = (SELECT "id" FROM "MilestoneDefinition" WHERE "code" = 'VM21')
  );

-- 3. Open an enquiries tracker for every active file whose loop is currently
--    open (raised or received, not yet satisfied) and has no tracker. openedAt
--    = now so the chase clock starts fresh and nothing escalates on day one.
INSERT INTO "EnquiryTracker" ("id","transactionId","currentlyWith","openedAt","chaseCount","createdAt","updatedAt")
SELECT
  gen_random_uuid()::text, t."id", 'seller_solicitor'::"EnquiryCourt", CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "PropertyTransaction" t
WHERE t."status" = 'active'
  AND NOT EXISTS (SELECT 1 FROM "EnquiryTracker" e WHERE e."transactionId" = t."id")
  AND EXISTS (
    SELECT 1 FROM "MilestoneCompletion" c JOIN "MilestoneDefinition" d ON d."id" = c."milestoneDefinitionId"
    WHERE c."transactionId" = t."id" AND d."code" IN ('PM14','VM10') AND c."state" = 'complete'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "MilestoneCompletion" c JOIN "MilestoneDefinition" d ON d."id" = c."milestoneDefinitionId"
    WHERE c."transactionId" = t."id" AND d."code" = 'PM20' AND c."state" = 'complete'
  );

-- 4. Every file now has a VM21 row, so it's safe to make it gate exchange (the
--    seller can't reach "ready to exchange" until enquiries are satisfied).
UPDATE "MilestoneDefinition" SET "blocksExchange" = true WHERE "code" = 'VM21';
