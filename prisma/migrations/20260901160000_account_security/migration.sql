-- Account security: per-user session invalidation ("sign out of all other
-- devices") + hashed TOTP backup/recovery codes. Additive, safe to deploy.
ALTER TABLE "User"
  ADD COLUMN "totpBackupCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
