-- Migration: add_command_user_totp
-- Adds TOTP fields to User for command centre step-up auth (Phase 2).
-- totpSecret: AES-256-CBC encrypted OTP secret, format iv_hex:ciphertext_hex.
-- totpActivatedAt: set when user completes enrollment; NULL = not enrolled.
-- Safe to re-run (idempotent).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name  = 'User'
      AND column_name = 'totpSecret'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name  = 'User'
      AND column_name = 'totpActivatedAt'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "totpActivatedAt" TIMESTAMPTZ;
  END IF;
END $$;
