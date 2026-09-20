-- Major roads travelled per cached route ("Via A41, A418"), parsed from the
-- route steps. Nullable so existing rows are untouched (they re-fetch lazily to
-- backfill; an empty array means "computed, no classified roads").
ALTER TABLE "PostcodeRoute" ADD COLUMN IF NOT EXISTS "viaRoads" JSONB;
