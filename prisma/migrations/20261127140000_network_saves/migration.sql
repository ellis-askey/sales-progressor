-- Progressor Network "Saved" tab: an agency's bookmarks of network-listed
-- progression businesses. Convenience list only — grants nothing, independent
-- of connection state. One row per (agency, business); unsaving deletes it.

CREATE TABLE "ProgressionNetworkSave" (
    "id" TEXT NOT NULL,
    "progressionBusinessId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "savedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressionNetworkSave_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProgressionNetworkSave_agencyId_progressionBusinessId_key" ON "ProgressionNetworkSave"("agencyId", "progressionBusinessId");

CREATE INDEX "ProgressionNetworkSave_agencyId_idx" ON "ProgressionNetworkSave"("agencyId");

ALTER TABLE "ProgressionNetworkSave" ADD CONSTRAINT "ProgressionNetworkSave_progressionBusinessId_fkey" FOREIGN KEY ("progressionBusinessId") REFERENCES "ProgressionBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgressionNetworkSave" ADD CONSTRAINT "ProgressionNetworkSave_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
