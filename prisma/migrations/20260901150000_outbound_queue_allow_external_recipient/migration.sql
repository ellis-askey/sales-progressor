-- Allow OutboundEmailQueue rows addressed to an EXTERNAL email — one that is
-- neither a platform User nor a client Contact — e.g. surveyor/provider quote
-- requests, which send to the firm's own address (recipientEmail).
--
-- The original exactly-one-of(user, contact) CHECK (20260522210000) silently
-- blocked EVERY provider-quote insert in production: the insert threw the
-- constraint violation, and the quote action's try/catch swallowed it, so no
-- surveyor email ever sent (0 PROVIDER_QUOTE rows since launch; found
-- 2026-09-01 investigating a missed Cameron Surveyors quote).
--
-- Relax the invariant to "never BOTH user AND contact set". An external row is
-- both-NULL, with recipientEmail (a NOT NULL column) carrying the address.
-- Non-destructive: every existing row satisfies the stricter old rule and so
-- also satisfies this looser one. DROP IF EXISTS covers the staging/prod drift
-- (the constraint is present on prod, absent on staging).

ALTER TABLE "OutboundEmailQueue" DROP CONSTRAINT IF EXISTS "outbound_email_one_recipient_chk";

ALTER TABLE "OutboundEmailQueue"
  ADD CONSTRAINT "outbound_email_one_recipient_chk"
  CHECK (
    ("recipientUserId" IS NOT NULL AND "recipientContactId" IS NULL)
    OR ("recipientUserId" IS NULL AND "recipientContactId" IS NOT NULL)
    OR ("recipientUserId" IS NULL AND "recipientContactId" IS NULL)
  );
