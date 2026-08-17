-- Agent-facing email log (Command Centre /command/agent-emails surface).
-- Records emails sent TO agency users / external agents that do NOT already
-- leave a trail on a file (client-facing sends are logged via
-- OutboundEmailQueue + file activity). Written best-effort by sendAgentEmail.
CREATE TABLE "AgentEmailLog" (
    "id" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toEmail" TEXT NOT NULL,
    "userId" TEXT,
    "agencyId" TEXT,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT,
    "html" TEXT,
    "transactionId" TEXT,
    "meta" JSONB,

    CONSTRAINT "AgentEmailLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentEmailLog_sentAt_idx" ON "AgentEmailLog"("sentAt");
CREATE INDEX "AgentEmailLog_kind_idx" ON "AgentEmailLog"("kind");
CREATE INDEX "AgentEmailLog_agencyId_idx" ON "AgentEmailLog"("agencyId");

ALTER TABLE "AgentEmailLog" ADD CONSTRAINT "AgentEmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentEmailLog" ADD CONSTRAINT "AgentEmailLog_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentEmailLog" ADD CONSTRAINT "AgentEmailLog_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
