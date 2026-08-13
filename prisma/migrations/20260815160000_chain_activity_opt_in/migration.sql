-- Per-agent opt-in for the chain drawer's live activity feed (audit #14).
-- Default false: the feed stays hidden until the agent turns it on, and the
-- preference persists across every chain they view. Additive + non-null with a
-- default, so it is backfilled safely. Apply staging-first, verify, then prod.
ALTER TABLE "User" ADD COLUMN "chainActivityOptIn" BOOLEAN NOT NULL DEFAULT false;
