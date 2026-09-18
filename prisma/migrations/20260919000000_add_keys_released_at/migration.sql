-- Completion-day: agent-marked "keys released to the buyer" stamp.
-- Nullable, additive, idempotent (safe to re-run / applied to staging first).
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "keysReleasedAt" TIMESTAMP(3);
