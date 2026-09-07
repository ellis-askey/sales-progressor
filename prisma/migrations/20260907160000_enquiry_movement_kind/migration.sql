-- CreateEnum
CREATE TYPE "EnquiryMovementKind" AS ENUM ('raised', 'replies_sent', 'replies_received', 'chased', 'update', 'correction');

-- AlterTable
ALTER TABLE "EnquiryMovement" ADD COLUMN "kind" "EnquiryMovementKind" NOT NULL DEFAULT 'update';
