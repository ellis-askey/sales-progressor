-- Migration: add_rollup_tables
-- Adds DailyMetric, WeeklyCohort, and JobRun tables for the command centre.
-- Safe to re-run (idempotent).

CREATE TABLE IF NOT EXISTS "DailyMetric" (
  "id"                    TEXT NOT NULL,
  "date"                  DATE NOT NULL,
  "agencyId"              TEXT,
  "serviceType"           "ServiceType",
  "modeProfile"           "AgencyModeProfile",
  "transactionsCreated"   INTEGER NOT NULL DEFAULT 0,
  "transactionsExchanged" INTEGER NOT NULL DEFAULT 0,
  "transactionsCompleted" INTEGER NOT NULL DEFAULT 0,
  "milestonesConfirmed"   INTEGER NOT NULL DEFAULT 0,
  "chasesSent"            INTEGER NOT NULL DEFAULT 0,
  "aiDraftsGenerated"     INTEGER NOT NULL DEFAULT 0,
  "filesUploaded"         INTEGER NOT NULL DEFAULT 0,
  "signups"               INTEGER NOT NULL DEFAULT 0,
  "logins"                INTEGER NOT NULL DEFAULT 0,
  "uniqueActiveUsers"     INTEGER NOT NULL DEFAULT 0,
  "feedbackSubmitted"     INTEGER NOT NULL DEFAULT 0,
  "aiSpendCents"          INTEGER NOT NULL DEFAULT 0,
  "computedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "DailyMetric"
    ADD CONSTRAINT "DailyMetric_date_agencyId_serviceType_modeProfile_key"
    UNIQUE ("date", "agencyId", "serviceType", "modeProfile");
EXCEPTION WHEN duplicate_table THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "DailyMetric_date_idx"         ON "DailyMetric"("date");
CREATE INDEX IF NOT EXISTS "DailyMetric_agencyId_date_idx" ON "DailyMetric"("agencyId", "date");
CREATE INDEX IF NOT EXISTS "DailyMetric_serviceType_date_idx" ON "DailyMetric"("serviceType", "date");
CREATE INDEX IF NOT EXISTS "DailyMetric_modeProfile_date_idx" ON "DailyMetric"("modeProfile", "date");

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "WeeklyCohort" (
  "id"           TEXT NOT NULL,
  "signupWeek"   DATE NOT NULL,
  "modeProfile"  "AgencyModeProfile" NOT NULL,
  "cohortSize"   INTEGER NOT NULL,
  "activeWeek1"  INTEGER NOT NULL DEFAULT 0,
  "activeWeek2"  INTEGER NOT NULL DEFAULT 0,
  "activeWeek4"  INTEGER NOT NULL DEFAULT 0,
  "activeWeek8"  INTEGER NOT NULL DEFAULT 0,
  "activeWeek12" INTEGER NOT NULL DEFAULT 0,
  "computedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "WeeklyCohort_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "WeeklyCohort"
    ADD CONSTRAINT "WeeklyCohort_signupWeek_modeProfile_key"
    UNIQUE ("signupWeek", "modeProfile");
EXCEPTION WHEN duplicate_table THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "WeeklyCohort_signupWeek_idx" ON "WeeklyCohort"("signupWeek");

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "JobRun" (
  "id"           TEXT NOT NULL,
  "jobName"      TEXT NOT NULL,
  "startedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "finishedAt"   TIMESTAMPTZ,
  "success"      BOOLEAN,
  "rowsWritten"  INTEGER,
  "errorMessage" TEXT,

  CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JobRun_jobName_startedAt_idx" ON "JobRun"("jobName", "startedAt");
