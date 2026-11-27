-- Network connect handshake: agency-initiated direction + optional message on the
-- connection request, and connection-source attribution on the client link.
-- Additive + non-destructive. See docs/active/progressor-network/SPEC.md (P2).
ALTER TABLE "ProgressionConnectionRequest" ADD COLUMN "initiatedBy" TEXT NOT NULL DEFAULT 'business';
ALTER TABLE "ProgressionConnectionRequest" ADD COLUMN "message" TEXT;
ALTER TABLE "ProgressionBusinessClient" ADD COLUMN "source" TEXT;
