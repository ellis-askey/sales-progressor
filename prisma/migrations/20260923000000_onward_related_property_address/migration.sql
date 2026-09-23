-- Related / onward property address on the lightweight onward tracker. Optional
-- free text (e.g. "25 Austin House, Harlow, CM20 2UA"). When set, inbound mail
-- that names this property auto-files onto the sale file — read by the mail
-- matcher (buildIndex) alongside chain stub addresses. Address match only.
ALTER TABLE "OnwardTracker" ADD COLUMN "relatedPropertyAddress" TEXT;
