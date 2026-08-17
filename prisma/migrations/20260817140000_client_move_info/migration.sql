-- Client-supplied "Information" (portal Information tab, Batch 3). One row per
-- (transaction, side); all fields optional.
CREATE TABLE "ClientMoveInfo" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "side" "ContactRole" NOT NULL,
    "preferredCompletionDate" TIMESTAMP(3),
    "noCompletionPreference" BOOLEAN NOT NULL DEFAULT false,
    "flexibility" TEXT,
    "mortgageOfferExpiry" TIMESTAMP(3),
    "fundsInPlace" TEXT,
    "fundsSource" TEXT,
    "needsNotice" BOOLEAN,
    "noticePeriod" TEXT,
    "noticeGiven" BOOLEAN,
    "noticeEndDate" TIMESTAMP(3),
    "buyingOnward" BOOLEAN,
    "onwardReadyToExchange" TEXT,
    "onwardMortgageOfferExpiry" TIMESTAMP(3),
    "removalStatus" TEXT,
    "removalCompany" TEXT,
    "vacantBeforeCompletion" TEXT,
    "unavailableDates" JSONB,
    "progressorNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientMoveInfo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientMoveInfo_transactionId_side_key" ON "ClientMoveInfo"("transactionId", "side");
CREATE INDEX "ClientMoveInfo_transactionId_idx" ON "ClientMoveInfo"("transactionId");

ALTER TABLE "ClientMoveInfo" ADD CONSTRAINT "ClientMoveInfo_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
