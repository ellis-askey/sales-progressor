-- Client-facing trust fields for surveyor/provider cards.
ALTER TABLE "ProviderFirm"
  ADD COLUMN "ricsRegulated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "establishedYear" INTEGER,
  ADD COLUMN "turnaround" TEXT;
