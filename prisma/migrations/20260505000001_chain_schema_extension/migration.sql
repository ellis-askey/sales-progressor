-- Chain feature schema extension (Chunk 1)
-- Extends PropertyChain, ChainLink, PropertyTransaction, User
-- All changes are additive — no existing columns renamed or removed.

-- ─── New Enums ────────────────────────────────────────────────────────────────

CREATE TYPE "ChainStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "InviteStatus" AS ENUM ('NOT_SENT', 'SENT', 'BOUNCED', 'CLAIMED', 'DECLINED');
CREATE TYPE "ChainHoldStatus" AS ENUM ('ON_HOLD', 'INCOMPLETE');
CREATE TYPE "ChainWithdrawalStatus" AS ENUM ('WITHDRAWN', 'REMARKETING', 'WAITING');

-- ─── Extend PropertyChain ────────────────────────────────────────────────────

ALTER TABLE "PropertyChain" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "PropertyChain" ADD COLUMN "status" "ChainStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "PropertyChain" ADD COLUMN "holdStatus" "ChainHoldStatus";

-- ─── Extend ChainLink ────────────────────────────────────────────────────────

ALTER TABLE "ChainLink" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "ChainLink" ADD COLUMN "claimedByUserId" TEXT;
ALTER TABLE "ChainLink" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "ChainLink" ADD COLUMN "stubPropertyAddress" TEXT;
ALTER TABLE "ChainLink" ADD COLUMN "stubAgencyName" TEXT;
ALTER TABLE "ChainLink" ADD COLUMN "stubAgentEmail" TEXT;
ALTER TABLE "ChainLink" ADD COLUMN "stubAgentName" TEXT;
ALTER TABLE "ChainLink" ADD COLUMN "stubAgentPhone" TEXT;
ALTER TABLE "ChainLink" ADD COLUMN "stubNotes" TEXT;
ALTER TABLE "ChainLink" ADD COLUMN "inviteStatus" "InviteStatus" NOT NULL DEFAULT 'NOT_SENT';
ALTER TABLE "ChainLink" ADD COLUMN "inviteToken" TEXT;
ALTER TABLE "ChainLink" ADD COLUMN "inviteSentAt" TIMESTAMP(3);
ALTER TABLE "ChainLink" ADD COLUMN "inviteBouncedAt" TIMESTAMP(3);
ALTER TABLE "ChainLink" ADD COLUMN "inviteDeclinedAt" TIMESTAMP(3);
ALTER TABLE "ChainLink" ADD COLUMN "inviteResendCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ChainLink" ADD COLUMN "lastInviteSentByUserId" TEXT;
ALTER TABLE "ChainLink" ADD COLUMN "withdrawalStatus" "ChainWithdrawalStatus";
ALTER TABLE "ChainLink" ADD COLUMN "withdrawalRespondedAt" TIMESTAMP(3);

-- ─── Extend PropertyTransaction ──────────────────────────────────────────────

ALTER TABLE "PropertyTransaction" ADD COLUMN "chainLinkId" TEXT;

-- ─── Unique constraints ───────────────────────────────────────────────────────

ALTER TABLE "ChainLink" ADD CONSTRAINT "ChainLink_inviteToken_key" UNIQUE ("inviteToken");
ALTER TABLE "PropertyTransaction" ADD CONSTRAINT "PropertyTransaction_chainLinkId_key" UNIQUE ("chainLinkId");

-- Upgrade (chainId, position) from plain index to unique constraint
DROP INDEX IF EXISTS "ChainLink_chainId_position_idx";
ALTER TABLE "ChainLink" ADD CONSTRAINT "ChainLink_chainId_position_key" UNIQUE ("chainId", "position");

-- ─── Foreign key constraints ─────────────────────────────────────────────────

ALTER TABLE "PropertyChain"
  ADD CONSTRAINT "PropertyChain_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChainLink"
  ADD CONSTRAINT "ChainLink_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChainLink"
  ADD CONSTRAINT "ChainLink_claimedByUserId_fkey"
  FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChainLink"
  ADD CONSTRAINT "ChainLink_lastInviteSentByUserId_fkey"
  FOREIGN KEY ("lastInviteSentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Circular FK: PropertyTransaction.chainLinkId → ChainLink.id
-- Safe because both columns are nullable; inserts can set null initially,
-- then update both sides atomically in a transaction.
ALTER TABLE "PropertyTransaction"
  ADD CONSTRAINT "PropertyTransaction_chainLinkId_fkey"
  FOREIGN KEY ("chainLinkId") REFERENCES "ChainLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── New indexes ──────────────────────────────────────────────────────────────

CREATE INDEX "ChainLink_transactionId_idx" ON "ChainLink"("transactionId");
CREATE INDEX "ChainLink_claimedByUserId_idx" ON "ChainLink"("claimedByUserId");
CREATE INDEX "ChainLink_stubAgentEmail_idx" ON "ChainLink"("stubAgentEmail");
CREATE INDEX "PropertyChain_createdByUserId_idx" ON "PropertyChain"("createdByUserId");
