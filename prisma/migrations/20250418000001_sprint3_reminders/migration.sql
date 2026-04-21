-- Sprint 3 v2: ReminderRule, ReminderLog, ChaseTask with full fields

CREATE TYPE "ReminderLogStatus" AS ENUM ('active', 'completed', 'cancelled', 'inactive');
CREATE TYPE "ChaseTaskStatus" AS ENUM ('pending', 'done', 'cancelled', 'inactive');
CREATE TYPE "TaskPriority" AS ENUM ('normal', 'escalated');

CREATE TABLE "ReminderRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "anchorMilestoneId" TEXT,
    "targetMilestoneCode" TEXT,
    "graceDays" INTEGER NOT NULL DEFAULT 3,
    "repeatEveryDays" INTEGER NOT NULL DEFAULT 5,
    "escalateAfterChases" INTEGER NOT NULL DEFAULT 3,
    "requiresExchangeReady" BOOLEAN NOT NULL DEFAULT false,
    "useEventDate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReminderRule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReminderRule"
    ADD CONSTRAINT "ReminderRule_anchorMilestoneId_fkey"
    FOREIGN KEY ("anchorMilestoneId") REFERENCES "MilestoneDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "reminderRuleId" TEXT NOT NULL,
    "status" "ReminderLogStatus" NOT NULL DEFAULT 'active',
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "sourceDateUsed" TIMESTAMP(3),
    "statusReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReminderLog_transactionId_reminderRuleId_idx" ON "ReminderLog"("transactionId", "reminderRuleId");
CREATE INDEX "ReminderLog_status_nextDueDate_idx" ON "ReminderLog"("status", "nextDueDate");

ALTER TABLE "ReminderLog"
    ADD CONSTRAINT "ReminderLog_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReminderLog"
    ADD CONSTRAINT "ReminderLog_reminderRuleId_fkey"
    FOREIGN KEY ("reminderRuleId") REFERENCES "ReminderRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ChaseTask" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "reminderLogId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ChaseTaskStatus" NOT NULL DEFAULT 'pending',
    "priority" "TaskPriority" NOT NULL DEFAULT 'normal',
    "chaseCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChaseTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChaseTask_transactionId_idx" ON "ChaseTask"("transactionId");
CREATE INDEX "ChaseTask_status_dueDate_idx" ON "ChaseTask"("status", "dueDate");
CREATE INDEX "ChaseTask_priority_status_idx" ON "ChaseTask"("priority", "status");

ALTER TABLE "ChaseTask"
    ADD CONSTRAINT "ChaseTask_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChaseTask"
    ADD CONSTRAINT "ChaseTask_reminderLogId_fkey"
    FOREIGN KEY ("reminderLogId") REFERENCES "ReminderLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChaseTask"
    ADD CONSTRAINT "ChaseTask_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
