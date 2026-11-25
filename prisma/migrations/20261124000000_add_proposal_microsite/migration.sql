-- Boardwalk partnership proposal microsite — isolated analytics + access tables.
-- Apply to STAGING first (Law 3), verify, then production. Safe/additive: only
-- creates new tables, touches nothing in the operational schema.

-- CreateTable
CREATE TABLE "ProposalAccess" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "sessionEpoch" INTEGER NOT NULL DEFAULT 1,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalInvitation" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalSession" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "invitationId" TEXT,
    "ipHash" TEXT,
    "country" TEXT,
    "region" TEXT,
    "device" TEXT,
    "browser" TEXT,
    "userAgent" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reachedClose" BOOLEAN NOT NULL DEFAULT false,
    "downloadedPdf" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProposalSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalEvent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sessionId" TEXT,
    "invitationId" TEXT,
    "kind" TEXT NOT NULL,
    "sectionId" TEXT,
    "detail" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalAuthAttempt" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalAuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProposalAccess_slug_key" ON "ProposalAccess"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalInvitation_token_key" ON "ProposalInvitation"("token");

-- CreateIndex
CREATE INDEX "ProposalInvitation_slug_idx" ON "ProposalInvitation"("slug");

-- CreateIndex
CREATE INDEX "ProposalInvitation_token_idx" ON "ProposalInvitation"("token");

-- CreateIndex
CREATE INDEX "ProposalSession_slug_startedAt_idx" ON "ProposalSession"("slug", "startedAt");

-- CreateIndex
CREATE INDEX "ProposalSession_invitationId_idx" ON "ProposalSession"("invitationId");

-- CreateIndex
CREATE INDEX "ProposalEvent_slug_occurredAt_idx" ON "ProposalEvent"("slug", "occurredAt");

-- CreateIndex
CREATE INDEX "ProposalEvent_sessionId_idx" ON "ProposalEvent"("sessionId");

-- CreateIndex
CREATE INDEX "ProposalEvent_kind_occurredAt_idx" ON "ProposalEvent"("kind", "occurredAt");

-- CreateIndex
CREATE INDEX "ProposalAuthAttempt_slug_ipHash_createdAt_idx" ON "ProposalAuthAttempt"("slug", "ipHash", "createdAt");

-- AddForeignKey
ALTER TABLE "ProposalSession" ADD CONSTRAINT "ProposalSession_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "ProposalInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalEvent" ADD CONSTRAINT "ProposalEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProposalSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalEvent" ADD CONSTRAINT "ProposalEvent_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "ProposalInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
