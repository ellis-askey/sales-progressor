-- Manual escalation attribution. Pre-fix, an escalated ChaseTask carried
-- no signal on WHY it was escalated: the "escalated" chip surfaced with
-- no context, and the file owner had to guess whether the flag was
-- automatic (engine cadence rule) or manual (someone flipped it).
-- Splitting off a dedicated tuple lets us:
--   - render the reason on hover
--   - render "escalated by X on Y" in the activity feed
--   - keep engine-triggered escalations distinguishable (all three null)
--
-- Cleared implicitly on chase-through (applyChaseToTask resets priority to
-- normal → chip vanishes → next escalation is a fresh event).

ALTER TABLE "ChaseTask"
  ADD COLUMN "escalationReason" TEXT,
  ADD COLUMN "escalatedAt"      TIMESTAMP(3),
  ADD COLUMN "escalatedById"    TEXT;

ALTER TABLE "ChaseTask"
  ADD CONSTRAINT "ChaseTask_escalatedById_fkey"
  FOREIGN KEY ("escalatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
