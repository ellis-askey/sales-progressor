-- Convert TermsVersion.body (single text blob) into bodySections (JSONB array of
-- {heading, body} sections). The disclosure has clear headed sections in the
-- copy ("What you pay" / "When you pay" / "Your free trial" / etc.); parsing
-- on render was fragile (would break the moment v2 is worded differently),
-- and versioned terms exist precisely to change. Structured storage now;
-- renderer just maps over sections.
--
-- Single migration that adds the new column, populates existing rows in a
-- known structured shape, then drops the old column. The v1 content is
-- inlined here so the migration is self-contained — Ellis's signed-off
-- copy is the single source of truth. The shape:
--   [
--     { "heading": "What you pay",     "body": "We charge per sale..." },
--     { "heading": "When you pay",     "body": "Nothing is charged..." },
--     ...
--   ]
--
-- Any other rows (none on prod; staging may have one or more) get fallback-
-- wrapped as a single section under the heading "Terms" so we don't lose
-- text. Defensive — should match exactly zero rows in practice.

-- Step 1: add the new column nullable so we can populate it before NOT NULL.
ALTER TABLE "TermsVersion" ADD COLUMN "bodySections" JSONB;

-- Step 2: populate the v1 row with the canonical structured shape. Identified
-- by versionTag so we don't depend on row ids that differ between staging + prod.
UPDATE "TermsVersion"
SET "bodySections" = '[
  {
    "heading": "Sales Progressor — pricing",
    "body": "You''re adding a payment card so we can bill you for completed sales. Here''s exactly how that works."
  },
  {
    "heading": "What you pay",
    "body": "We charge per sale, and only once it exchanges — never before. For a sale you progress in-house, the fee is £59. For a sale you pass to our team to progress, the fee depends on the agreed sale price at exchange: £250 for sales up to £349,999, £300 for £350,000 to £499,999, and £350 for £500,000 and above."
  },
  {
    "heading": "When you pay",
    "body": "Nothing is charged until a sale exchanges. Fees for sales that exchange in a given month are collected together as a single payment at the end of that month. You''ll see the running total building on your billing page throughout the month, so there are no surprises."
  },
  {
    "heading": "Your free trial",
    "body": "Any sale you add in your first 14 days is free for its whole life — even when it exchanges months later, you won''t be charged for it. The 14 days run from the first sale you add."
  },
  {
    "heading": "If a payment fails",
    "body": "Sales already underway carry on as normal. But until the payment is sorted, you won''t be able to add new sales. We''ll show you clearly that a payment needs attention and how to fix it."
  },
  {
    "heading": "Who''s billed",
    "body": "Billing is handled by the agency''s director. Only a director can see or manage payment details and invoices."
  },
  {
    "heading": "VAT",
    "body": "We''re not currently VAT-registered, so no VAT is added to these fees. If that changes, we''ll let you know before it affects what you pay."
  }
]'::jsonb
WHERE "versionTag" = '2026-05-payments-v1';

-- Step 3: defensive fallback for any rows we don't know about (none expected).
-- Wrap their body text as a single "Terms" section so we don't lose data.
UPDATE "TermsVersion"
SET "bodySections" = jsonb_build_array(
  jsonb_build_object('heading', 'Terms', 'body', "body")
)
WHERE "bodySections" IS NULL;

-- Step 4: enforce NOT NULL now that every row is populated.
ALTER TABLE "TermsVersion" ALTER COLUMN "bodySections" SET NOT NULL;

-- Step 5: drop the old single-blob column. No going back without restoring
-- from backup — but the data is preserved in bodySections.
ALTER TABLE "TermsVersion" DROP COLUMN "body";
