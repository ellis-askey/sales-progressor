-- Split the chase counter into total vs human.
--
-- chaseCount stays the total (human chases + automated client-chase digest
-- sends). manualChaseCount tracks HUMAN chases only. Escalation now reads
-- manualChaseCount, so the two automated digest sends no longer arm the
-- urgent flag on their own. Existing rows default to 0: they need fresh
-- human chases before escalating (quieter, intended). Rows already flagged
-- escalated keep their priority — the engine only ever flips TO escalated,
-- never back, so nothing de-escalates on rollout.
ALTER TABLE "ChaseTask" ADD COLUMN "manualChaseCount" INTEGER NOT NULL DEFAULT 0;
