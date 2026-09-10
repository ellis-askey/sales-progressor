-- Per-person pause on step-confirmation emails, independent of the chase pause
-- (emailsPausedAt). The file-wide suppressPortalConfirmEmails stays the master.
ALTER TABLE "Contact" ADD COLUMN "stepConfirmPausedAt" TIMESTAMP(3);
