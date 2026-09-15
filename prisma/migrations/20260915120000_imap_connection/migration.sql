-- IMAP mailbox connections (Gmail via app-password, Yahoo, custom domains, and
-- any other IMAP provider). Feeds the same match/ingest core as Outlook. The
-- app-password is stored encrypted (token-crypto), never in plaintext.
CREATE TABLE "ImapConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'imap',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 993,
    "secure" BOOLEAN NOT NULL DEFAULT true,
    "encryptedPassword" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImapConnection_pkey" PRIMARY KEY ("id")
);

-- One row per (user, mailbox): reconnecting the same mailbox updates it.
CREATE UNIQUE INDEX "ImapConnection_userId_email_key" ON "ImapConnection"("userId", "email");
CREATE INDEX "ImapConnection_userId_idx" ON "ImapConnection"("userId");

ALTER TABLE "ImapConnection" ADD CONSTRAINT "ImapConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
