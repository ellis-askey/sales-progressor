-- Staff PWA adoption: mirror the Contact pwaInstalledAt / pwaLastOpenedAt fields
-- onto User, so we can see which team members run the app installed to their
-- home screen. Stamped by /api/agent/pwa on standalone open / appinstalled.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pwaInstalledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pwaLastOpenedAt" TIMESTAMP(3);
