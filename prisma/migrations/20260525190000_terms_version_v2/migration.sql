-- Insert TermsVersion v2 (2026-06-payments-v2) — supersedes v1 (2026-05-payments-v1).
--
-- v1 is NOT modified. It stays in the table forever for audit purposes (existing
-- PricingAcknowledgement rows FK to it). v2 becomes the active version because
-- getActiveTermsVersion() picks the row with the latest effectiveFrom <= now().
--
-- Directors who already acknowledged v1 will be presented with v2 next time
-- they attempt a card action — their v1 acknowledgement remains valid against
-- v1 only.
--
-- What changed vs v1:
--   - New "credit notes" section (was implicit; now explicit)
--   - New "How your card is stored" section (transparency about Stripe)
--   - New "Who's billed" section (was implicit; now explicit)
--   - New "If pricing changes" clause (forward-only change protection)
--   - New "Disputes" section (chargeback process before bank dispute)
--   - "Sales Progressor" intro now names The Sales Progressor Ltd (with company
--     number TBC placeholder until incorporation completes; a future v3 will
--     replace the placeholder)
--   - Slightly clearer "when you pay" wording
--   - VAT section now commits to issuing a new TermsVersion if VAT status changes
--
-- ID generation: Postgres-side gen_random_uuid()::text instead of Prisma's
-- cuid() default — cuid is JavaScript-side and not available in raw SQL. The
-- id format differs from rows created via Prisma client but the schema only
-- requires uniqueness, not format. versionTag is the lookup key, not id.
--
-- Idempotency: ON CONFLICT ("versionTag") DO NOTHING — safe to re-run if the
-- migration is replayed against a DB that already has v2.
--
-- Three sources to keep in sync for the v2 content:
--   1. This migration file (historical record)
--   2. scripts/insert-prod-terms-v2.ts (re-runnable seed)
--   3. app/billing-terms/page.tsx (public preview)
-- If any one changes, update all three.

INSERT INTO "TermsVersion" ("id", "versionTag", "bodySections", "effectiveFrom", "createdAt")
VALUES (
  gen_random_uuid()::text,
  '2026-06-payments-v2',
  '[
    {
      "heading": "Sales Progressor — pricing",
      "body": "By saving a payment card, you agree to the following pricing terms. Billing is operated by The Sales Progressor Ltd (company number to be added on incorporation), registered office to be added on incorporation."
    },
    {
      "heading": "What you pay",
      "body": "We charge per sale, and only once it exchanges — never before. For a sale you progress in-house, the fee is £59. For a sale you pass to our team to progress, the fee depends on the agreed sale price at exchange: £250 for sales up to £349,999, £300 for £350,000 to £499,999, and £350 for £500,000 and above."
    },
    {
      "heading": "When you pay",
      "body": "Nothing is charged until a sale exchanges. Fees for sales that exchange in a given month are collected together as a single payment at the end of that month. You''ll see the running total building on your billing page throughout the month (subject to the platform being available), so there are no surprises."
    },
    {
      "heading": "Your free trial",
      "body": "Any sale you add in your first 14 days is free for its whole life — even when it exchanges months later, you won''t be charged for it. The 14 days run from the first sale you add."
    },
    {
      "heading": "If a sale is later un-done (credit notes)",
      "body": "If a sale that had exchanged is later reversed (for example, an exchange milestone is undone), the fee for that sale is reversed as a credit applied against your next bill. You don''t need to do anything — it''s handled automatically."
    },
    {
      "heading": "If a payment fails",
      "body": "Sales already underway carry on as normal. We''ll show you clearly that a payment needs attention and how to fix it. If it remains unresolved, you won''t be able to add new sales until it''s sorted — your existing sales are unaffected."
    },
    {
      "heading": "How your card is stored",
      "body": "Your card details are stored securely by Stripe, our payment processor — not by us. We can see only the last four digits and the card brand, never the full card number."
    },
    {
      "heading": "Who''s billed",
      "body": "The agency''s director is the contracting party for billing. Only a director can see or manage payment details and invoices. Negotiators cannot."
    },
    {
      "heading": "If pricing changes",
      "body": "We may change our pricing in future. If we do, we''ll give you advance notice and the change will apply only to sales added after the new pricing takes effect — any sales already in progress are honoured at the price that applied when they were added."
    },
    {
      "heading": "VAT",
      "body": "We are not currently VAT-registered, so no VAT is added to these fees. If that changes, we''ll tell you before it affects what you pay — and, because it''s a material change, we''ll issue updated billing terms for you to acknowledge before your next billing cycle."
    },
    {
      "heading": "Disputes",
      "body": "If you think a charge is wrong, contact us at support@thesalesprogressor.co.uk before raising a dispute with your card provider, and we''ll work to resolve it quickly."
    }
  ]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ("versionTag") DO NOTHING;
