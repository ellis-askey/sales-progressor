-- Record the first open time for tracked emails (client chase). Additive + nullable.
ALTER TABLE "OutboundEmailQueue" ADD COLUMN "openedAt" TIMESTAMP(3);
