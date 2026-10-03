-- Prevent a hand-delete of a ProgressionBusiness from silently orphaning its files
-- (which SET NULL turned into TSP files), its owner, or its verified domains.
-- Switch the three nullable owner FKs from SET NULL to RESTRICT: a business can't
-- be deleted while anything still references it. To close one, offboard first.
ALTER TABLE "User" DROP CONSTRAINT "User_progressionBusinessId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_progressionBusinessId_fkey" FOREIGN KEY ("progressionBusinessId") REFERENCES "ProgressionBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyTransaction" DROP CONSTRAINT "PropertyTransaction_progressionBusinessId_fkey";
ALTER TABLE "PropertyTransaction" ADD CONSTRAINT "PropertyTransaction_progressionBusinessId_fkey" FOREIGN KEY ("progressionBusinessId") REFERENCES "ProgressionBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VerifiedDomain" DROP CONSTRAINT "VerifiedDomain_progressionBusinessId_fkey";
ALTER TABLE "VerifiedDomain" ADD CONSTRAINT "VerifiedDomain_progressionBusinessId_fkey" FOREIGN KEY ("progressionBusinessId") REFERENCES "ProgressionBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
