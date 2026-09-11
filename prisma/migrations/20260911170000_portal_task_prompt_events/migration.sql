-- Portal Engagement v2, item B: task-prompt funnel event types.
-- Additive enum values only; no data change, no column change.

-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'portal_task_prompt_shown';
ALTER TYPE "EventType" ADD VALUE 'portal_task_prompt_clicked';
ALTER TYPE "EventType" ADD VALUE 'portal_task_prompt_dismissed';
