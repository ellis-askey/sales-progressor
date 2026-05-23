-- Fix subject-verb agreement in MilestoneDefinition.summaryTemplate strings.
-- 20 templates updated: 9 vendor-side (VM1-VM6, VM11, VM14, VM17) and 11
-- purchaser-side (PM1-PM5, PM9, PM10, PM21, PM23, PM24, PM27).
--
-- Old templates used hardcoded "have" with {vendors}/{purchasers} as subject,
-- which read wrong for a single vendor/purchaser ("Sarah have completed…").
-- New templates use universal past tense, which reads correctly for any count
-- ("Sarah completed…" / "Sarah and John completed…"). PM27 additionally drops
-- the "are now the proud owners" phrasing which had a double agreement bug
-- (verb + noun) in favour of "congratulations to {purchasers}".
--
-- Historical MilestoneCompletion.summaryText rows are NOT touched — past
-- activity-feed entries keep their original wording. Only new confirmations
-- after this migration use the new wording. (Per Ellis 2026-05-23.)
--
-- Templates already grammatically correct for any count (possessive
-- {vendors}'s, object position, or plural-subject "enquiries have…") are not
-- touched. 27 templates verified safe; see plan file for full audit.

-- Vendor side (9 updates)
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {vendors} instructed their solicitor' WHERE code = 'VM1';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {vendors} received the memorandum of sale' WHERE code = 'VM2';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {vendors} received the welcome pack from their solicitor' WHERE code = 'VM3';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {vendors} completed ID and AML checks' WHERE code = 'VM4';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {vendors} received the property information forms' WHERE code = 'VM5';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {vendors} returned the completed property information forms' WHERE code = 'VM6';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {vendors} provided initial replies to their solicitor' WHERE code = 'VM11';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {vendors} provided further replies to their solicitor' WHERE code = 'VM14';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {vendors} returned signed contract documents to their solicitor' WHERE code = 'VM17';

-- Purchaser side (11 updates)
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {purchasers} instructed their solicitor' WHERE code = 'PM1';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {purchasers} received the memorandum of sale' WHERE code = 'PM2';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {purchasers} completed ID and AML checks' WHERE code = 'PM3';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {purchasers} paid money on account to their solicitor' WHERE code = 'PM4';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {purchasers} submitted their mortgage application' WHERE code = 'PM5';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {purchasers} booked their survey' WHERE code = 'PM9';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {purchasers} received the survey report' WHERE code = 'PM10';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {purchasers} received the final report from their solicitor' WHERE code = 'PM21';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {purchasers} returned signed contract documents' WHERE code = 'PM23';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed {purchasers} transferred the deposit to their solicitor' WHERE code = 'PM24';
UPDATE "MilestoneDefinition" SET "summaryTemplate" = '{agent} confirmed the purchase has completed — congratulations to {purchasers}' WHERE code = 'PM27';
