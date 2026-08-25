-- Chain-invite conversion funnel (Phase 0): record where invited agents drop off.
--   inviteFirstViewedAt — first time the invited agent opened the /claim landing
--                         page (they clicked through from the email).
--   claimStartedAt      — first time they reached a claim step (signup / login /
--                         confirm), i.e. clicked "Claim this sale".
-- Both are set once and never cleared. Source of truth for the Command Centre
-- "Chain invites" funnel dashboard.
ALTER TABLE "ChainLink" ADD COLUMN "inviteFirstViewedAt" TIMESTAMP(3);
ALTER TABLE "ChainLink" ADD COLUMN "claimStartedAt" TIMESTAMP(3);
