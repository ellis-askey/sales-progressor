-- Invite-to-move (docs/active/invite-to-move/SPEC.md)
-- Soft-archive columns on Agency for retiring emptied shells, plus the
-- AgencyMoveRequest support queue for the heavy (real-data) move case.

ALTER TABLE "Agency" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Agency" ADD COLUMN "archivedReason" TEXT;

CREATE TYPE "AgencyMoveStatus" AS ENUM ('pending', 'completed', 'cancelled');

CREATE TABLE "AgencyMoveRequest" (
    "id" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "fromAgencyId" TEXT NOT NULL,
    "toAgencyId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "salesCount" INTEGER NOT NULL,
    "otherStaffCount" INTEGER NOT NULL,
    "status" "AgencyMoveStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgencyMoveRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgencyMoveRequest_status_idx" ON "AgencyMoveRequest"("status");
CREATE INDEX "AgencyMoveRequest_requesterUserId_idx" ON "AgencyMoveRequest"("requesterUserId");
