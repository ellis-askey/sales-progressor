-- Phase 4: dated completion for to-dos. Stamped when a task is marked done,
-- cleared when reopened. Existing done tasks keep a null completedAt (unknown).
ALTER TABLE "ManualTask" ADD COLUMN "completedAt" TIMESTAMP(3);
