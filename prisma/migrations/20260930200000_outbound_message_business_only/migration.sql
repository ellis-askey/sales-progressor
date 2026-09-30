-- Progression-business private notes (docs/active/progression-businesses/, Phase 6).
-- Additive: one boolean, NOT NULL DEFAULT false. Every existing note keeps
-- today's visibility (visible to anyone who can open the file). Only an external
-- progression-business member ever sets it true; the read filter then hides such
-- notes from the owning agency's staff. See lib/services/comms.ts.

ALTER TABLE "OutboundMessage" ADD COLUMN "businessOnly" BOOLEAN NOT NULL DEFAULT false;
