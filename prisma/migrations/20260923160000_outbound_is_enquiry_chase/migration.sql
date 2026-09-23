-- Tag enquiry-loop chase emails (the pre-raise nudges + the reply-loop chases)
-- so the enquiries chase-history timeline can source ONLY its own chases instead
-- of every purpose:"chase" message on the file (which also holds milestone /
-- solicitor chases and other notes). Critique #19b.
ALTER TABLE "OutboundMessage" ADD COLUMN "isEnquiryChase" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "OutboundMessage_transactionId_isEnquiryChase_idx"
  ON "OutboundMessage" ("transactionId", "isEnquiryChase");

-- Backfill: recover historical reply-loop enquiry chases, which stamped a
-- deterministic "enq-" outbound Message-ID on send (<sp-enq-...@...>). Older
-- "raise" nudges carry no marker and can't be recovered reliably; both kinds are
-- tagged going forward via logEnquiryChaseComm.
UPDATE "OutboundMessage"
SET "isEnquiryChase" = true
WHERE "purpose" = 'chase'
  AND "internetMessageId" LIKE '%enq-%'
  AND "isEnquiryChase" = false;
