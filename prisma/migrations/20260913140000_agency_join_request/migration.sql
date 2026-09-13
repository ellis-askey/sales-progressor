-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "AgencyJoinRequest" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requestedRole" "UserRole" NOT NULL DEFAULT 'negotiator',
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgencyJoinRequest_agencyId_status_idx" ON "AgencyJoinRequest"("agencyId", "status");

-- CreateIndex
CREATE INDEX "AgencyJoinRequest_requesterUserId_idx" ON "AgencyJoinRequest"("requesterUserId");

-- CreateIndex
CREATE INDEX "AgencyJoinRequest_requesterEmail_idx" ON "AgencyJoinRequest"("requesterEmail");

-- AddForeignKey
ALTER TABLE "AgencyJoinRequest" ADD CONSTRAINT "AgencyJoinRequest_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyJoinRequest" ADD CONSTRAINT "AgencyJoinRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyJoinRequest" ADD CONSTRAINT "AgencyJoinRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
