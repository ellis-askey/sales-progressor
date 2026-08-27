-- Note B: helper/representative contacts. Additive, defaults keep existing
-- contacts as named principals with portal access (no behaviour change).
-- See docs/active/three-notes-distilled-2026-08-27.md.
ALTER TABLE "Contact" ADD COLUMN "isPrincipal" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Contact" ADD COLUMN "portalEligible" BOOLEAN NOT NULL DEFAULT true;
