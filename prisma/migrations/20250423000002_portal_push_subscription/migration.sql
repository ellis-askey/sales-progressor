CREATE TABLE IF NOT EXISTS "PortalPushSubscription" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "contactId" TEXT NOT NULL,
  "endpoint"  TEXT NOT NULL,
  "p256dh"    TEXT NOT NULL,
  "auth"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PortalPushSubscription_endpoint_key" ON "PortalPushSubscription"("endpoint");

ALTER TABLE "PortalPushSubscription"
  ADD CONSTRAINT "PortalPushSubscription_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
