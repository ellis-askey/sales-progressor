-- Insert TermsVersion v6 (2026-08-payments-v6) — supersedes v5 (2026-08-payments-v5).
--
-- v1–v5 are NOT modified. They stay in the table forever for audit purposes.
-- v6 becomes the active version because getActiveTermsVersion() picks the row
-- with the latest effectiveFrom <= now(). Directors who acknowledged v5
-- re-acknowledge v6 on their next card action.
--
-- Why a new version rather than editing v5 in place: v5 had already been
-- acknowledged and was live on prod, so its acknowledged text must stay
-- immutable for the audit trail. This is a wording refinement across most
-- clauses (Ellis, 2026-08-31) shipped as v6.
--
-- Users see the friendly label "Billing Terms - August 2026" (termsDisplayName
-- in lib/billing/terms-sections.ts), never the raw versionTag.
--
-- Two sources to keep in sync for v6:
--   1. This migration (the row that runs on prod via migrate deploy)
--   2. app/billing-terms/page.tsx (public preview)

INSERT INTO "TermsVersion" ("id", "versionTag", "bodySections", "effectiveFrom", "createdAt")
VALUES (
  gen_random_uuid()::text,
  '2026-08-payments-v6',
  '[
    {
      "heading": "About these terms",
      "body": "By saving a payment card, you agree to the pricing and billing terms set out below. Billing is operated by The Sales Progressor."
    },
    {
      "heading": "Charges",
      "body": "Fees apply only to sales you pass to our team to progress, and only if that sale exchanges. Sales you progress yourself are free, at every stage, with no charge on exchange. Your agency''s first sale passed to our team is free. After that, the fee is determined by the agreed sale price at exchange, as follows: £250 for a sale price up to £349,999; £300 for a sale price from £350,000 to £499,999; and £350 for a sale price of £500,000 or above."
    },
    {
      "heading": "Payment and collection",
      "body": "No fee is charged until an outsourced sale exchanges. Fees for all outsourced sales that exchange within a calendar month are collected as a single payment at the end of that month. The running total of fees due for sales exchanged during the current month is shown on your billing page, subject to availability of the service."
    },
    {
      "heading": "Free sales",
      "body": "Sales you progress yourself are always free, at every stage, including on exchange. Each agency''s first sale passed to our team is also free and will not incur a fee when it exchanges."
    },
    {
      "heading": "Reversed sales and credits",
      "body": "Where a sale that has exchanged is subsequently reversed or the exchange is formally rescinded, the corresponding fee will be credited to your account and applied against your next payment. This is processed automatically and requires no action on your part."
    },
    {
      "heading": "Failed payments",
      "body": "If a payment is unsuccessful, we will notify you and re-attempt collection over a period of 14 days, followed by a 7-day grace period to resolve the outstanding balance. If the payment remains outstanding after that period, you will be unable to send new sales to our team until it is resolved. Sales you progress yourself are unaffected and remain free, and any outsourced sales already being progressed by our team will continue as normal."
    },
    {
      "heading": "Card storage",
      "body": "Your card details are stored securely by our payment processor, Stripe, and are not held by us. We have access only to the last four digits and brand of your card, and never to the full card number."
    },
    {
      "heading": "Billing party",
      "body": "The agency''s director is the contracting party for billing purposes. Only a director may view or manage payment details and invoices; negotiators may not."
    },
    {
      "heading": "Changes to pricing",
      "body": "We may change our pricing in future. Where we do, we will give you at least 30 days'' notice, and the revised pricing will apply only to sales passed to our team after the new pricing takes effect. Any outsourced sale already in progress will be charged at the price that applied when it was passed to our team."
    },
    {
      "heading": "VAT",
      "body": "We are not currently registered for VAT, so VAT is not added to these fees. Should this change, we will notify you before it affects the amount you pay. As this is a material change, we will issue updated billing terms for your acknowledgement before the new charges apply."
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
