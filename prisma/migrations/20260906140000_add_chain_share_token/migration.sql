-- Manual chain share link (see ChainLink.shareToken in schema.prisma).
-- Separate from inviteToken so email resends never rotate a shared link and
-- hand-shared links can be measured apart from emailed invites.

-- AlterTable
ALTER TABLE "ChainLink"
  ADD COLUMN "shareToken" TEXT,
  ADD COLUMN "shareTokenCreatedAt" TIMESTAMP(3),
  ADD COLUMN "shareLinkFirstViewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ChainLink_shareToken_key" ON "ChainLink"("shareToken");
