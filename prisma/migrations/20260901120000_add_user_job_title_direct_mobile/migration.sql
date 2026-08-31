-- Profile detail fields (2026-09): job title + a direct mobile number,
-- both optional, shown alongside the user's name in client-facing surfaces.
ALTER TABLE "User" ADD COLUMN "jobTitle" TEXT;
ALTER TABLE "User" ADD COLUMN "directMobile" TEXT;
