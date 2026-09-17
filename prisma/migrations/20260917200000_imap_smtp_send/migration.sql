-- Mailbox sending (SMTP) on IMAP connections.
-- Additive only: new nullable columns + NOT NULL columns with defaults, so
-- existing rows are unaffected. Sending stays off (sendEnabled false) for every
-- existing connection until the agent opts in and the SMTP login is verified.

ALTER TABLE "ImapConnection" ADD COLUMN "sendEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ImapConnection" ADD COLUMN "smtpHost" TEXT;
ALTER TABLE "ImapConnection" ADD COLUMN "smtpPort" INTEGER NOT NULL DEFAULT 465;
ALTER TABLE "ImapConnection" ADD COLUMN "smtpSecure" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ImapConnection" ADD COLUMN "smtpVerifiedAt" TIMESTAMP(3);
ALTER TABLE "ImapConnection" ADD COLUMN "smtpLastError" TEXT;
ALTER TABLE "ImapConnection" ADD COLUMN "smtpFailCount" INTEGER NOT NULL DEFAULT 0;
