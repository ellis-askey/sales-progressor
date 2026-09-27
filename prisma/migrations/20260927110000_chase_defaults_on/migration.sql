-- Chase automations should be ON by default for agencies. They were shipped
-- defaulting false, which meant new agencies never chased until someone toggled
-- them in the Command Centre - defeating the point. Chasing is the core of what
-- an agency signs up for, and every chase engine still gates on the required
-- details (solicitor/client emails) plus the global SolicitorChaseSettings
-- kill switch, so enabling by default cannot chase without the info being in.

-- 1. New agencies chase out of the box.
ALTER TABLE "Agency" ALTER COLUMN "solicitorChaseEnabled" SET DEFAULT true;
ALTER TABLE "Agency" ALTER COLUMN "enquiryReplyChaseEnabled" SET DEFAULT true;
ALTER TABLE "Agency" ALTER COLUMN "enquiryRaiseChaseEnabled" SET DEFAULT true;

-- 2. Backfill existing agencies (they were meant to be on all along).
UPDATE "Agency"
SET "solicitorChaseEnabled" = true,
    "enquiryReplyChaseEnabled" = true,
    "enquiryRaiseChaseEnabled" = true;
