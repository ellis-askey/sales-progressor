-- CreateTable
CREATE TABLE "FileTimeSession" (
    "id"                  TEXT         NOT NULL,
    "transactionId"       TEXT         NOT NULL,
    "userId"              TEXT         NOT NULL,
    "agencyId"            TEXT         NOT NULL,
    "startedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt"             TIMESTAMP(3),
    "lastActivityAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "engagementIntervals" JSONB        NOT NULL DEFAULT '[]',
    "totalEngagedSeconds" INTEGER,
    "userAgent"           TEXT,
    "closedReason"        TEXT,

    CONSTRAINT "FileTimeSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileTimeSession_transactionId_userId_idx" ON "FileTimeSession"("transactionId", "userId");

-- CreateIndex
CREATE INDEX "FileTimeSession_userId_startedAt_idx" ON "FileTimeSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "FileTimeSession_agencyId_startedAt_idx" ON "FileTimeSession"("agencyId", "startedAt");

-- AddForeignKey
ALTER TABLE "FileTimeSession" ADD CONSTRAINT "FileTimeSession_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileTimeSession" ADD CONSTRAINT "FileTimeSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileTimeSession" ADD CONSTRAINT "FileTimeSession_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
