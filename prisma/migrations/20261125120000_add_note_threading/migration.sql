-- Note threading (Phase 2) + real edit timestamp.
-- Additive and nullable: existing rows are untouched (editedAt/parentNoteId null).
-- A reply is an internal_note whose parentNoteId points at the note it answers.

-- AlterTable
ALTER TABLE "OutboundMessage" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "parentNoteId" TEXT;

-- CreateIndex
CREATE INDEX "OutboundMessage_parentNoteId_idx" ON "OutboundMessage"("parentNoteId");

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_parentNoteId_fkey" FOREIGN KEY ("parentNoteId") REFERENCES "OutboundMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
