-- Per-agency chase-stream switches. Default off so a NEW agency never
-- auto-chases until switched on in the Command Centre. Existing agencies are
-- migrated to on to preserve the previous global-on behaviour exactly.
ALTER TABLE "Agency" ADD COLUMN "solicitorChaseEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agency" ADD COLUMN "enquiryReplyChaseEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agency" ADD COLUMN "enquiryRaiseChaseEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Agency"
SET "solicitorChaseEnabled" = true,
    "enquiryReplyChaseEnabled" = true,
    "enquiryRaiseChaseEnabled" = true;

-- Landmine fix: the global master switch now defaults off so a recreated
-- singleton can't silently arm every agency. The live row is untouched.
ALTER TABLE "SolicitorChaseSettings" ALTER COLUMN "enabledByDefault" SET DEFAULT false;
