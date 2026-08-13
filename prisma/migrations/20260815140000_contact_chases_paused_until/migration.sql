-- Client-set timed pause on chase emails (audit #11 / #15). Nullable; a future
-- date pauses chases until it passes, then auto-resumes. Additive; apply
-- staging-first, verify, then production.
ALTER TABLE "Contact" ADD COLUMN "chasesPausedUntil" TIMESTAMP(3);
