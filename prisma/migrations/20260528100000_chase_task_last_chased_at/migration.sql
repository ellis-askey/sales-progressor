-- ChaseTask.lastChasedAt — set on every real chase increment.
-- NULL means "never chased yet". The reminder engine uses this to gate
-- escalation: chaseCount >= rule.escalateAfterChases AND
-- (now - lastChasedAt) >= rule.repeatEveryDays days. The engine NEVER
-- ticks chaseCount on calendar arithmetic alone; only real chase
-- actions move it.
--
-- Backfill from OutboundMessage records is performed by the rollout
-- script scripts/backfill-chase-task-from-outbound.ts (see docs/active/
-- honest-chase-count). This migration adds the column nullable and
-- leaves population to the script.

ALTER TABLE "ChaseTask"
  ADD COLUMN "lastChasedAt" TIMESTAMP(3);
