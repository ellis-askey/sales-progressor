-- Migration: add_event_table
-- Unified activity Event table for the command centre.
-- Append-only; never update or delete rows.
-- Safe to re-run (idempotent).

DO $$ BEGIN
  CREATE TYPE "EventType" AS ENUM (
    'user_logged_in', 'user_logged_out', 'user_invited', 'user_accepted_invite',
    'password_reset_requested', 'password_reset_completed',
    'agency_created', 'agency_mode_changed', 'agency_archived',
    'transaction_created', 'transaction_archived', 'transaction_status_changed',
    'milestone_confirmed', 'milestone_marked_not_required', 'milestone_reversed',
    'exchange_gate_unlocked', 'contracts_exchanged', 'sale_completed',
    'chase_sent', 'chase_message_generated', 'email_parse_attempted',
    'file_uploaded', 'file_deleted',
    'feedback_submitted',
    'admin_logged_in', 'admin_action_performed'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Event" (
  "id"             TEXT         NOT NULL,
  "occurredAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "agencyId"       TEXT,
  "userId"         TEXT,
  "isInternalUser" BOOLEAN      NOT NULL DEFAULT false,
  "type"           "EventType"  NOT NULL,
  "entityType"     TEXT,
  "entityId"       TEXT,
  "metadata"       JSONB,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Event_occurredAt_idx"          ON "Event"("occurredAt");
CREATE INDEX IF NOT EXISTS "Event_agencyId_occurredAt_idx" ON "Event"("agencyId", "occurredAt");
CREATE INDEX IF NOT EXISTS "Event_type_occurredAt_idx"     ON "Event"("type", "occurredAt");
CREATE INDEX IF NOT EXISTS "Event_userId_occurredAt_idx"   ON "Event"("userId", "occurredAt");
