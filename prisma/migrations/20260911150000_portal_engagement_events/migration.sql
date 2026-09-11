-- Portal Engagement v2, Phase 1: client-side engagement event types.
-- Additive enum values only; no data change, no column change.
-- See docs/active/portal-engagement-v2/phase-1-spec.md §4.

-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'portal_returned';
ALTER TYPE "EventType" ADD VALUE 'portal_section_viewed';
ALTER TYPE "EventType" ADD VALUE 'portal_recap_item_clicked';
ALTER TYPE "EventType" ADD VALUE 'portal_action_confirmed';
ALTER TYPE "EventType" ADD VALUE 'portal_service_surfaced';
ALTER TYPE "EventType" ADD VALUE 'portal_service_clicked';
