-- Platform Updates Phase 3: production-release auto-drafting support.
-- Additive only. origin distinguishes founder-written vs auto-drafted entries;
-- sourceReleaseSha + dismissedAt support trace/dedup/soft-dismiss. ProcessedRelease
-- is the per-release dedup marker written by the cron.

CREATE TYPE "PlatformUpdateOrigin" AS ENUM ('manual', 'auto');

ALTER TABLE "PlatformUpdate" ADD COLUMN "origin" "PlatformUpdateOrigin" NOT NULL DEFAULT 'manual';
ALTER TABLE "PlatformUpdate" ADD COLUMN "sourceReleaseSha" TEXT;
ALTER TABLE "PlatformUpdate" ADD COLUMN "dismissedAt" TIMESTAMP(3);

CREATE INDEX "PlatformUpdate_origin_dismissedAt_idx" ON "PlatformUpdate"("origin", "dismissedAt");

CREATE TABLE "ProcessedRelease" (
    "id" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commitsConsidered" INTEGER NOT NULL DEFAULT 0,
    "draftsCreated" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "ProcessedRelease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessedRelease_sha_key" ON "ProcessedRelease"("sha");
CREATE INDEX "ProcessedRelease_processedAt_idx" ON "ProcessedRelease"("processedAt" DESC);
