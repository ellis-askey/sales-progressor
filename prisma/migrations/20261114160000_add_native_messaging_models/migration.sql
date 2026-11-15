-- Native messaging (pilot) — Phase 0 foundation.
--
-- Four additive tables (Conversation, Message, MessageAttachment,
-- MessageReceipt) + four enums. Nothing existing is altered: the only changes
-- to existing models are Prisma back-relation arrays, which emit no SQL.
--
-- The base DDL below is exactly what `prisma migrate diff` generated from the
-- schema change (kept verbatim so there is zero drift). The appended block adds
-- what Prisma's schema language cannot express — two PARTIAL unique indexes per
-- side-uniqueness rule, and CHECK constraints — mirroring the approach proven in
-- 20260604000000_buyer_round_milestone_uniqueness and
-- 20260501000009_add_outbound_check_constraint.

-- CreateEnum
CREATE TYPE "ConversationSide" AS ENUM ('buyer', 'seller');

-- CreateEnum
CREATE TYPE "MessageParticipantKind" AS ENUM ('staff', 'client');

-- CreateEnum
CREATE TYPE "MessageAttachmentKind" AS ENUM ('image', 'pdf', 'doc');

-- CreateEnum
CREATE TYPE "MessageAttachmentScanStatus" AS ENUM ('pending', 'clean', 'blocked');

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "side" "ConversationSide" NOT NULL,
    "buyerRoundId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderKind" "MessageParticipantKind" NOT NULL,
    "senderUserId" TEXT,
    "senderContactId" TEXT,
    "body" TEXT NOT NULL,
    "clientMsgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "kind" "MessageAttachmentKind" NOT NULL,
    "scanStatus" "MessageAttachmentScanStatus" NOT NULL DEFAULT 'pending',
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReceipt" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "participantKind" "MessageParticipantKind" NOT NULL,
    "participantUserId" TEXT,
    "participantContactId" TEXT,
    "lastReadAt" TIMESTAMP(3),
    "lastReadMessageId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_transactionId_side_idx" ON "Conversation"("transactionId", "side");

-- CreateIndex
CREATE INDEX "Conversation_buyerRoundId_idx" ON "Conversation"("buyerRoundId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_clientMsgId_key" ON "Message"("conversationId", "clientMsgId");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "MessageReceipt_conversationId_idx" ON "MessageReceipt"("conversationId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_buyerRoundId_fkey" FOREIGN KEY ("buyerRoundId") REFERENCES "BuyerRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderContactId_fkey" FOREIGN KEY ("senderContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReceipt" ADD CONSTRAINT "MessageReceipt_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReceipt" ADD CONSTRAINT "MessageReceipt_participantUserId_fkey" FOREIGN KEY ("participantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReceipt" ADD CONSTRAINT "MessageReceipt_participantContactId_fkey" FOREIGN KEY ("participantContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Custom SQL below (not expressible in Prisma's @@unique / schema language).
-- Mirrors 20260604000000_buyer_round_milestone_uniqueness (partial unique
-- indexes) and 20260501000009_add_outbound_check_constraint (idempotent CHECKs).
-- ─────────────────────────────────────────────────────────────────────────────

-- Conversation uniqueness.
-- One conversation per side when there is NO round — covers every SELLER
-- conversation and any legacy/null-round buyer. (PostgreSQL treats NULLs as
-- distinct in a normal UNIQUE, which would wrongly allow two null-round rows;
-- the partial index on the non-null subset is the standard fix.)
CREATE UNIQUE INDEX "Conversation_tx_side_noround_uq"
  ON "Conversation" ("transactionId", "side")
  WHERE "buyerRoundId" IS NULL;

-- One BUYER conversation per (file, side, round).
CREATE UNIQUE INDEX "Conversation_tx_side_round_uq"
  ON "Conversation" ("transactionId", "side", "buyerRoundId")
  WHERE "buyerRoundId" IS NOT NULL;

-- A seller conversation must never carry a buyer round, so the IS NULL index
-- fully governs sellers and a seller row can never collide with a buyer round.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversation_seller_no_round'
      AND conrelid = '"Conversation"'::regclass
  ) THEN
    ALTER TABLE "Conversation"
      ADD CONSTRAINT "conversation_seller_no_round"
      CHECK ( ("side" = 'seller' AND "buyerRoundId" IS NULL) OR "side" = 'buyer' );
  END IF;
END $$;

-- Message: exactly one sender identity, and it must agree with senderKind
-- (staff ⇒ a user; client ⇒ a contact). Keeps application resolution and the
-- database in agreement.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'message_one_sender'
      AND conrelid = '"Message"'::regclass
  ) THEN
    ALTER TABLE "Message"
      ADD CONSTRAINT "message_one_sender"
      CHECK ( (("senderUserId" IS NOT NULL)::int + ("senderContactId" IS NOT NULL)::int) = 1 );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'message_sender_kind_match'
      AND conrelid = '"Message"'::regclass
  ) THEN
    ALTER TABLE "Message"
      ADD CONSTRAINT "message_sender_kind_match"
      CHECK (
        ("senderKind" = 'staff'  AND "senderUserId"    IS NOT NULL)
        OR ("senderKind" = 'client' AND "senderContactId" IS NOT NULL)
      );
  END IF;
END $$;

-- MessageReceipt: exactly one participant, and one read-cursor row per
-- participant per conversation (again via partial unique indexes because the
-- participant columns are nullable).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'receipt_one_participant'
      AND conrelid = '"MessageReceipt"'::regclass
  ) THEN
    ALTER TABLE "MessageReceipt"
      ADD CONSTRAINT "receipt_one_participant"
      CHECK ( (("participantUserId" IS NOT NULL)::int + ("participantContactId" IS NOT NULL)::int) = 1 );
  END IF;
END $$;

CREATE UNIQUE INDEX "MessageReceipt_conv_user_uq"
  ON "MessageReceipt" ("conversationId", "participantUserId")
  WHERE "participantUserId" IS NOT NULL;

CREATE UNIQUE INDEX "MessageReceipt_conv_contact_uq"
  ON "MessageReceipt" ("conversationId", "participantContactId")
  WHERE "participantContactId" IS NOT NULL;
