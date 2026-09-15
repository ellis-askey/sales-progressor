-- Per-agency client-chase timing overrides (2026-09-15). ReminderRule stays the
-- single platform default; a row here shifts grace/repeat days for ONE agency's
-- own self-managed files only (outsourced files always snapshot the default).
-- Written idempotently (IF NOT EXISTS) because migrations are applied to staging
-- ahead of deploy manually when the direct DB host is unreachable from local;
-- this lets the deploy's `prisma migrate deploy` re-run it as a no-op.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyChaseRuleOverride" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "milestoneCode" TEXT NOT NULL,
    "graceDays" INTEGER NOT NULL,
    "repeatEveryDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyChaseRuleOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyChaseRuleOverride_agencyId_milestoneCode_key" ON "AgencyChaseRuleOverride"("agencyId", "milestoneCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgencyChaseRuleOverride_agencyId_idx" ON "AgencyChaseRuleOverride"("agencyId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyChaseRuleOverride_agencyId_fkey') THEN
    ALTER TABLE "AgencyChaseRuleOverride" ADD CONSTRAINT "AgencyChaseRuleOverride_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
