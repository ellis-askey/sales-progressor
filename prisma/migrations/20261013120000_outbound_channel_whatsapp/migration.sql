-- WhatsApp becomes a first-class outbound channel (Phase 3, REBUILD_PLAN §C1),
-- ending the channel:'other' hack from the Baileys era. Kept in its own
-- migration (separate transaction) because the next migration's partial index
-- references this value — Postgres forbids using a new enum value in the same
-- transaction that adds it.
ALTER TYPE "OutboundChannel" ADD VALUE IF NOT EXISTS 'whatsapp';
