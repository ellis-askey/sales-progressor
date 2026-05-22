-- A4 of the client-chase arc (foundation Sub-arc A).
-- Adds ChaseTask.fallbackKind — discrete-kind marker for tasks created when
-- automated chasing was redirected to the agent. First value is
-- "client_opted_out", set by createAgentChaseTaskForMilestone in
-- lib/services/reminders.ts. Null for normal engine-created tasks.
-- Pure additive; no callers in Sub-arc A (helper added but invoked only
-- in Sub-arc B's actual fail-soft routing).

ALTER TABLE "ChaseTask" ADD COLUMN "fallbackKind" TEXT;
