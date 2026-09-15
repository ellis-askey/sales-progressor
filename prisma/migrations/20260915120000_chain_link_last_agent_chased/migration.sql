-- Manual chain-neighbour chase: record when we last chased a neighbour's agent
-- for an update. Powers the "chased X ago" hint and the resend dedup guard.
-- IF NOT EXISTS: the staging DB's direct host is unreachable from local, so this
-- column is pre-applied over the pooler for testing; the guard keeps the Vercel
-- `migrate deploy` re-run a harmless no-op (avoids the ADD COLUMN drift we hit on
-- DirectorInvitation.cancelledAt).
ALTER TABLE "ChainLink" ADD COLUMN IF NOT EXISTS "lastAgentChasedAt" TIMESTAMP(3);
