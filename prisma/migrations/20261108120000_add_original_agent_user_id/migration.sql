-- The agent who ORIGINALLY added a sale. Set once at creation, never changed by a
-- reassign (unlike agentUserId, which becomes the current owner). Powers the file's
-- "Added by {original}" + "Assigned to {current}" once a file changes hands.
--
-- Idempotent: the column was applied to staging ahead of this migration via raw SQL,
-- so IF NOT EXISTS / guarded constraint keep `migrate deploy` safe there and on prod.

ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "originalAgentUserId" TEXT;

DO $$ BEGIN
  ALTER TABLE "PropertyTransaction"
    ADD CONSTRAINT "PropertyTransaction_originalAgentUserId_fkey"
    FOREIGN KEY ("originalAgentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: existing files have never been reassigned, so original = current owner.
UPDATE "PropertyTransaction"
  SET "originalAgentUserId" = "agentUserId"
  WHERE "originalAgentUserId" IS NULL AND "agentUserId" IS NOT NULL;
