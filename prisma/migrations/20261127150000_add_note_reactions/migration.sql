-- Emoji reactions on Activity-feed notes and threaded replies. Stored on the
-- OutboundMessage row as an aggregated JSON array of { emoji, users[] } (user
-- ids who reacted). Nullable + additive: existing rows read as "no reactions"
-- and the app parses a missing/null value to []. Applied to staging via
-- `db push`; prod applies via this migration on `migrate deploy`.

ALTER TABLE "OutboundMessage" ADD COLUMN "reactions" JSONB;
