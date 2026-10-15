-- Consent handshake for connecting an EXISTING agency to a progression business.
-- A pending request is created by the progressor owner; on the agency director's
-- accept, a ProgressionBusinessClient link is created (handled in app code).
CREATE TABLE "ProgressionConnectionRequest" (
    "id" TEXT NOT NULL,
    "progressionBusinessId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "feeModel" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedByUserId" TEXT NOT NULL,
    "respondedByUserId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgressionConnectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProgressionConnectionRequest_agencyId_status_idx" ON "ProgressionConnectionRequest"("agencyId", "status");
CREATE INDEX "ProgressionConnectionRequest_progressionBusinessId_status_idx" ON "ProgressionConnectionRequest"("progressionBusinessId", "status");

ALTER TABLE "ProgressionConnectionRequest" ADD CONSTRAINT "ProgressionConnectionRequest_progressionBusinessId_fkey" FOREIGN KEY ("progressionBusinessId") REFERENCES "ProgressionBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressionConnectionRequest" ADD CONSTRAINT "ProgressionConnectionRequest_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
