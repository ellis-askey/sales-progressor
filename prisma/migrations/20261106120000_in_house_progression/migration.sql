-- In-house progression workflow (Boardwalk). Two additive boolean flags:
--   Agency.inHouseProgressionEnabled — gate for the CM -> progressor workflow
--   User.isInHouseProgressor         — marks the agency's progressor pool

-- AlterTable
ALTER TABLE "Agency" ADD COLUMN "inHouseProgressionEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isInHouseProgressor" BOOLEAN NOT NULL DEFAULT false;
