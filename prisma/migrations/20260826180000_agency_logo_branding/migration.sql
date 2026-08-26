-- Email-branding presentation for the agency logo (branding studio).
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "logoTileColor" TEXT;
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "logoScale" TEXT;
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "logoAlign" TEXT;
