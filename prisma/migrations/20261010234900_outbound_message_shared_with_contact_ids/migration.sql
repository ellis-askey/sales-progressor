-- Explicit "who can see this" audience for a client-shared comm, decoupled from
-- contactIds (who the comm was with). Empty on legacy rows + internal comms; the
-- portal read falls back to the old contactIds-based side scoping when empty.
ALTER TABLE "OutboundMessage" ADD COLUMN "sharedWithContactIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
