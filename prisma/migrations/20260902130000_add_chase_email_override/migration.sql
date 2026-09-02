-- Chase-consolidation D2 (2026-09): per-(file, chase target, milestone) override
-- for an upcoming chase email. The agent edits/skips the next chase from the
-- Chase timeline; the client + solicitor cron builds read this at fire time.
CREATE TABLE "ChaseEmailOverride" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "recipientKind" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "milestoneCode" TEXT NOT NULL,
    "subjectOverride" TEXT,
    "bodyOverride" TEXT,
    "skipNext" BOOLEAN NOT NULL DEFAULT false,
    "editedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChaseEmailOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChaseEmailOverride_transactionId_targetKey_milestoneCode_key" ON "ChaseEmailOverride"("transactionId", "targetKey", "milestoneCode");

CREATE INDEX "ChaseEmailOverride_transactionId_idx" ON "ChaseEmailOverride"("transactionId");

ALTER TABLE "ChaseEmailOverride" ADD CONSTRAINT "ChaseEmailOverride_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
