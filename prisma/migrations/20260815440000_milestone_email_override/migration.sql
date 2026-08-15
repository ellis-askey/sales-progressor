-- CreateTable
CREATE TABLE "MilestoneEmailOverride" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "tenure" TEXT NOT NULL DEFAULT 'any',
    "purchaseType" TEXT NOT NULL DEFAULT 'any',
    "subject" TEXT NOT NULL,
    "heroLabel" TEXT NOT NULL,
    "opening" TEXT NOT NULL,
    "whatHappened" TEXT NOT NULL,
    "whatNext" TEXT,
    "action" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneEmailOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MilestoneEmailOverride_code_side_idx" ON "MilestoneEmailOverride"("code", "side");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneEmailOverride_code_side_tenure_purchaseType_key" ON "MilestoneEmailOverride"("code", "side", "tenure", "purchaseType");
