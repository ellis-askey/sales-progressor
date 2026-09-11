-- Portal Engagement v2, Phase 2: install + notifications funnel event types.
-- Additive enum values only; no data change, no column change.
-- See docs/active/portal-engagement-v2/phase-1-spec.md (Phase 2 is tracked there
-- for now) and the Phase 2 prompt rework.

-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'portal_install_prompt_shown';
ALTER TYPE "EventType" ADD VALUE 'portal_install_completed';
ALTER TYPE "EventType" ADD VALUE 'portal_install_dismissed';
ALTER TYPE "EventType" ADD VALUE 'portal_notif_prompt_shown';
ALTER TYPE "EventType" ADD VALUE 'portal_notif_enabled';
ALTER TYPE "EventType" ADD VALUE 'portal_notif_dismissed';
