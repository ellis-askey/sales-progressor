-- Insert TermsVersion v4 (2026-06-payments-v4) — supersedes v3 (2026-06-payments-v3).
--
-- v1, v2, v3 are NOT modified. They stay in the table forever for audit purposes
-- (existing PricingAcknowledgement rows FK to whichever version they
-- acknowledged). v4 becomes the active version because getActiveTermsVersion()
-- picks the row with the latest effectiveFrom <= now().
--
-- Directors who acknowledged v1, v2 or v3 will be presented with v4 next time
-- they attempt a card action — their earlier acknowledgements remain valid
-- only against the version they acknowledged.
--
-- What changed vs v3 (presentation only — body text identical):
--   - First section heading split: "Sales Progressor — pricing" became two
--     sections: "About these terms" (preamble — entity info) + "Pricing"
--     (was "What you pay" — the actual price bullets). Every section title
--     is now a clean noun-phrase.
--
-- The substantive obligations are unchanged from v3. We're shipping a new
-- TermsVersion rather than editing v3 in place because directors who
-- acknowledged v3 saw the v3 heading structure — changing what acknowledged
-- text shows after the fact would muddy the audit trail.
--
-- Idempotency: ON CONFLICT ("versionTag") DO NOTHING — safe to re-run.
--
-- Three sources to keep in sync for the v4 content:
--   1. This migration file (historical record)
--   2. scripts/insert-prod-terms-v4.ts (re-runnable seed)
--   3. app/billing-terms/page.tsx (public preview)
-- If any one changes (and the change is material), ship v5. Don't edit v4 in
-- place after it's been acknowledged by directors.

INSERT INTO "TermsVersion" ("id", "versionTag", "bodySections", "effectiveFrom", "createdAt")
VALUES (
  gen_random_uuid()::text,
  '2026-06-payments-v4',
  '[
    {
      "heading": "About these terms",
      "body": "By saving a payment card, you agree to the following pricing terms. Billing is operated by The Sales Progressor Ltd, company number [Company number], registered office [Registered office address]."
    },
    {
      "heading": "Pricing",
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
      "body": "Sales already underway carry on as normal. If a payment doesn''t go through, we''ll warn you for 14 days and try the payment again, then allow a 7-day grace period for you to resolve it. If it''s still unresolved after that, you won''t be able to add new sales until the payment is sorted — your existing sales are unaffected throughout."
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
      "body": "We may change our pricing in future. If we do, we''ll give you at least 30 days'' notice and the change will apply only to sales added after the new pricing takes effect — any sales already in progress are honoured at the price that applied when they were added."
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
