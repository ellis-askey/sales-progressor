-- Enquiries rework — ease the seller "satisfied" weight.
-- VM21 at 16 was the single spikiest step; the seller step only REFLECTS the
-- buyer's decision, so it shouldn't outweigh the buyer's own PM20 (14). Bring
-- VM21 to 12 (seller enquiries cluster now 20, matching the buyer) and spread
-- the freed 4 across lighter always-present seller steps. Vendor sum stays 100.
UPDATE "MilestoneDefinition" SET "weight" = 12 WHERE "code" = 'VM21';
UPDATE "MilestoneDefinition" SET "weight" = 4  WHERE "code" = 'VM2';
UPDATE "MilestoneDefinition" SET "weight" = 5  WHERE "code" = 'VM3';
UPDATE "MilestoneDefinition" SET "weight" = 5  WHERE "code" = 'VM16';
UPDATE "MilestoneDefinition" SET "weight" = 6  WHERE "code" = 'VM20';
