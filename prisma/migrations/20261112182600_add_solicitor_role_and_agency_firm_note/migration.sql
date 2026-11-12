-- Partner (solicitor) profile redesign.
-- Idempotent on purpose: this is hand-applied to staging via the pooler while
-- the direct migrate endpoint is unreachable, then recorded by `migrate deploy`
-- later (the IF NOT EXISTS guards make that re-run a no-op). Purely additive.

-- 1) Optional job title on a solicitor handler (shared-directory value).
ALTER TABLE "SolicitorContact" ADD COLUMN IF NOT EXISTS "role" TEXT;

-- 2) Per-agency private note about a globally-shared solicitor firm.
CREATE TABLE IF NOT EXISTS "AgencyFirmNote" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "solicitorFirmId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyFirmNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgencyFirmNote_agencyId_solicitorFirmId_key" ON "AgencyFirmNote"("agencyId", "solicitorFirmId");
CREATE INDEX IF NOT EXISTS "AgencyFirmNote_solicitorFirmId_idx" ON "AgencyFirmNote"("solicitorFirmId");

DO $$ BEGIN
  ALTER TABLE "AgencyFirmNote"
    ADD CONSTRAINT "AgencyFirmNote_solicitorFirmId_fkey"
    FOREIGN KEY ("solicitorFirmId") REFERENCES "SolicitorFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
