-- Per-file opt-out of enquiry auto-chasing (raise nudges + reply-loop chase).
-- Distinct from the broader per-solicitor email pause. Off by default = chasing on.
ALTER TABLE "PropertyTransaction" ADD COLUMN "enquiryChasePaused" BOOLEAN NOT NULL DEFAULT false;
