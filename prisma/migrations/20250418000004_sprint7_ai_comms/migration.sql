-- Sprint 7: AI message generation fields on CommunicationRecord

ALTER TABLE "CommunicationRecord" ADD COLUMN "chaseTaskId" TEXT;
ALTER TABLE "CommunicationRecord" ADD COLUMN "generatedText" TEXT;
ALTER TABLE "CommunicationRecord" ADD COLUMN "tone" TEXT;
ALTER TABLE "CommunicationRecord" ADD COLUMN "wasAiGenerated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CommunicationRecord" ADD COLUMN "wasEdited" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CommunicationRecord" ADD CONSTRAINT "CommunicationRecord_chaseTaskId_fkey"
  FOREIGN KEY ("chaseTaskId") REFERENCES "ChaseTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CommunicationRecord_chaseTaskId_idx" ON "CommunicationRecord"("chaseTaskId");
