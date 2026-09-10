-- "No completion preference yet?" was non-nullable (default false), so it always
-- read as an answered "No". Make it nullable so it's blank until actually chosen.
ALTER TABLE "ClientMoveInfo" ALTER COLUMN "noCompletionPreference" DROP NOT NULL;
ALTER TABLE "ClientMoveInfo" ALTER COLUMN "noCompletionPreference" DROP DEFAULT;

-- Existing default-false rows were never a deliberate choice — treat them as
-- unanswered. Explicit "yes, no preference" (true) is preserved.
UPDATE "ClientMoveInfo" SET "noCompletionPreference" = NULL WHERE "noCompletionPreference" = false;
