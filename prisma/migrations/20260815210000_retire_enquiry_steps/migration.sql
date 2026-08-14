-- Enquiries rework, Stage 1.2 — collapse the milestone set.
-- See docs/active/enquiries-stage-rework-SPEC.md.
--
-- Retire the per-round enquiry sub-steps (buyer PM15-19, seller VM11-15):
-- drop them from the exchange gate and zero their weight. Their definition
-- rows are LEFT in place so existing files' completion rows don't orphan;
-- a later stage hard-deletes them after in-flight files are migrated off.
UPDATE "MilestoneDefinition"
SET "blocksExchange" = false, "weight" = 0
WHERE "code" IN ('PM15','PM16','PM17','PM18','PM19','VM11','VM12','VM13','VM14','VM15');

-- "All enquiries satisfied" now depends directly on "raised" — no phantom
-- intermediate chain — and carries the buyer enquiries cluster's weight.
UPDATE "MilestoneDefinition" SET "predecessorCode" = 'PM14', "weight" = 14 WHERE "code" = 'PM20';
UPDATE "MilestoneDefinition" SET "weight" = 6 WHERE "code" = 'PM14';

-- Seller "received / underway" carries part of the seller enquiries weight.
UPDATE "MilestoneDefinition" SET "weight" = 8 WHERE "code" = 'VM10';

-- New seller-side "enquiries satisfied" mirror (ticks the same real event as
-- PM20). blocksExchange stays FALSE for now — it flips to TRUE in the
-- in-flight-migration stage, once every existing seller file has a completion
-- row for it, so no file's exchange gate is stranded by a missing row.
INSERT INTO "MilestoneDefinition"
  ("id","code","name","side","orderIndex","blocksExchange","eventDateRequired","predecessorCode","canBeMarkedNr","summaryTemplate","weight","createdAt")
VALUES
  ('cmenqsellersatisfied000001','VM21','Seller''s solicitor has confirmed all enquiries are satisfied','vendor'::"MilestoneSide",15,false,false,'VM10','never'::"CanBeMarkedNr",'',16,CURRENT_TIMESTAMP);
