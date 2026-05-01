-- Migration: add_command_indexes
-- Final index sweep ensuring all ADMIN_02 §8 required indexes exist.
-- All indexes from earlier migrations are already idempotent.
-- This migration adds the one remaining index: PropertyTransaction(serviceType, createdAt).
-- Safe to re-run (idempotent).

CREATE INDEX IF NOT EXISTS "PropertyTransaction_serviceType_createdAt_idx"
  ON "PropertyTransaction"("serviceType", "createdAt");
