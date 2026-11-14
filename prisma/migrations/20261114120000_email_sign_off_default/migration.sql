-- Per-user default sign-off phrase (New email + chase), above the signature block.
ALTER TABLE "User" ADD COLUMN "emailSignOff" TEXT NOT NULL DEFAULT 'Kind regards,';

-- Per-client sign-off phrase for an external progression business.
ALTER TABLE "ProgressionBusinessClient" ADD COLUMN "signOff" TEXT NOT NULL DEFAULT 'Kind regards,';
