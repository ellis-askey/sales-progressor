-- Manual chain-neighbour chase: record when we last chased a neighbour's agent
-- for an update. Powers the "chased X ago" hint and the resend dedup guard.
ALTER TABLE "ChainLink" ADD COLUMN "lastAgentChasedAt" TIMESTAMP(3);
