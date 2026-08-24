-- New provider kind for structural engineers + their chartered-engineer credential.
ALTER TYPE "ProviderKind" ADD VALUE 'structural_engineer';
ALTER TABLE "ProviderFirm" ADD COLUMN "charteredEngineer" BOOLEAN NOT NULL DEFAULT false;
