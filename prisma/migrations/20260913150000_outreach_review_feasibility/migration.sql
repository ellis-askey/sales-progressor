-- AlterTable: structured review + feasibility + pre-revision proposal on
-- OutreachExperiment (Build Order F). All additive + nullable; no backfill.
ALTER TABLE "OutreachExperiment" ADD COLUMN     "reviewerResult" JSONB,
ADD COLUMN     "reviewOutcome" TEXT,
ADD COLUMN     "feasibility" JSONB,
ADD COLUMN     "originalProposal" JSONB;
