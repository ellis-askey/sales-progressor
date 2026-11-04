-- Director-edited welcome-call script (numbered talking points). Null = platform
-- default. Additive + nullable, so safe to apply with no backfill.
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "introCallScript" JSONB;
