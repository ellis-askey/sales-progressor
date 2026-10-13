-- Boardwalk suite internal usage log. One FormAccessEvent row per user, per
-- surface, per hour of authenticated activity (throttled in
-- lib/forms/access-log.ts). Nothing user-facing reads these.

ALTER TABLE "FormTenantUser" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

CREATE TABLE "FormAccessEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormAccessEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FormAccessEvent_userId_createdAt_idx" ON "FormAccessEvent"("userId", "createdAt");

CREATE INDEX "FormAccessEvent_tenantId_createdAt_idx" ON "FormAccessEvent"("tenantId", "createdAt");

ALTER TABLE "FormAccessEvent" ADD CONSTRAINT "FormAccessEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FormTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
