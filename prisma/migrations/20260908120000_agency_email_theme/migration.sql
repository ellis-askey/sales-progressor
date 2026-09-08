-- Client-email brand theme (hero band + CTA button + links + footer), set in the
-- branding studio. JSON blob; null → Sales Progressor coral defaults.
ALTER TABLE "Agency" ADD COLUMN "emailTheme" JSONB;
