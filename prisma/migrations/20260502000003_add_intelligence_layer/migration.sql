-- Migration: add_intelligence_layer
-- Adds Signal, Experiment (+ enums), and Deployment tables for Phase 3.
-- All statements are idempotent via IF NOT EXISTS / DO $$ guards.

-- ── SignalSeverity enum ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "SignalSeverity" AS ENUM ('info', 'opportunity', 'leak', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Signal table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Signal" (
  "id"             TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "detectedAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "detectorName"   TEXT          NOT NULL,
  "payload"        JSONB         NOT NULL,
  "confidence"     DOUBLE PRECISION NOT NULL,
  "severity"       "SignalSeverity" NOT NULL,
  "acknowledged"   BOOLEAN       NOT NULL DEFAULT false,
  "acknowledgedAt" TIMESTAMPTZ,
  "windowStart"    TIMESTAMPTZ   NOT NULL,
  "windowEnd"      TIMESTAMPTZ   NOT NULL,
  CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Signal_detectedAt_idx"            ON "Signal"("detectedAt");
CREATE INDEX IF NOT EXISTS "Signal_severity_detectedAt_idx"   ON "Signal"("severity", "detectedAt");
CREATE INDEX IF NOT EXISTS "Signal_acknowledged_detectedAt_idx" ON "Signal"("acknowledged", "detectedAt");

-- ── ExperimentStatus enum ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "ExperimentStatus" AS ENUM ('proposed', 'active', 'concluded', 'abandoned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── ExperimentOutcome enum ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "ExperimentOutcome" AS ENUM ('win', 'loss', 'inconclusive', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Experiment table ─────────────────────────────────────────────────────────
-- baselineWindowDays / resultWindowDays default to 7 (founder-set for fast iteration).
CREATE TABLE IF NOT EXISTS "Experiment" (
  "id"                 TEXT               NOT NULL DEFAULT gen_random_uuid()::text,
  "name"               TEXT               NOT NULL,
  "hypothesis"         TEXT               NOT NULL,
  "status"             "ExperimentStatus" NOT NULL DEFAULT 'proposed',
  "outcome"            "ExperimentOutcome",
  "sourceSignalId"     TEXT,
  "sourceType"         TEXT,
  "primaryMetric"      TEXT               NOT NULL,
  "guardrailMetrics"   TEXT[]             NOT NULL DEFAULT '{}',
  "proposedAt"         TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  "startedAt"          TIMESTAMPTZ,
  "concludedAt"        TIMESTAMPTZ,
  "baselineSnapshot"   JSONB,
  "resultSnapshot"     JSONB,
  "baselineWindowDays" INTEGER            NOT NULL DEFAULT 7,
  "resultWindowDays"   INTEGER            NOT NULL DEFAULT 7,
  "notes"              TEXT,
  "conclusionNote"     TEXT,
  "createdByUserId"    TEXT               NOT NULL,
  CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Experiment_status_startedAt_idx"  ON "Experiment"("status", "startedAt");
CREATE INDEX IF NOT EXISTS "Experiment_sourceSignalId_idx"    ON "Experiment"("sourceSignalId");

-- ── Deployment table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Deployment" (
  "id"           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "deployedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "version"      TEXT        NOT NULL,
  "environment"  TEXT        NOT NULL,
  "releaseNotes" TEXT,
  "triggerType"  TEXT        NOT NULL,
  "triggeredBy"  TEXT,
  CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Deployment_deployedAt_idx"             ON "Deployment"("deployedAt");
CREATE INDEX IF NOT EXISTS "Deployment_environment_deployedAt_idx" ON "Deployment"("environment", "deployedAt");
