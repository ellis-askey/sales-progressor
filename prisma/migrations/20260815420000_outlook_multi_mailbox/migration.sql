-- Allow multiple Outlook mailboxes per user: replace the single-mailbox
-- unique(userId) with a composite unique(userId, microsoftUserId).

-- DropIndex
DROP INDEX "OutlookConnection_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "OutlookConnection_userId_microsoftUserId_key" ON "OutlookConnection"("userId", "microsoftUserId");
