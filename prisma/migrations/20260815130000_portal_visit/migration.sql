-- Portal visit history (audit #6). One row per contact per UK day they open
-- their portal, so the risk engine can spot a client who was engaged and then
-- went quiet. Additive; apply staging-first, verify, then production.
CREATE TABLE "PortalVisit" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortalVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortalVisit_contactId_day_key" ON "PortalVisit"("contactId", "day");
CREATE INDEX "PortalVisit_contactId_idx" ON "PortalVisit"("contactId");

ALTER TABLE "PortalVisit" ADD CONSTRAINT "PortalVisit_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
