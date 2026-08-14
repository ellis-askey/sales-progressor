-- Enquiries rework, Stage 1.2a — correction.
-- The seller's side does NOT confirm enquiries are satisfied; the buyer's
-- solicitor does (PM20). VM21 is a REFLECTION of that on the seller's file
-- (auto-completes when PM20 is confirmed), never a seller action. Rename it
-- from the incorrect "Seller's solicitor has confirmed..." to a neutral fact.
UPDATE "MilestoneDefinition"
SET "name" = 'All enquiries satisfied'
WHERE "code" = 'VM21';
