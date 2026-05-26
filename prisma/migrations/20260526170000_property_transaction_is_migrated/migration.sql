-- Add isMigrated flag to PropertyTransaction.
--
-- Distinguishes files created via the admin Migrate Sale page (backdated,
-- user-supplied historical milestone completedAt timestamps) from organic
-- agent-created files (real-time milestone confirmation). Lets future
-- milestone-velocity analytics filter migrated rows out — averaging
-- estimated dates against real-time signals would pollute "average time
-- between milestone X and Y" statistics.
--
-- Nullable-safe rollout: column is non-nullable with default false, so all
-- existing rows immediately become isMigrated=false. The admin migrate
-- action is updated in the same PR to set isMigrated=true on future
-- migrations. Existing migrated rows (already in prod) are backfilled by
-- a one-off script that targets known migration IDs.

ALTER TABLE "PropertyTransaction"
  ADD COLUMN "isMigrated" BOOLEAN NOT NULL DEFAULT false;
