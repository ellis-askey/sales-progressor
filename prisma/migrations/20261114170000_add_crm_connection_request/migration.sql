-- "Connect your CRM" demand capture (critique #289). One row per agency per CRM.
CREATE TABLE IF NOT EXISTS "CrmConnectionRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agencyId" TEXT NOT NULL,
    "agencyName" TEXT,
    "crmKey" TEXT NOT NULL,
    "crmName" TEXT NOT NULL,
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    CONSTRAINT "CrmConnectionRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConnectionRequest_agencyId_crmKey_key" ON "CrmConnectionRequest"("agencyId", "crmKey");
CREATE INDEX IF NOT EXISTS "CrmConnectionRequest_crmKey_idx" ON "CrmConnectionRequest"("crmKey");
CREATE INDEX IF NOT EXISTS "CrmConnectionRequest_createdAt_idx" ON "CrmConnectionRequest"("createdAt");
