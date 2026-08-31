-- Insert TermsVersion v5 (2026-08-payments-v5) — supersedes v4 (2026-06-payments-v4).
--
-- v1–v4 are NOT modified. They stay in the table forever for audit purposes
-- (existing PricingAcknowledgement rows FK to whichever version they
-- acknowledged). v5 becomes the active version because getActiveTermsVersion()
-- picks the row with the latest effectiveFrom <= now().
--
-- Directors who acknowledged v4 will be presented with v5 next time they
-- attempt a card action — their earlier acknowledgement remains valid only
-- against the version they acknowledged. This re-acknowledgement is deliberate:
-- v5 is a MATERIAL change (self-progress becomes free; the £59 in-house fee is
-- retired; the 14-day free trial is replaced by first-outsourced-file-free).
--
-- What changed vs v4 (substantive — the free-pricing model, docs/PRICING_MODEL_MIGRATION_AUDIT.md):
--   - Charges: in-house £59 fee removed; self-progress is free at every stage.
--     Outsourced bands unchanged (£250/£300/£350) but the agency's FIRST
--     outsourced sale is now free.
--   - Payment and collection: scoped to outsourced sales (the only chargeable
--     sales now).
--   - "Free trial period" (14-day) section replaced by "Free sales": self is
--     always free; first outsourced file free.
--   - Failed payments: an unpaid balance blocks sending NEW sales to our team
--     (outsourced) rather than adding any sale — self-progress stays free and
--     unaffected.
--
-- Idempotency: ON CONFLICT ("versionTag") DO NOTHING — safe to re-run.
--
-- Two sources to keep in sync for the v5 content:
--   1. This migration file (historical record + the insert that runs on deploy)
--   2. app/billing-terms/page.tsx (public preview)
-- If either changes materially after a director has acknowledged v5, ship v6.
-- Don't edit v5 in place after it's been acknowledged.

INSERT INTO "TermsVersion" ("id", "versionTag", "bodySections", "effectiveFrom", "createdAt")
VALUES (
  gen_random_uuid()::text,
  '2026-08-payments-v5',
  '[
    {
      "heading": "About these terms",
      "body": "By saving a payment card, you agree to the pricing terms set out below. Billing is operated by The Sales Progressor."
    },
    {
      "heading": "Charges",
      "body": "Fees apply only to sales you pass to our team to progress, and only on exchange of that sale. Sales you progress yourself are free, at every stage, with no charge on exchange. Your agency''s first sale passed to our team is free. After that, the fee is determined by the agreed sale price at exchange, as follows: £250 for a sale price up to £349,999; £300 for a sale price from £350,000 to £499,999; and £350 for a sale price of £500,000 or above."
    },
    {
      "heading": "Payment and collection",
      "body": "No fee is charged until an outsourced sale exchanges. Fees for all outsourced sales that exchange within a calendar month are collected as a single payment at the end of that month. The running total of fees accrued in the current month is shown on your billing page, subject to availability of the service."
    },
    {
      "heading": "Free sales",
      "body": "Sales you progress yourself are always free, at every stage, including on exchange. Each agency''s first sale passed to our team is also free, through to exchange, regardless of when it exchanges."
    },
    {
      "heading": "Reversed sales and credits",
      "body": "Where a sale that has exchanged is subsequently reversed (for example, where the exchange is undone), the corresponding fee is reversed and applied as a credit against your next invoice. This is processed automatically and requires no action on your part."
    },
    {
      "heading": "Failed payments",
      "body": "If a payment is unsuccessful, we will notify you and re-attempt collection over a period of 14 days, followed by a 7-day grace period in which to resolve the matter. If the payment remains outstanding after that period, you will be unable to send new sales to our team until it is resolved. Sales you progress yourself are unaffected and remain free, and sales already in progress are unaffected throughout."
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
