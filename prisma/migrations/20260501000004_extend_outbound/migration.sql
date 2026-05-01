-- Migration: extend_outbound
-- Rename CommunicationRecord → OutboundMessage; make transactionId nullable; add command-centre fields.
-- Apply to Supabase SQL editor. Safe to re-run (idempotent).

-- 1. New enum types
DO $$ BEGIN
  CREATE TYPE "OutboundChannel" AS ENUM ('email', 'sms', 'linkedin', 'twitter', 'in_app', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OutboundPurpose" AS ENUM ('chase', 'password_reset', 'retention_email', 'scheduled_post', 'digest', 'notification', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OutboundStatus" AS ENUM ('draft', 'scheduled', 'queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Add new columns (idempotent; operates on whichever name the table currently has)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'CommunicationRecord' AND schemaname = 'public') THEN
    tbl := 'CommunicationRecord';
  ELSIF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'OutboundMessage' AND schemaname = 'public') THEN
    tbl := 'OutboundMessage';
  ELSE
    RAISE EXCEPTION 'Neither CommunicationRecord nor OutboundMessage table found';
  END IF;

  EXECUTE format('ALTER TABLE %I
    ADD COLUMN IF NOT EXISTS "agencyId"           TEXT,
    ADD COLUMN IF NOT EXISTS "channel"             "OutboundChannel"  NOT NULL DEFAULT ''email'',
    ADD COLUMN IF NOT EXISTS "purpose"             "OutboundPurpose"  NOT NULL DEFAULT ''chase'',
    ADD COLUMN IF NOT EXISTS "status"              "OutboundStatus"   NOT NULL DEFAULT ''sent'',
    ADD COLUMN IF NOT EXISTS "recipientName"       TEXT,
    ADD COLUMN IF NOT EXISTS "recipientEmail"      TEXT,
    ADD COLUMN IF NOT EXISTS "recipientHandle"     TEXT,
    ADD COLUMN IF NOT EXISTS "subject"             TEXT,
    ADD COLUMN IF NOT EXISTS "bodyFormat"          TEXT               NOT NULL DEFAULT ''plain'',
    ADD COLUMN IF NOT EXISTS "aiModel"             TEXT,
    ADD COLUMN IF NOT EXISTS "aiPromptVersion"     TEXT,
    ADD COLUMN IF NOT EXISTS "aiTokensInput"       INTEGER,
    ADD COLUMN IF NOT EXISTS "aiTokensOutput"      INTEGER,
    ADD COLUMN IF NOT EXISTS "aiCostCents"         INTEGER,
    ADD COLUMN IF NOT EXISTS "scheduledFor"        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "sentAt"              TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "deliveredAt"         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "openedAt"            TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "clickedAt"           TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "failedAt"            TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "failureReason"       TEXT,
    ADD COLUMN IF NOT EXISTS "requiresApproval"    BOOLEAN            NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "approvedByUserId"    TEXT,
    ADD COLUMN IF NOT EXISTS "approvedAt"          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "editedByHuman"       BOOLEAN            NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "providerMessageId"   TEXT,
    ADD COLUMN IF NOT EXISTS "providerWebhookData" JSONB', tbl);
END $$;

-- 3. Make transactionId nullable (no-op if already nullable)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'CommunicationRecord' AND schemaname = 'public') THEN
    tbl := 'CommunicationRecord';
  ELSE
    tbl := 'OutboundMessage';
  END IF;
  EXECUTE format('ALTER TABLE %I ALTER COLUMN "transactionId" DROP NOT NULL', tbl);
END $$;

-- 4. Rename table (no-op if already renamed)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'CommunicationRecord' AND schemaname = 'public') THEN
    ALTER TABLE "CommunicationRecord" RENAME TO "OutboundMessage";
  END IF;
END $$;

-- 5. New indexes (idempotent via IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "OutboundMessage_agencyId_createdAt_idx"        ON "OutboundMessage"("agencyId", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboundMessage_channel_status_scheduledFor_idx" ON "OutboundMessage"("channel", "status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "OutboundMessage_purpose_createdAt_idx"         ON "OutboundMessage"("purpose", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboundMessage_sentAt_idx"                    ON "OutboundMessage"("sentAt");
