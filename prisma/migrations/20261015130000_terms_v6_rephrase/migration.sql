-- Rephrase the v6 billing terms IN PLACE (Ellis, 2026-10-15).
--
-- This is a wording-only refresh: the SUBSTANCE is identical to the shipped v6
-- (same fee tiers £250/£300/£350, same free first outsourced sale, same 14-day
-- + 7-day grace, same VAT position, same disputes clause). Only the prose is
-- improved. Per founder decision it stays the SAME version (2026-08-payments-v6)
-- so NO director has to re-acknowledge — a plain swap of the displayed text.
--
-- This deliberately edits an already-acknowledged version's text, overriding the
-- usual "new version per change" rule, because nothing material changed and the
-- founder does not want to re-prompt directors. The versionTag, id and all
-- existing PricingAcknowledgement rows are untouched.
--
-- Keep in sync with app/billing-terms/page.tsx (public preview).

UPDATE "TermsVersion"
SET "bodySections" = '[
  {
    "heading": "About these terms",
    "body": "By saving a payment card, you agree to the pricing and billing terms set out below. All billing for sales managed by our own progression team is administered by The Sales Progressor."
  },
  {
    "heading": "Charges",
    "body": "Fees are payable only on sales you instruct our team to progress, and only when those sales exchange contracts. Sales you progress yourself are free, at every stage, with no charge on exchange. Your agency''s first sale managed by our team is free. For subsequent sales, the fee is calculated using the agreed sale price at the point of exchange: £250 for sales up to £349,999; £300 for sales between £350,000 and £499,999; and £350 for sales of £500,000 or above."
  },
  {
    "heading": "Payment and collection",
    "body": "No fee becomes payable until a sale managed by our team exchanges contracts. Fees for all qualifying sales exchanged within the same calendar month are collected as a single payment at the end of that month. Where available, your billing page will display a running total of fees accrued during the current month."
  },
  {
    "heading": "Free sales",
    "body": "Sales you progress yourself remain completely free throughout the transaction, including upon exchange of contracts. Your agency''s first sale managed by our team is also free and will not attract a fee upon exchange."
  },
  {
    "heading": "Reversed sales and credits",
    "body": "If contracts are exchanged but the exchange is subsequently formally rescinded or reversed, any fee charged in respect of that sale will be credited to your account and deducted from your next payment. Credits are applied automatically, with no action required from you."
  },
  {
    "heading": "Failed payments",
    "body": "If a payment is unsuccessful, we will notify you and make further attempts to collect the outstanding amount over the following 14 days. A further seven-day grace period will then apply. If payment remains outstanding at the end of this period, your agency''s ability to instruct our team on new sales will be temporarily suspended until the balance is settled. This will not affect your access to free self-progression or interrupt any sales already being managed by our team."
  },
  {
    "heading": "Card storage",
    "body": "Your payment card details are securely processed and stored by Stripe, our payment provider. The Sales Progressor does not store or have access to your full card number. We can view only limited card information, including the card brand and last four digits, for billing and identification purposes."
  },
  {
    "heading": "Billing party",
    "body": "The agency director is responsible for the agency''s billing arrangements and is the contracting party for these terms. Access to payment details, billing management and invoices is restricted to directors. Negotiators do not have access to these functions."
  },
  {
    "heading": "Changes to pricing",
    "body": "We reserve the right to amend our pricing, subject to providing at least 30 days'' advance notice. Any revised pricing will apply only to sales instructed with our team on or after the date the new pricing takes effect. Sales already under our management will remain subject to the pricing in effect when they were originally instructed."
  },
  {
    "heading": "VAT",
    "body": "The Sales Progressor is not currently registered for VAT, and no VAT is therefore added to the fees stated above. Should our VAT registration status change, we will notify you in advance of any resulting change to your charges. Updated billing terms will be provided for your acknowledgement before those changes take effect."
  },
  {
    "heading": "Disputes",
    "body": "If you believe a charge has been made incorrectly, please contact us at support@thesalesprogressor.co.uk in the first instance, before initiating a dispute with your card provider. We will review your query and work with you to resolve it as promptly as possible."
  }
]'::jsonb
WHERE "versionTag" = '2026-08-payments-v6';
