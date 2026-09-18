-- Phase 4 perceived-performance (PERF-11): evidence-backed indexes for the
-- hot filters used by every agent list/hub/work-queue query and by the
-- reminder engine's per-rule task lookups. Additive only.

-- CreateIndex
CREATE INDEX "PropertyTransaction_agencyId_status_idx" ON "PropertyTransaction"("agencyId", "status");

-- CreateIndex
CREATE INDEX "PropertyTransaction_assignedUserId_status_idx" ON "PropertyTransaction"("assignedUserId", "status");

-- CreateIndex
CREATE INDEX "PropertyTransaction_agentUserId_status_idx" ON "PropertyTransaction"("agentUserId", "status");

-- CreateIndex
CREATE INDEX "ChaseTask_reminderLogId_status_idx" ON "ChaseTask"("reminderLogId", "status");
