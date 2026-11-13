-- Email threading (Stage 2): store the full To-recipient list on a sent message
-- so the "continue conversation" whisper can recognise a prior email to the same
-- group of people. Additive + idempotent; empty default means every existing row
-- is unchanged and non-threaded sends simply leave it empty.
ALTER TABLE "OutboundMessage"
  ADD COLUMN IF NOT EXISTS "recipientEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
