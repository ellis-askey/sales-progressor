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
      "body": "By saving a payment card, you agree to the pricing terms set out below. Billing is operated by The Sales Progressor."
    },
    {
      "heading": "Charges",
      "body": "Fees are charged per sale and only on exchange of that sale. For a sale you progress in-house, the fee is £59. For a sale you pass to our team to progress, the fee is determined by the agreed sale price at exchange, as follows: £250 for a sale price up to £349,999; £300 for a sale price from £350,000 to £499,999; and £350 for a sale price of £500,000 or above."
    },
    {
      "heading": "Payment and collection",
      "body": "No fee is charged until a sale exchanges. Fees for all sales that exchange within a calendar month are collected as a single payment at the end of that month. The running total of fees accrued in the current month is shown on your billing page, subject to availability of the service."
    },
    {
      "heading": "Free trial period",
      "body": "Any sale added within the first 14 days is not chargeable at any stage, including on its eventual exchange, regardless of how long after the trial period that exchange occurs. The 14-day period begins on the date you add your first sale."
    },
    {
      "heading": "Reversed sales and credits",
      "body": "Where a sale that has exchanged is subsequently reversed (for example, where the exchange is undone), the corresponding fee is reversed and applied as a credit against your next invoice. This is processed automatically and requires no action on your part."
    },
    {
      "heading": "Failed payments",
      "body": "If a payment is unsuccessful, we will notify you and re-attempt collection over a period of 14 days, followed by a 7-day grace period in which to resolve the matter. If the payment remains outstanding after that period, you will be unable to add new sales until it is resolved. Sales already in progress are unaffected throughout."
    },
    {
      "heading": "Card storage",
      "body": "Your card details are stored securely by our payment processor, Stripe, and are not held by us. We have access only to the last four digits and the card brand, and never to the full card number."
    },
    {
      "heading": "Billing party",
      "body": "The agency''s director is the contracting party for billing purposes. Only a director may view or manage payment details and invoices; negotiators may not."
    },
    {
      "heading": "Changes to pricing",
      "body": "We may change our pricing in future. Where we do, we will give you at least 30 days'' notice, and the revised pricing will apply only to sales added after it takes effect. Any sale already in progress will be charged at the price that applied when it was added."
    },
    {
      "heading": "VAT",
      "body": "We are not currently registered for VAT, and no VAT is therefore added to these fees. Should this change, we will notify you before it affects the amount you pay. As this is a material change, we will issue updated billing terms for your acknowledgement before your next billing cycle."
    },
    {
      "heading": "Disputes",
      "body": "If you believe a charge is incorrect, please contact us at support@thesalesprogressor.co.uk before raising a dispute with your card provider, and we will work to resolve it promptly."
    }
  ]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ("versionTag") DO NOTHING;
