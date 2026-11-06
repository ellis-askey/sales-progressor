-- PendingInboundEmail: store the RFC Message-ID (invariant across folder moves)
-- so a later sync can auto-resolve a stale "Needs filing" card once the same
-- email has been filed onto a property. The provider id changes when a message
-- is moved between folders; the Message-ID does not.
ALTER TABLE "PendingInboundEmail" ADD COLUMN IF NOT EXISTS "internetMessageId" TEXT;

CREATE INDEX IF NOT EXISTS "PendingInboundEmail_userId_internetMessageId_idx"
  ON "PendingInboundEmail" ("userId", "internetMessageId");
