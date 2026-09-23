-- Tier 3 Item 1: enforce "one live chase per reminder" and "one active reminder
-- per step" at the database level, so the create-then-check races that produced
-- duplicate chases/reminders become harmless no-ops (a losing race gets P2002,
-- which the create sites now catch and treat as success).
--
-- Self-dedupes existing rows FIRST so the unique indexes apply cleanly (prod was
-- clean at write time; staging had accumulated dupes). Ordering matters:
--   1) collapse duplicate active reminders, 2) cancel chases stranded on the
--   now-inactive ones, 3) collapse duplicate pending chases, 4) add the indexes.

-- 1. One active ReminderLog per (transaction, rule): keep the most recently
--    updated, deactivate the rest.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "transactionId", "reminderRuleId"
    ORDER BY "updatedAt" DESC, "createdAt" DESC
  ) AS rn
  FROM "ReminderLog" WHERE status = 'active'
)
UPDATE "ReminderLog" SET status = 'inactive'
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Cancel pending chases whose ReminderLog is no longer active (strands from
--    step 1, plus any pre-existing).
UPDATE "ChaseTask" ct SET status = 'cancelled'
FROM "ReminderLog" rl
WHERE ct."reminderLogId" = rl.id AND ct.status = 'pending' AND rl.status <> 'active';

-- 3. One pending ChaseTask per ReminderLog: keep the most-progressed (most
--    chased, then most recently chased, then latest due), cancel the rest.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "reminderLogId"
    ORDER BY "chaseCount" DESC, "lastChasedAt" DESC NULLS LAST, "dueDate" DESC
  ) AS rn
  FROM "ChaseTask" WHERE status = 'pending'
)
UPDATE "ChaseTask" SET status = 'cancelled'
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 4. Partial unique indexes. Prisma cannot express partial (WHERE) indexes in the
--    schema, so these live only in the DB and MUST NOT be added to schema.prisma
--    (they would otherwise show as drift under `migrate dev`). Applied via
--    `migrate deploy`, which does not diff against the schema.
CREATE UNIQUE INDEX "ReminderLog_active_tx_rule_key"
  ON "ReminderLog" ("transactionId", "reminderRuleId") WHERE status = 'active';
CREATE UNIQUE INDEX "ChaseTask_pending_log_key"
  ON "ChaseTask" ("reminderLogId") WHERE status = 'pending';
