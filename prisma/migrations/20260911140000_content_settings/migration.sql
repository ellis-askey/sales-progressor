-- Content & Personal Brand, Phase 5.2: content settings (autopilot + weekly plan).
-- docs/active/content-brand/SPEC.md

-- CreateTable
CREATE TABLE "ContentSettings" (
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "autopilotLevel" TEXT NOT NULL DEFAULT 'manual',
    "weeklyPlan" JSONB,
    "weeklyPlanAt" TIMESTAMP(3),

    CONSTRAINT "ContentSettings_pkey" PRIMARY KEY ("id")
);
