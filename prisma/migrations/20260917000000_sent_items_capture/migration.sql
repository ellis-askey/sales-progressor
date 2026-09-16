-- Complete Email History (Phase 2): Sent-Items capture.
-- Additive only — new nullable columns + one NOT NULL column with a default, so
-- existing rows are unaffected. The feature stays dark behind SENT_ITEMS_ENABLED.

-- Forward cursor so Sent capture moves incrementally after the first 30-day sync.
ALTER TABLE "OutlookConnection" ADD COLUMN "lastSentSyncAt" TIMESTAMP(3);
ALTER TABLE "ImapConnection" ADD COLUMN "lastSentSyncAt" TIMESTAMP(3);

-- Direction-aware "Needs filing" tray: inbound (From:) vs outbound/sent (To:).
ALTER TABLE "PendingInboundEmail" ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'inbound';
ALTER TABLE "PendingInboundEmail" ADD COLUMN "toEmail" TEXT;
ALTER TABLE "PendingInboundEmail" ADD COLUMN "toName" TEXT;
