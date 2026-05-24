-- Polish columns for AgentPushSubscription.
--
-- userAgent: captured from req.headers.get("user-agent") at subscribe time.
-- Drives the "Chrome on Mac" device labels in /agent/settings devices list.
-- Nullable — existing rows fall back to a generic "Subscribed device" label.
--
-- lastUsedAt: updated on every successful pushToUser send so users can spot
-- dead subscriptions in the devices list. Nullable — rows that have never
-- received a push fall back to displaying the createdAt date.
--
-- Both columns are purely additive (nullable, no default value) — safe on
-- existing rows, no backfill needed.

ALTER TABLE "AgentPushSubscription"
  ADD COLUMN "userAgent"  TEXT,
  ADD COLUMN "lastUsedAt" TIMESTAMP(3);
