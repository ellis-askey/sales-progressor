-- Stamp whether an agency's quoteSenderEmail can actually send in SendGrid.
-- Refreshed nightly by the check-domains cron; read by the sender resolver so
-- it never sends from an unverified address (falls back to Sales Progressor).
ALTER TABLE "Agency" ADD COLUMN "quoteSenderVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agency" ADD COLUMN "quoteSenderVerifiedAt" TIMESTAMP(3);
