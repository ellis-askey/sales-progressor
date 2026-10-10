-- House-style email theme for a progression business's client-facing emails.
-- Additive, nullable JSONB — same shape/whitelist as "Agency"."emailTheme".
-- Safe on prod: no default backfill, no data touched; null = inherit platform.
ALTER TABLE "ProgressionBusiness" ADD COLUMN "emailTheme" JSONB;
