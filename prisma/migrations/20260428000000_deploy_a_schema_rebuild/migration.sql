-- Deploy A schema sync: MilestoneState enum, state model, and all related changes
-- All statements use IF NOT EXISTS / IF EXISTS / DO-EXCEPTION blocks to be idempotent.
-- Safe to run against a DB that is partially or fully up to date.

-- ── 1. New enums ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "MilestoneState" AS ENUM ('locked', 'available', 'complete', 'not_required');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CanBeMarkedNr" AS ENUM ('never', 'auto_only', 'manual_allowed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceType" AS ENUM ('self_managed', 'outsourced');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProgressedBy" AS ENUM ('progressor', 'agent');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DomainStatus" AS ENUM ('pending', 'verified', 'failed', 'removed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailVerificationStatus" AS ENUM ('pending_inbox_check', 'verified', 'legacy_single_sender', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ManualTaskStatus" AS ENUM ('open', 'done');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- PurchaseType: add cash_buyer (cannot remove 'cash' via ALTER TYPE; old rows keep old value)
ALTER TYPE "PurchaseType" ADD VALUE IF NOT EXISTS 'cash_buyer';

-- ── 2. MilestoneCompletion: add state column ──────────────────────────────────

ALTER TABLE "MilestoneCompletion" ADD COLUMN IF NOT EXISTS "state" "MilestoneState" NOT NULL DEFAULT 'locked';

-- Migrate existing boolean flags → state (only touches rows still at default 'locked')
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'MilestoneCompletion' AND column_name = 'isActive'
  ) THEN
    UPDATE "MilestoneCompletion"
      SET "state" = 'not_required'
      WHERE "state" = 'locked' AND "isNotRequired" = true;

    UPDATE "MilestoneCompletion"
      SET "state" = 'complete'
      WHERE "state" = 'locked' AND "isActive" = true AND "isNotRequired" = false;

    -- rows with isActive=false, isNotRequired=false were placeholders → leave as 'locked'
  END IF;
END $$;

-- ── 3. MilestoneCompletion: schema alignment ──────────────────────────────────

-- Make completedAt nullable (was NOT NULL DEFAULT CURRENT_TIMESTAMP)
ALTER TABLE "MilestoneCompletion" ALTER COLUMN "completedAt" DROP NOT NULL;
ALTER TABLE "MilestoneCompletion" ALTER COLUMN "completedAt" DROP DEFAULT;

-- Add confirmedByPortal
ALTER TABLE "MilestoneCompletion" ADD COLUMN IF NOT EXISTS "confirmedByPortal" BOOLEAN NOT NULL DEFAULT false;

-- Drop obsolete boolean columns
ALTER TABLE "MilestoneCompletion" DROP COLUMN IF EXISTS "isActive";
ALTER TABLE "MilestoneCompletion" DROP COLUMN IF EXISTS "isNotRequired";
ALTER TABLE "MilestoneCompletion" DROP COLUMN IF EXISTS "statusReason";

-- Upgrade non-unique index → unique constraint
DROP INDEX IF EXISTS "MilestoneCompletion_transactionId_milestoneDefinitionId_idx";
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'MilestoneCompletion_transactionId_milestoneDefinitionId_key'
  ) THEN
    ALTER TABLE "MilestoneCompletion"
      ADD CONSTRAINT "MilestoneCompletion_transactionId_milestoneDefinitionId_key"
      UNIQUE ("transactionId", "milestoneDefinitionId");
  END IF;
END $$;

-- ── 4. MilestoneDefinition: schema alignment ──────────────────────────────────

ALTER TABLE "MilestoneDefinition" ADD COLUMN IF NOT EXISTS "predecessorCode" TEXT;
ALTER TABLE "MilestoneDefinition" ADD COLUMN IF NOT EXISTS "canBeMarkedNr" "CanBeMarkedNr" NOT NULL DEFAULT 'never';

-- Change weight from INTEGER → DECIMAL(65,30) if still integer
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'MilestoneDefinition'
      AND column_name = 'weight'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE "MilestoneDefinition"
      ALTER COLUMN "weight" TYPE DECIMAL(65,30)
      USING "weight"::DECIMAL(65,30);
  END IF;
END $$;

-- Drop obsolete columns
ALTER TABLE "MilestoneDefinition" DROP COLUMN IF EXISTS "timeSensitive";
ALTER TABLE "MilestoneDefinition" DROP COLUMN IF EXISTS "isExchangeGate";
ALTER TABLE "MilestoneDefinition" DROP COLUMN IF EXISTS "isPostExchange";

-- ── 5. ReminderLog: add snoozedUntil ─────────────────────────────────────────

ALTER TABLE "ReminderLog" ADD COLUMN IF NOT EXISTS "snoozedUntil" TIMESTAMP(3);

-- ── 6. User: add missing fields ───────────────────────────────────────────────

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canViewAllFiles"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hasSeenAgentWelcome" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone"               TEXT;

-- ── 7. PropertyTransaction: add missing fields ────────────────────────────────

ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "serviceType"    "ServiceType"  NOT NULL DEFAULT 'self_managed';
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "progressedBy"   "ProgressedBy" NOT NULL DEFAULT 'progressor';
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "completionDate" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "notes"          TEXT;

-- ── 8. CommunicationRecord: add visibleToClient, soften createdById ───────────

ALTER TABLE "CommunicationRecord" ADD COLUMN IF NOT EXISTS "visibleToClient" BOOLEAN NOT NULL DEFAULT false;

-- Make createdById nullable (was NOT NULL in original migration)
DO $$ BEGIN
  ALTER TABLE "CommunicationRecord" ALTER COLUMN "createdById" DROP NOT NULL;
EXCEPTION WHEN others THEN null;
END $$;

-- ── 9. TransactionFlag table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "TransactionFlag" (
    "id"            TEXT        NOT NULL,
    "transactionId" TEXT        NOT NULL,
    "agencyId"      TEXT        NOT NULL,
    "kind"          TEXT        NOT NULL,
    "reason"        TEXT        NOT NULL,
    "resolvedAt"    TIMESTAMP(3),
    "detectedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransactionFlag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TransactionFlag_transactionId_kind_key"
    ON "TransactionFlag"("transactionId", "kind");
CREATE INDEX IF NOT EXISTS "TransactionFlag_agencyId_resolvedAt_idx"
    ON "TransactionFlag"("agencyId", "resolvedAt");
DO $$ BEGIN
  ALTER TABLE "TransactionFlag"
    ADD CONSTRAINT "TransactionFlag_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 10. FeedbackSubmission table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "FeedbackSubmission" (
    "id"                 TEXT        NOT NULL,
    "category"           TEXT        NOT NULL,
    "userId"             TEXT,
    "userRole"           TEXT,
    "userEmail"          TEXT,
    "agencyId"           TEXT,
    "field1"             TEXT,
    "field2"             TEXT,
    "url"                TEXT,
    "browser"            TEXT,
    "viewportSize"       TEXT,
    "userAgent"          TEXT,
    "screenshotUrl"      TEXT,
    "screenshotFilename" TEXT,
    "status"             TEXT        NOT NULL DEFAULT 'new',
    "emailSent"          BOOLEAN     NOT NULL DEFAULT false,
    "emailSentAt"        TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedbackSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FeedbackSubmission_status_idx"    ON "FeedbackSubmission"("status");
CREATE INDEX IF NOT EXISTS "FeedbackSubmission_userId_idx"    ON "FeedbackSubmission"("userId");
CREATE INDEX IF NOT EXISTS "FeedbackSubmission_createdAt_idx" ON "FeedbackSubmission"("createdAt" DESC);
DO $$ BEGIN
  ALTER TABLE "FeedbackSubmission"
    ADD CONSTRAINT "FeedbackSubmission_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "FeedbackSubmission"
    ADD CONSTRAINT "FeedbackSubmission_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 11. VerifiedDomain + UserVerifiedEmail tables ─────────────────────────────

CREATE TABLE IF NOT EXISTS "VerifiedDomain" (
    "id"               TEXT          NOT NULL,
    "agencyId"         TEXT          NOT NULL,
    "domain"           TEXT          NOT NULL,
    "sendgridDomainId" INTEGER       NOT NULL,
    "status"           "DomainStatus" NOT NULL DEFAULT 'pending',
    "dkimValid"        BOOLEAN       NOT NULL DEFAULT false,
    "spfValid"         BOOLEAN       NOT NULL DEFAULT false,
    "cnameRecords"     JSONB         NOT NULL,
    "lastCheckedAt"    TIMESTAMP(3),
    "verifiedAt"       TIMESTAMP(3),
    "createdByUserId"  TEXT          NOT NULL,
    "createdAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerifiedDomain_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VerifiedDomain_agencyId_domain_key"
    ON "VerifiedDomain"("agencyId", "domain");
CREATE INDEX IF NOT EXISTS "VerifiedDomain_agencyId_domain_idx"
    ON "VerifiedDomain"("agencyId", "domain");
DO $$ BEGIN
  ALTER TABLE "VerifiedDomain"
    ADD CONSTRAINT "VerifiedDomain_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "VerifiedDomain"
    ADD CONSTRAINT "VerifiedDomain_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "UserVerifiedEmail" (
    "id"                   TEXT                     NOT NULL,
    "userId"               TEXT                     NOT NULL,
    "email"                TEXT                     NOT NULL,
    "verifiedDomainId"     TEXT,
    "status"               "EmailVerificationStatus" NOT NULL DEFAULT 'pending_inbox_check',
    "verificationCodeHash" TEXT,
    "verificationToken"    TEXT,
    "verificationExpiresAt" TIMESTAMP(3),
    "verifiedAt"           TIMESTAMP(3),
    "lastUsedAt"           TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserVerifiedEmail_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserVerifiedEmail_userId_email_key"
    ON "UserVerifiedEmail"("userId", "email");
CREATE INDEX IF NOT EXISTS "UserVerifiedEmail_userId_status_idx"
    ON "UserVerifiedEmail"("userId", "status");
DO $$ BEGIN
  ALTER TABLE "UserVerifiedEmail"
    ADD CONSTRAINT "UserVerifiedEmail_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "UserVerifiedEmail"
    ADD CONSTRAINT "UserVerifiedEmail_verifiedDomainId_fkey"
    FOREIGN KEY ("verifiedDomainId") REFERENCES "VerifiedDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 12. ManualTask table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ManualTask" (
    "id"               TEXT              NOT NULL,
    "agencyId"         TEXT              NOT NULL,
    "transactionId"    TEXT,
    "title"            TEXT              NOT NULL,
    "notes"            TEXT,
    "progressorNote"   TEXT,
    "progressorNoteAt" TIMESTAMP(3),
    "status"           "ManualTaskStatus" NOT NULL DEFAULT 'open',
    "assignedToId"     TEXT,
    "dueDate"          TIMESTAMP(3),
    "isAgentRequest"   BOOLEAN           NOT NULL DEFAULT false,
    "createdById"      TEXT              NOT NULL,
    "createdAt"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ManualTask_agencyId_status_idx"  ON "ManualTask"("agencyId", "status");
CREATE INDEX IF NOT EXISTS "ManualTask_transactionId_idx"    ON "ManualTask"("transactionId");
DO $$ BEGIN
  ALTER TABLE "ManualTask"
    ADD CONSTRAINT "ManualTask_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "ManualTask"
    ADD CONSTRAINT "ManualTask_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "ManualTask"
    ADD CONSTRAINT "ManualTask_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "ManualTask"
    ADD CONSTRAINT "ManualTask_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 13. PropertyChain + ChainLink tables ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PropertyChain" (
    "id"        TEXT        NOT NULL,
    "agencyId"  TEXT        NOT NULL,
    "name"      TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyChain_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "PropertyChain"
    ADD CONSTRAINT "PropertyChain_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ChainLink" (
    "id"              TEXT        NOT NULL,
    "chainId"         TEXT        NOT NULL,
    "position"        INTEGER     NOT NULL,
    "transactionId"   TEXT,
    "externalAddress" TEXT,
    "externalStatus"  TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChainLink_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ChainLink_chainId_position_idx" ON "ChainLink"("chainId", "position");
DO $$ BEGIN
  ALTER TABLE "ChainLink"
    ADD CONSTRAINT "ChainLink_chainId_fkey"
    FOREIGN KEY ("chainId") REFERENCES "PropertyChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "ChainLink"
    ADD CONSTRAINT "ChainLink_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 14. TransactionNote table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "TransactionNote" (
    "id"            TEXT        NOT NULL,
    "transactionId" TEXT        NOT NULL,
    "content"       TEXT        NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById"   TEXT,
    CONSTRAINT "TransactionNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TransactionNote_transactionId_createdAt_idx"
    ON "TransactionNote"("transactionId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "TransactionNote"
    ADD CONSTRAINT "TransactionNote_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "TransactionNote"
    ADD CONSTRAINT "TransactionNote_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 15. TransactionDocument table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "TransactionDocument" (
    "id"            TEXT        NOT NULL,
    "transactionId" TEXT        NOT NULL,
    "contactId"     TEXT,
    "filename"      TEXT        NOT NULL,
    "storagePath"   TEXT        NOT NULL,
    "fileSize"      INTEGER     NOT NULL,
    "mimeType"      TEXT        NOT NULL,
    "source"        TEXT        NOT NULL DEFAULT 'portal',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransactionDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TransactionDocument_transactionId_createdAt_idx"
    ON "TransactionDocument"("transactionId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "TransactionDocument"
    ADD CONSTRAINT "TransactionDocument_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "TransactionDocument"
    ADD CONSTRAINT "TransactionDocument_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 16. PortalMessage table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PortalMessage" (
    "id"            TEXT        NOT NULL,
    "transactionId" TEXT        NOT NULL,
    "contactId"     TEXT        NOT NULL,
    "content"       TEXT        NOT NULL,
    "fromClient"    BOOLEAN     NOT NULL DEFAULT true,
    "sentById"      TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortalMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PortalMessage_transactionId_contactId_createdAt_idx"
    ON "PortalMessage"("transactionId", "contactId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "PortalMessage"
    ADD CONSTRAINT "PortalMessage_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "PortalMessage"
    ADD CONSTRAINT "PortalMessage_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "PortalMessage"
    ADD CONSTRAINT "PortalMessage_sentById_fkey"
    FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 17. AgencyRecommendedSolicitor table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AgencyRecommendedSolicitor" (
    "id"                      TEXT        NOT NULL,
    "agencyId"                TEXT        NOT NULL,
    "solicitorFirmId"         TEXT        NOT NULL,
    "defaultReferralFeePence" INTEGER,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgencyRecommendedSolicitor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyRecommendedSolicitor_agencyId_solicitorFirmId_key"
    ON "AgencyRecommendedSolicitor"("agencyId", "solicitorFirmId");
CREATE INDEX IF NOT EXISTS "AgencyRecommendedSolicitor_agencyId_idx"
    ON "AgencyRecommendedSolicitor"("agencyId");
DO $$ BEGIN
  ALTER TABLE "AgencyRecommendedSolicitor"
    ADD CONSTRAINT "AgencyRecommendedSolicitor_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "AgencyRecommendedSolicitor"
    ADD CONSTRAINT "AgencyRecommendedSolicitor_solicitorFirmId_fkey"
    FOREIGN KEY ("solicitorFirmId") REFERENCES "SolicitorFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 18. NextAuth tables (usually empty but schema requires them) ───────────────

CREATE TABLE IF NOT EXISTS "Account" (
    "id"                TEXT    NOT NULL,
    "userId"            TEXT    NOT NULL,
    "type"              TEXT    NOT NULL,
    "provider"          TEXT    NOT NULL,
    "providerAccountId" TEXT    NOT NULL,
    "refresh_token"     TEXT,
    "access_token"      TEXT,
    "expires_at"        INTEGER,
    "token_type"        TEXT,
    "scope"             TEXT,
    "id_token"          TEXT,
    "session_state"     TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key"
    ON "Account"("provider", "providerAccountId");
DO $$ BEGIN
  ALTER TABLE "Account"
    ADD CONSTRAINT "Account_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Session" (
    "id"           TEXT        NOT NULL,
    "sessionToken" TEXT        NOT NULL,
    "userId"       TEXT        NOT NULL,
    "expires"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");
DO $$ BEGIN
  ALTER TABLE "Session"
    ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT        NOT NULL,
    "token"      TEXT        NOT NULL,
    "expires"    TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key"
    ON "VerificationToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key"
    ON "VerificationToken"("identifier", "token");
