-- CreateTable
CREATE TABLE "FileSummary" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL,
    "promptVersion" INTEGER NOT NULL DEFAULT 1,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileSummary_transactionId_key" ON "FileSummary"("transactionId");

-- CreateIndex
CREATE INDEX "FileSummary_transactionId_idx" ON "FileSummary"("transactionId");

-- AddForeignKey
ALTER TABLE "FileSummary" ADD CONSTRAINT "FileSummary_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
