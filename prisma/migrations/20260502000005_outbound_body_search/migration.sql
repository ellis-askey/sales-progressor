-- Migration: outbound_body_search
-- Adds full-text search capability to OutboundMessage per ADMIN_04 §6.
-- Uses pg_trgm for partial matching on recipient fields,
-- and tsvector generated column for body/subject full-text search.
--
-- Apply to staging first; the tsvector column backfill blocks briefly
-- on large tables but is instant on empty/small tables.

-- Enable pg_trgm extension for partial recipient matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- tsvector generated column for body + subject full-text search
ALTER TABLE "OutboundMessage"
  ADD COLUMN IF NOT EXISTS "bodySearch" tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce("subject", '') || ' ' || coalesce("content", '')
      )
    ) STORED;

-- GIN index on the tsvector column
CREATE INDEX IF NOT EXISTS outbound_body_search_idx
  ON "OutboundMessage" USING GIN ("bodySearch");

-- Trigram indexes for partial recipient matching (ADMIN_04 §6)
CREATE INDEX IF NOT EXISTS outbound_recipient_email_trgm_idx
  ON "OutboundMessage" USING GIN ("recipientEmail" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS outbound_recipient_name_trgm_idx
  ON "OutboundMessage" USING GIN ("recipientName" gin_trgm_ops);
