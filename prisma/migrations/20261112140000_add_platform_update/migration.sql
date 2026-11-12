-- Platform Updates / "What's new" (Phase 1): founder-curated feed, Command
-- Centre only. Every row is born Hidden (status = 'draft'). No agent-facing use
-- yet — the viewing page + visibility rules land in Phase 2.

CREATE TYPE "PlatformUpdateCategory" AS ENUM ('new_feature', 'improvement', 'moved');
CREATE TYPE "PlatformUpdateStatus" AS ENUM ('draft', 'published');
CREATE TYPE "PlatformUpdateAudience" AS ENUM ('everyone', 'agency_staff', 'progression_business', 'tsp_internal');

CREATE TABLE "PlatformUpdate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "PlatformUpdateCategory" NOT NULL DEFAULT 'improvement',
    "status" "PlatformUpdateStatus" NOT NULL DEFAULT 'draft',
    "audience" "PlatformUpdateAudience" NOT NULL DEFAULT 'everyone',
    "publishedAt" TIMESTAMP(3),
    "screenshotPath" TEXT,
    "screenshotFilename" TEXT,
    "linkUrl" TEXT,
    "technicalSummary" TEXT,
    "sourceShas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "publishedById" TEXT,
    "publishedByEmail" TEXT,

    CONSTRAINT "PlatformUpdate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformUpdate_status_publishedAt_idx" ON "PlatformUpdate"("status", "publishedAt" DESC);
CREATE INDEX "PlatformUpdate_createdAt_idx" ON "PlatformUpdate"("createdAt" DESC);
