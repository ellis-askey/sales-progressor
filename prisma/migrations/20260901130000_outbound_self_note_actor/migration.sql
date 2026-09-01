-- Client self-note per-viewer rendering.
-- Store the acting contact and the second-person ("You updated…") text so one
-- shared OutboundMessage row can read "You updated…" to the actor and
-- "Lauren updated…" to co-clients on the portal. Both nullable, no backfill:
-- existing rows keep rendering `content` as-is.
ALTER TABLE "OutboundMessage" ADD COLUMN "selfNoteActorContactId" TEXT;
ALTER TABLE "OutboundMessage" ADD COLUMN "selfNoteSelfText" TEXT;
