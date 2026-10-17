-- Dual-linked step confirmations (#279): mark the auto-completed MIRROR half of a
-- pair (contract pack, enquiries raised/satisfied, exchange, completion) so the
-- agent activity feed shows ONE entry per bilateral confirm, not two. The
-- directly-confirmed side stays false. Client portals are unaffected.
ALTER TABLE "MilestoneCompletion" ADD COLUMN "reflected" BOOLEAN NOT NULL DEFAULT false;
