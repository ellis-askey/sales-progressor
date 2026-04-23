-- Add fall-through reason field to PropertyTransaction
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "fallThroughReason" TEXT;
