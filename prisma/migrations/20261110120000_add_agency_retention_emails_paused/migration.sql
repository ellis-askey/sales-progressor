-- Lifecycle/retention email kill switch, per agency (Command Centre). When true,
-- the retention sweep + welcome/exchange celebrations skip this agency — for
-- trial/managed customers who shouldn't be nudged. OFF by default.
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "retentionEmailsPaused" BOOLEAN NOT NULL DEFAULT false;
