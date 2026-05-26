-- Reminder rule corrections — two existing ReminderRule rows have their
-- anchor / graceDays updated to match the corrected seed in prisma/seed.ts.
-- Both are anchor/grace edits only; targetMilestoneCode and name are
-- unchanged (the buyer/seller suffix in the rule name stays in the data;
-- the UI strips it at render time via RemindersSection.stripChase).
--
-- 1. "Chase: Contract documents issued to seller"
--    Re-anchor from VM7 (draft contract pack issued) to PM20 (buyer's
--    solicitor confirmed all enquiries satisfied). Symptom on prod: the
--    chase fired 3 days after the draft contract pack went out, while
--    enquiries were still in flight on the buyer side. Per Ellis: agents
--    should not be chasing contract docs until the buyer side has cleared
--    enquiries.
--
-- 2. "Chase: Management pack received (buyer)"
--    Re-anchor from VM9 (seller-side mgmt pack received) to VM8 (seller
--    ordered the mgmt pack), and bump graceDays from 3 → 14. Per Ellis:
--    14 days after the seller orders the pack is when we start chasing
--    the buyer-side receipt — not 3 days after the seller has received it.
--
-- Idempotent: the WHERE clauses target rule rows by name, so re-running is
-- safe (the second run finds the already-corrected values and is a no-op
-- for the values being set, since UPDATE writes the same values back).

UPDATE "ReminderRule"
SET "anchorMilestoneId" = (SELECT id FROM "MilestoneDefinition" WHERE code = 'PM20')
WHERE name = 'Chase: Contract documents issued to seller';

UPDATE "ReminderRule"
SET "anchorMilestoneId" = (SELECT id FROM "MilestoneDefinition" WHERE code = 'VM8'),
    "graceDays"         = 14
WHERE name = 'Chase: Management pack received (buyer)';
