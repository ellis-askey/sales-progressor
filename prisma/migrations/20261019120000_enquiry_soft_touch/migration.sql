-- Enquiries soft-touch breather (critique #282).
-- A "still with them" / "solicitors have spoken" signal (no replies actually
-- landed) now buys a short breather via lastTouchAt WITHOUT resetting the
-- escalation clock (which anchors on lastMovementAt), so a loop that keeps being
-- acknowledged still escalates on schedule. "solicitors_spoken" is its own
-- movement kind for the history. Additive only; no data change.
ALTER TABLE "EnquiryTracker" ADD COLUMN IF NOT EXISTS "lastTouchAt" TIMESTAMP(3);
ALTER TYPE "EnquiryMovementKind" ADD VALUE IF NOT EXISTS 'solicitors_spoken';
