-- Add Contact.unsubscribedAt for client-chase arc (Sub-arc A — A2 commit).
-- Mirrors User.emailUnsubscribedAt. Set when a contact clicks the unsubscribe
-- link in any platform email addressed to them. Suppression is checked at
-- send time via isContactEmailSuppressed (lib/email.ts). Pure additive — no
-- callers yet (A3 wires the unsubscribe endpoint; A5 wires the queue
-- suppression).

ALTER TABLE "Contact" ADD COLUMN "unsubscribedAt" TIMESTAMP(3);
