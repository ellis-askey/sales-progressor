-- Track "I won't be using the portal" clicks on the new-sale form.
--
-- Two columns on User:
--   - portalInviteSkipCount: total clicks across all sessions for this user
--     (the prompt sessionStorages a dismissal flag so one user clicks
--     ~once per session, but a re-login / different browser will recount;
--     so this is "lifetime click count" not "unique sessions").
--   - lastPortalInviteSkipAt: timestamp of the most recent click.
--
-- Surfaced to internal staff on /command/overview as a "portal opt-out"
-- widget. No business logic gates anything on these fields — they are
-- pure telemetry.

ALTER TABLE "User"
  ADD COLUMN "portalInviteSkipCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastPortalInviteSkipAt" TIMESTAMP(3);
