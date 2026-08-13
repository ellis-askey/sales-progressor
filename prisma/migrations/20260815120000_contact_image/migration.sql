-- Client profile photo (audit #16, phase 2). Nullable, full public Supabase
-- Storage URL — same shape as "User"."image". Safe additive column; existing
-- rows keep NULL (render sites fall back to initials, then the generic
-- client silhouette). Apply to staging first, verify, then production.
ALTER TABLE "Contact" ADD COLUMN "image" TEXT;
