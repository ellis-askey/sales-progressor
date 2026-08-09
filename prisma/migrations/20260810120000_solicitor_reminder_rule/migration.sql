-- Per-step solicitor chase cadence.
--
-- Replaces the flat "grace 5wd / repeat 7d / cap 2" from SolicitorChaseSettings
-- with per-milestone tuning. Each row: one solicitor-owned milestone code,
-- its own grace + repeat + max chases + active flag.
--
-- Custom anchors: `anchorMilestoneCode` overrides "chase clock starts from
-- direct prerequisite". Null = fall back to direct-prereq behaviour.
-- `useAnchorEventDate` = anchor on the referenced milestone's eventDate
-- instead of its completedAt (for PM11 mortgage-offer, anchored on the
-- lender valuation event date). Falls back to completedAt when eventDate
-- is null (e.g. desktop valuations, so no visit was booked).
--
-- Repeat is now in WORKING days (not calendar days) — matches how solicitors
-- experience the cadence. Sends stay Mon-Fri only via the existing cron
-- schedule (0 9 * * 1-5) plus a belt-and-braces day-of-week check in the
-- send code (see lib/solicitor-confirm/chase.ts).
--
-- SolicitorChaseSettings singleton retained as the global fallback for
-- codes without a row (defensive: if a new solicitor-owned code lands
-- before its rule is seeded, the chase engine still has cadence values).

CREATE TABLE "SolicitorReminderRule" (
    "id" TEXT NOT NULL,
    "milestoneCode" TEXT NOT NULL,
    "graceWorkingDays" INTEGER NOT NULL DEFAULT 5,
    "repeatWorkingDays" INTEGER NOT NULL DEFAULT 5,
    "maxChases" INTEGER NOT NULL DEFAULT 2,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "anchorMilestoneCode" TEXT,
    "useAnchorEventDate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SolicitorReminderRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SolicitorReminderRule_milestoneCode_key"
    ON "SolicitorReminderRule"("milestoneCode");

-- Seed all 26 solicitor-owned codes with the cadences locked with Ellis
-- 2026-08-10. Custom anchors marked; others default to direct-prereq.
--
-- Vendor solicitor (seller side)
INSERT INTO "SolicitorReminderRule" ("id", "milestoneCode", "graceWorkingDays", "repeatWorkingDays", "maxChases", "active", "anchorMilestoneCode", "useAnchorEventDate", "updatedAt") VALUES
  ('srr_vm5',  'VM5',   3, 4, 2, true, NULL, false, CURRENT_TIMESTAMP),
  ('srr_vm7',  'VM7',   3, 4, 2, true, NULL, false, CURRENT_TIMESTAMP),
  ('srr_vm8',  'VM8',   5, 7, 2, true, NULL, false, CURRENT_TIMESTAMP),
  ('srr_vm9',  'VM9',  14, 7, 2, true, NULL, false, CURRENT_TIMESTAMP),
  ('srr_vm10', 'VM10', 14, 7, 2, true, NULL, false, CURRENT_TIMESTAMP),
  ('srr_vm12', 'VM12',  3, 4, 2, true, NULL, false, CURRENT_TIMESTAMP),
  ('srr_vm13', 'VM13', 21, 7, 2, true, NULL, false, CURRENT_TIMESTAMP),
  ('srr_vm15', 'VM15',  3, 4, 2, true, NULL, false, CURRENT_TIMESTAMP),
  -- VM16 (contract docs issued): custom anchor on VM15 (further replies
  -- issued) so the chase only starts once enquiries are fully resolved,
  -- not right after the draft pack was sent out.
  ('srr_vm16', 'VM16',  5, 5, 2, true, 'VM15', false, CURRENT_TIMESTAMP),
  ('srr_vm17', 'VM17',  5, 5, 2, true, NULL, false, CURRENT_TIMESTAMP),
  ('srr_vm18', 'VM18',  4, 4, 2, true, NULL, false, CURRENT_TIMESTAMP),

-- Buyer solicitor
  -- PM7 (draft pack received): anchor on VM7 (draft pack issued on seller
  -- side) — the actual send event, not "buyer paid money on account".
  ('srr_pm7',  'PM7',   3, 4, 2, true, 'VM7',  false, CURRENT_TIMESTAMP),
  ('srr_pm8',  'PM8',   3, 4, 2, true, NULL, false, CURRENT_TIMESTAMP),
  -- PM11 (mortgage offer): anchor on PM6 (lender valuation) event date,
  -- not completion. Desktop valuations have no eventDate → falls back
  -- to PM6.completedAt inside the engine.
  ('srr_pm11', 'PM11',  5, 10, 2, true, 'PM6',  true, CURRENT_TIMESTAMP),
  ('srr_pm12', 'PM12',  5, 4, 2, true, NULL, false, CURRENT_TIMESTAMP),
  ('srr_pm13', 'PM13', 17, 6, 2, true, NULL, false, CURRENT_TIMESTAMP),
  ('srr_pm14', 'PM14', 14, 5, 2, true, NULL, false, CURRENT_TIMESTAMP),
  -- PM15 (initial replies received): anchor on VM12 (seller sent replies)
  -- — the actual send event, not "we raised enquiries".
  ('srr_pm15', 'PM15',  3, 4, 2, true, 'VM12', false, CURRENT_TIMESTAMP),
  ('srr_pm16', 'PM16',  4, 4, 2, true, NULL, false, CURRENT_TIMESTAMP),
  -- PM17 (further enquiries raised): anchor on PM13 (search results
  -- received) — search results are what usually prompts further enquiries.
  ('srr_pm17', 'PM17',  4, 4, 2, true, 'PM13', false, CURRENT_TIMESTAMP),
  -- PM18 (further replies received): anchor on VM15 (seller sent further
  -- replies) — the actual send event.
  ('srr_pm18', 'PM18',  3, 4, 2, true, 'VM15', false, CURRENT_TIMESTAMP),
  ('srr_pm19', 'PM19',  4, 4, 2, true, NULL, false, CURRENT_TIMESTAMP),
  ('srr_pm20', 'PM20',  5, 5, 2, true, NULL, false, CURRENT_TIMESTAMP),
  ('srr_pm22', 'PM22',  5, 5, 2, true, NULL, false, CURRENT_TIMESTAMP),
  ('srr_pm23', 'PM23',  5, 5, 2, true, NULL, false, CURRENT_TIMESTAMP),
  ('srr_pm25', 'PM25',  4, 4, 2, true, NULL, false, CURRENT_TIMESTAMP);
