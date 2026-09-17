-- Reconnect UX + sync visibility: per-mailbox health on OutlookConnection.
-- Additive, all safe defaults. (ImapConnection already has lastSyncedAt/lastError.)
ALTER TABLE "OutlookConnection" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "OutlookConnection" ADD COLUMN "lastError" TEXT;
ALTER TABLE "OutlookConnection" ADD COLUMN "needsReconnect" BOOLEAN NOT NULL DEFAULT false;
