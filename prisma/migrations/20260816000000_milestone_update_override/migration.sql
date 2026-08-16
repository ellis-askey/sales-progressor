-- CreateTable
CREATE TABLE "MilestoneUpdateOverride" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "core" TEXT,
    "subtextOwn" TEXT,
    "subtextOther" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneUpdateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneUpdateOverride_code_key" ON "MilestoneUpdateOverride"("code");
