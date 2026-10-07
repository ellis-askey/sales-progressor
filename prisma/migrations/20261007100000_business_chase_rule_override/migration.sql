-- #228: per-progression-business chase-timing overrides for outsourced files.
CREATE TABLE "BusinessChaseRuleOverride" (
    "id" TEXT NOT NULL,
    "progressionBusinessId" TEXT NOT NULL,
    "milestoneCode" TEXT NOT NULL,
    "graceDays" INTEGER NOT NULL,
    "repeatEveryDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessChaseRuleOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BusinessChaseRuleOverride_progressionBusinessId_milestoneCode_key" ON "BusinessChaseRuleOverride"("progressionBusinessId", "milestoneCode");
CREATE INDEX "BusinessChaseRuleOverride_progressionBusinessId_idx" ON "BusinessChaseRuleOverride"("progressionBusinessId");
ALTER TABLE "BusinessChaseRuleOverride" ADD CONSTRAINT "BusinessChaseRuleOverride_progressionBusinessId_fkey" FOREIGN KEY ("progressionBusinessId") REFERENCES "ProgressionBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;
