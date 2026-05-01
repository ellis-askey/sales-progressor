-- Migration: add_outbound_check_constraint
-- Adds CHECK constraint to OutboundMessage specified in ADMIN_02 §4 but
-- omitted from extend_outbound (PR 4). Added as a separate atomic migration.
--
-- Uses purpose enum (ADMIN_02 §4's own recommendation) instead of the
-- brittle subject='Password reset' clause shown in the spec literal.
-- The purpose enum already exists from PR 4.
--
-- Constraint intent: chase emails (channel=email, purpose=chase) MUST have
-- a transactionId. Only legitimately transactionless purposes are allowed
-- to have a NULL transactionId.
--
-- Safe to re-run (idempotent via pg_constraint check).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outbound_transaction_required'
      AND conrelid = '"OutboundMessage"'::regclass
  ) THEN
    ALTER TABLE "OutboundMessage"
      ADD CONSTRAINT "outbound_transaction_required"
      CHECK (
        "transactionId" IS NOT NULL
        OR "channel" IN ('linkedin', 'twitter', 'in_app', 'other')
        OR "purpose" IN ('password_reset', 'retention_email', 'digest', 'scheduled_post', 'notification')
      );
  END IF;
END $$;
