-- The actual From header used at send time ("Name <email>"), so a later
-- "view email" shows who it really came from rather than re-deriving the sender
-- from the file's current brand (critique #298B). Additive + nullable; existing
-- rows read null and the viewer falls back to resolving today's sender.
ALTER TABLE "OutboundMessage" ADD COLUMN IF NOT EXISTS "sentFromEmail" TEXT;
