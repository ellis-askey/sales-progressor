-- Director-set monthly fees goal (pence) per agency. Drives the "ahead / short"
-- line on the All Files → Forecast tab. Nullable + no default, so it's purely
-- additive and safe: existing rows keep NULL (no target), nothing is rewritten.
ALTER TABLE "Agency" ADD COLUMN "monthlyFeeTargetPence" INTEGER;
