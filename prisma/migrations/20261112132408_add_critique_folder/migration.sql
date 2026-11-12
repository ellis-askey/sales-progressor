-- Critique folders (#290): free-text organising folder on CritiqueNote.
-- Folders exist implicitly as the distinct set of non-null values. Additive,
-- nullable, no backfill.
ALTER TABLE "CritiqueNote" ADD COLUMN "folder" TEXT;
CREATE INDEX "CritiqueNote_folder_idx" ON "CritiqueNote"("folder");
