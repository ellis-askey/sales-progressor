# Billing Terms (Pricing Acknowledgement)

> **The "thing they agree when they put card details in".** Presented inline on the billing page when a director clicks "Add a card" — they must tick the acknowledgement before Stripe Elements unlocks for card capture. The acceptance is recorded in `PricingAcknowledgement` (timestamped, version-tagged) and gates future card-on-file actions.

**Source (live)** — versioned content stored in DB, three places must stay in sync:
1. **Database row** (`TermsVersion` table, `versionTag = '2026-05-payments-v1'`, column `bodySections` JSONB) — what users actually acknowledge. Live row inserted on prod 2026-05-25 (id `cmplcpqez0000daeduh8d2ia2`).
2. **Migration SQL** (history of record): [`prisma/migrations/20260525090000_terms_version_body_sections/migration.sql`](../../prisma/migrations/20260525090000_terms_version_body_sections/migration.sql) lines 28-57 — inserted into prod via `prisma migrate deploy`.
3. **Insertion script** (re-runnable, used for fresh envs and prod): [`scripts/insert-prod-terms-v1.ts`](../../scripts/insert-prod-terms-v1.ts) lines 24-53 — uses the same content as the migration.

**Rendered by:** `RedesignedDisclosure` component (`components/billing/hub/RedesignedDisclosure.tsx`) on `/agent/account/billing` when the director hasn't yet acknowledged.

**Acknowledgement model:** `PricingAcknowledgement` row created per director per version. New material changes require a NEW `versionTag` (not editing the existing one in place — that would silently revoke historic consents and bypass the re-acknowledge flow).

**Version tag:** `2026-05-payments-v1` (only version that exists; first deployed copy)

---

## Current text (verbatim — what directors see when adding a card)

### Sales Progressor — pricing

You're adding a payment card so we can bill you for completed sales. Here's exactly how that works.

### What you pay

We charge per sale, and only once it exchanges — never before. For a sale you progress in-house, the fee is £59. For a sale you pass to our team to progress, the fee depends on the agreed sale price at exchange: £250 for sales up to £349,999, £300 for £350,000 to £499,999, and £350 for £500,000 and above.

### When you pay

Nothing is charged until a sale exchanges. Fees for sales that exchange in a given month are collected together as a single payment at the end of that month. You'll see the running total building on your billing page throughout the month, so there are no surprises.

### Your free trial

Any sale you add in your first 14 days is free for its whole life — even when it exchanges months later, you won't be charged for it. The 14 days run from the first sale you add.

### If a payment fails

Sales already underway carry on as normal. But until the payment is sorted, you won't be able to add new sales. We'll show you clearly that a payment needs attention and how to fix it.

### Who's billed

Billing is handled by the agency's director. Only a director can see or manage payment details and invoices.

### VAT

We're not currently VAT-registered, so no VAT is added to these fees. If that changes, we'll let you know before it affects what you pay.

---

## How versioning works (important context for the improvement pass)

This isn't a static page like the others in this folder. It's **versioned content that gates a financial action**. Mechanics:

- Every TermsVersion row has a `versionTag` (e.g. `2026-05-payments-v1`) and a `bodySections` JSONB column.
- When a director first reaches the billing page without a valid acknowledgement, the `RedesignedDisclosure` renders the current TermsVersion's sections and requires a tick before Stripe Elements unlocks.
- Their tick creates a `PricingAcknowledgement` row pointing at that version.
- If the live TermsVersion in the DB changes its `versionTag`, all existing acknowledgements are still valid against the OLD version — but the director now needs to re-acknowledge the new one before their next card action.
- **Editing `bodySections` on the EXISTING `2026-05-payments-v1` row WITHOUT changing the tag is the wrong move** — it silently mutates what users have already accepted, with no re-acknowledge prompt. Always ship a new `versionTag` for material changes.

**For the improvement pass**: most edits to the copy in this doc that are NON-material (typo fixes, clarifications, formatting) could in principle be applied to the existing row. Material changes (pricing change, scope change, payment model change) must ship as a new TermsVersion.

What counts as material vs non-material is a judgment call best made by legal counsel. Conservative default: any text change worth making is probably worth versioning. Avoid mid-version edits unless purely typographical.

---

## Pre-existing review flags

**None in the source code yet.** Unlike privacy/terms/cookies, this content didn't get the `LEGAL REVIEW REQUIRED` comment treatment when it was written — likely because it was authored as the canonical copy you signed off on personally (per the migration SQL comment: *"the v1 content is inlined here so the migration is self-contained — Ellis's signed-off copy is the single source of truth"*).

That doesn't mean it doesn't need legal review — it means there are no specific flagged sections. **The whole document needs a counsel pass given it now governs real payments on prod.**

---

## Observations for the improvement pass

- **No company entity / address.** Unlike Privacy and Terms which name "The Sales Progressor Ltd", this document never identifies who's doing the billing. UK contract law requires the parties to be identifiable. Worth adding a single line: "Sales Progressor is operated by The Sales Progressor Ltd [registered number, registered address]."

- **Pricing bands are stated bare without a "we may change this" clause.** What happens to existing customers when we change pricing? Most SaaS terms include: "We may change pricing with [X days] notice; changes apply to new sales after the effective date; existing in-flight sales are honoured at the original price." This is missing.

- **"Until the payment is sorted, you won't be able to add new sales" — needs sharper definition.** What counts as "sorted"? When does the block lift? What's the grace period before it kicks in? The actual code has clear answers (14 days warning → 7 days grace → blocked, per the failed-payment system) but the copy here is vague. Either add specifics or accept the trade-off (vagueness is more readable, specifics matter if disputed).

- **No definition of "exchange".** "We charge per sale, and only once it exchanges — never before." Exchange has a specific technical meaning in English/Welsh conveyancing (exchange of contracts), but for a non-legal reader this could be unclear. The user is an estate agency director though, so this is probably fine — they know what exchange means. Worth verifying with counsel.

- **"You'll see the running total building on your billing page throughout the month"** is good plain English but creates a service commitment. If the billing page is ever broken/down during a month, are we in breach? Realistic answer: no, but worth a single softening clause ("subject to availability of the platform").

- **No mention of refunds or credit notes.** The system has a credit-note model (failed exchanges cancel the fee, generate a credit applied to next month). The director might not realise this — adding a sentence builds trust: "If a sale that exchanged is later un-done (e.g. milestone reverted), the fee is reversed as a credit against your next bill."

- **No mention of disputes / chargebacks.** Standard for any payment terms. What happens if the director disputes a charge? Is there an internal escalation before Stripe chargeback? Worth defining.

- **No "we own the data we generate; you own your data" clarity.** Crosses over with Terms of Service but worth a brief mention re: invoice records, billing history etc.

- **The VAT section sets up a notification obligation.** "If that changes, we'll let you know before it affects what you pay." Make sure we have a mechanism to honour this — VAT registration is a real possibility within the next 1-2 years if revenue grows. Recommend: when VAT registration happens, we MUST ship a new TermsVersion containing the VAT disclosure, AND email all directors with active card-on-file BEFORE the next billing cycle.

- **Trial period is well-defined** ("14 days from first sale added", "any sale added in those 14 days is free for life") — clear, defensible, no observations.

- **"Who's billed" section is essentially a role-gate restatement** rather than a contractual clause. It's correct and useful but reads more like a UI explanation than a billing term. Could be sharper: "The agency's director is the contracting party for billing purposes. Negotiators cannot manage payment details or view invoices."

- **Heading "Sales Progressor — pricing" is the LEAD section but reads as an intro paragraph.** Some readers might miss it. Consider:
  - Stronger opening framing (e.g. "By saving a card, you agree to the following pricing terms.")
  - Or moving the "what you're agreeing to" framing higher.

- **No GDPR/data clause re: card storage.** Worth adding: "Card details are stored by Stripe, our payment processor — not by us. We can see the last 4 digits and card brand but not the full number."

- **No mention of failed-charge retry behaviour.** Stripe retries failed payments on its own schedule. The director might wonder "how many times will you try before I'm blocked?" — currently nothing tells them.

- **Cancellation of billing relationship not addressed.** If a director deletes their account or removes their card, what happens to in-flight charges? What about completed-but-unbilled sales for the current month? Worth defining.
