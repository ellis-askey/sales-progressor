-- Internal-note OutboundMessage rows (portal views, manual logs, activity) were
-- created without a purpose, so they inherited the default 'chase' and read as
-- sent chases in the Command Centre Messages view. Relabel them:
--   portal views -> notification (they are a notification, not a chase)
--   every other internal note -> other (it's an internal note, not a chase)
-- Going forward the portal-view logger sets purpose='notification' at creation.

UPDATE "OutboundMessage"
SET purpose = 'notification'
WHERE type = 'internal_note'
  AND purpose = 'chase'
  AND content ILIKE '%viewed their client portal%';

UPDATE "OutboundMessage"
SET purpose = 'other'
WHERE type = 'internal_note'
  AND purpose = 'chase';
