-- Per-client sign-off for an external progression business: how its own
-- correspondence (solicitor + enquiry chases, emails sent from a file) signs off
-- on a given client agency's sales. Reuses the existing "EmailSignatureMode" enum.
-- Additive only; BASIC default preserves today's auto sign-off for every link.
ALTER TABLE "ProgressionBusinessClient" ADD COLUMN "signatureMode" "EmailSignatureMode" NOT NULL DEFAULT 'BASIC';
ALTER TABLE "ProgressionBusinessClient" ADD COLUMN "signatureImagePath" TEXT;
ALTER TABLE "ProgressionBusinessClient" ADD COLUMN "signatureHtml" TEXT;
