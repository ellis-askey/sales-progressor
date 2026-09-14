-- Agent-facing WhatsApp connections (Phase 3): a connection row now exists from
-- the moment pairing starts (before the phone number is known), and records when
-- the agent accepted the connect consent. WhatsAppConnection was an unused stub,
-- so these changes touch no existing data.
ALTER TABLE "WhatsAppConnection" ADD COLUMN "consentAcceptedAt" TIMESTAMP(3);
ALTER TABLE "WhatsAppConnection" ALTER COLUMN "phoneNumber" DROP NOT NULL;
