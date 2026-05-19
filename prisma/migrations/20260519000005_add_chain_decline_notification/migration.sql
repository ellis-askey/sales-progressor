-- Gap 5: in-app notification fields for chain invite decline
ALTER TABLE "User" ADD COLUMN "chainDeclineNotificationAddress" TEXT;
ALTER TABLE "User" ADD COLUMN "chainDeclineNotificationAt" TIMESTAMP(3);
