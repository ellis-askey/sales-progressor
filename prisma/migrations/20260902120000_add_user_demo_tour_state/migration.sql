-- Demo guided-walkthrough per-user state (2026-09). Both nullable + additive:
-- set when the tour is finished / skipped so the first-run auto-start fires
-- once per teammate. See docs/DEMO_SALE_GUIDED_EXPERIENCE_PLAN.md §13.
ALTER TABLE "User" ADD COLUMN "demoTourCompletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "demoTourSkippedAt" TIMESTAMP(3);
