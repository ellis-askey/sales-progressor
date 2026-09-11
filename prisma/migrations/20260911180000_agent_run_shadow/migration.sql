-- Progression Agent (shadow mode): AgentRun + AgentAction audit tables and a
-- MilestoneProposal.agentRunId link. Additive + shadow-only; no data migration.
--
-- Authored with IF NOT EXISTS so it is safe to re-run: applied to staging via
-- the pooled connection at authoring time (the direct migrate endpoint is
-- unreachable from the dev machine), then Vercel's `migrate deploy` records +
-- no-ops it on staging and applies it cleanly on production.

-- MilestoneProposal link ----------------------------------------------------
ALTER TABLE "MilestoneProposal" ADD COLUMN IF NOT EXISTS "agentRunId" TEXT;
CREATE INDEX IF NOT EXISTS "MilestoneProposal_agentRunId_idx" ON "MilestoneProposal"("agentRunId");

-- AgentRun ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AgentRun" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "agencyId" TEXT,
    "triggerType" TEXT NOT NULL DEFAULT 'inbound_email',
    "triggerMessageId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "outcome" TEXT,
    "understood" TEXT,
    "changed" TEXT,
    "waitingOn" TEXT,
    "nextExpected" TEXT,
    "reasoningSummary" TEXT,
    "confidence" TEXT,
    "humanAttention" BOOLEAN NOT NULL DEFAULT false,
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentRun_triggerMessageId_key" ON "AgentRun"("triggerMessageId");
CREATE INDEX IF NOT EXISTS "AgentRun_transactionId_startedAt_idx" ON "AgentRun"("transactionId", "startedAt");
CREATE INDEX IF NOT EXISTS "AgentRun_status_startedAt_idx" ON "AgentRun"("status", "startedAt");
CREATE INDEX IF NOT EXISTS "AgentRun_outcome_startedAt_idx" ON "AgentRun"("outcome", "startedAt");

-- AgentAction --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AgentAction" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "confidence" TEXT,
    "outcome" TEXT NOT NULL,
    "blockedReason" TEXT,
    "evidence" TEXT,
    "evidenceMessageId" TEXT,
    "targetType" TEXT,
    "targetRef" TEXT,
    "milestoneProposalId" TEXT,
    "reviewStatus" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AgentAction_agentRunId_idx" ON "AgentAction"("agentRunId");
CREATE INDEX IF NOT EXISTS "AgentAction_actionType_outcome_idx" ON "AgentAction"("actionType", "outcome");
CREATE INDEX IF NOT EXISTS "AgentAction_milestoneProposalId_idx" ON "AgentAction"("milestoneProposalId");

-- Foreign keys (guarded so re-runs don't error on an existing constraint) ---
DO $$ BEGIN
  ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_agentRunId_fkey"
    FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
