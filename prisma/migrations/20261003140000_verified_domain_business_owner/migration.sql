-- Widen VerifiedDomain so a domain can be owned by EITHER an agency (original
-- case) or an external progression business (its own default sending domain).
-- Purely additive: agencyId becomes nullable (every existing row keeps its value,
-- so the agency flow is unchanged) and a nullable progressionBusinessId owner is
-- added with its own unique + index. The agency FK is left untouched.
ALTER TABLE "VerifiedDomain" ALTER COLUMN "agencyId" DROP NOT NULL;
ALTER TABLE "VerifiedDomain" ADD COLUMN "progressionBusinessId" TEXT;
ALTER TABLE "VerifiedDomain"
  ADD CONSTRAINT "VerifiedDomain_progressionBusinessId_fkey"
  FOREIGN KEY ("progressionBusinessId") REFERENCES "ProgressionBusiness"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "VerifiedDomain_progressionBusinessId_domain_key"
  ON "VerifiedDomain"("progressionBusinessId", "domain");
CREATE INDEX "VerifiedDomain_progressionBusinessId_idx"
  ON "VerifiedDomain"("progressionBusinessId");
