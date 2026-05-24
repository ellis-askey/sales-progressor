# Payments build plan

**Status:** plan, not yet building. Founder will walk before any code.
**Owner:** Ellis + Claude Code session.
**Source-of-truth dependencies:** discovery findings in this thread; bilateral-pair behaviour in [lib/services/milestones.ts:53-56](../../lib/services/milestones.ts#L53), milestone completion hook at [lib/services/milestones.ts:458](../../lib/services/milestones.ts#L458), reversal hook at [lib/services/milestones.ts:1003](../../lib/services/milestones.ts#L1003), claim-signup flow at [components/claim/ClaimSignupForm.tsx:62-127](../../components/claim/ClaimSignupForm.tsx#L62).

---

## Goal

Ship the locked payments model — charge on exchange, 7-day frozen trial, tiered outsourced pricing, month-end accrual, own billing page + Stripe Elements, VAT-flippable — in safely staged, individually verifiable PRs against real money mechanics.

---

## Non-negotiables (carried verbatim from discovery)

1. **Bilateral footgun:** VM19 and PM26 auto-complete each other within a single PropertyTransaction. The billing trigger fires **once per transaction**, gated to one side, guarded by a `billedAtExchange` timestamp on the row that any code path checks before recording a charge. Never bill twice for the same transaction.
2. **Frozen trial fields, stamped at create:** `Agency.firstSubmissionAt` set once on the agency's first-ever PropertyTransaction. `PropertyTransaction.freeOnExchange` computed at create from `(now − firstSubmissionAt) ≤ 7 days` and **never recomputed afterwards**. No code path reads trial state at exchange time.
3. **Reversal hung on `executeUndoMilestone`:** when VM19/PM26 is undone, if `billedAtExchange` exists and the invoice for that month hasn't been issued → clear the marker and drop from the building invoice. If the invoice has been issued → leave history intact and emit a `CreditNote` against the next month's invoice. No cash refunds.
4. **`PropertyTransaction.priceAtExchange` snapshot** captured at the completion hook from `purchasePrice`. Billing reads from the snapshot, not the live field. Immune to later price edits.
5. **VAT scaffolding on day one:** line-item invoice structure + `Agency.vatRegisteredAt` field present from the first migration. Rendering hides the VAT line while `vatRegisteredAt` is null. The flip is purely a config change, not a schema migration.
6. **Pricing acknowledgement gated on first card capture:** `PricingAcknowledgement { agencyId, acknowledgedAt, acknowledgedByUserId, termsVersion }` written before the first Stripe Elements card-capture POST is allowed to succeed.

**Out of this plan (logged elsewhere):**
- Document upload size cap on `TransactionDocument` — add to `docs/active/TODO.md` as a separate task.
- `FileTimeSession` wiring for outsourced labour cost tracking — separate, future.

---

## Staging order

Eight PRs. Each one ends at a verifiable boundary before the next is opened. Schema migrations follow `npm run db:migrate:staging` → manual verification → PR review → `npm run db:migrate:prod` (which has the interactive `yes` guard at [scripts/migrate-prod.mjs](../../scripts/migrate-prod.mjs)).

---

### PR 1 — Schema scaffolding (zero behaviour change)

**What changes:**
- New fields on `Agency`: `firstSubmissionAt: DateTime?`, `vatRegisteredAt: DateTime?`, `vatRateBps: Int?` (basis points — `2000` = 20%, future-proofs reduced/zero rates), `paymentFailedAt: DateTime?`, `newFileCreationBlockedAt: DateTime?`, `stripeCustomerId: String?`.
- New fields on `PropertyTransaction`: `freeOnExchange: Boolean @default(false)`, `exchangedAt: DateTime?` (set on VM19/PM26 completion for ALL files, including trial), `billedAtExchange: DateTime?` (set only when the exchange generates a charge — trial files leave this null), `priceAtExchange: Int?` (pence).
- New models: `Invoice`, `InvoiceLine`, `PricingAcknowledgement`, `TermsVersion`, `CreditNote`. Field shapes drafted in the PR body; not finalised here.
- `TermsVersion` stores `{ versionTag, body, effectiveFrom, createdAt }` — the actual disclosure text, not just an identifier. `PricingAcknowledgement` foreign-keys to `TermsVersion` so we can always reproduce exactly what the director agreed to if a charge is queried.
- Backfill (inline in the migration SQL — matches repo convention, see [prisma/migrations/20260523211108_transaction_hold_periods/migration.sql](../../prisma/migrations/20260523211108_transaction_hold_periods/migration.sql)): existing agencies get `firstSubmissionAt = (earliest PropertyTransaction.createdAt for that agency)`. Agencies with zero transactions stay null — semantically correct, they haven't submitted yet.

**Files touched:** [prisma/schema.prisma](../../prisma/schema.prisma), new migration under `prisma/migrations/<timestamp>_payments_scaffolding/migration.sql` (hand-authored SQL with inline backfill, applied via `prisma migrate deploy`).

**Migration path:**
1. Edit `prisma/schema.prisma` with the new fields/models
2. Hand-author the migration SQL file (no `prisma migrate dev` — that would create a shadow DB on staging)
3. `npm run db:migrate:staging` (runs `prisma migrate deploy`)
4. `npx prisma generate` to update the client
5. `npx tsc --noEmit` green
6. `npm run db:migrate:status:staging` to confirm clean state
7. Verify backfill: every agency with ≥1 transaction has non-null `firstSubmissionAt`
8. PR review + walk with Ellis
9. `npm run db:migrate:prod` (with the interactive `yes` guard)

**Verification before PR 2 opens:**
- Schema fields visible in Supabase staging console
- `select count(*) from "Agency" where "firstSubmissionAt" is null` returns 0 post-backfill
- `npx tsc --noEmit` green
- Nothing in product behaviour has changed (no code path reads the new fields yet)

**Rollback:** straight `prisma migrate resolve --rolled-back` + remove fields. Safe because no code reads them.

---

### PR 2 — Trial stamp + free-on-exchange flag (write-only)

**What changes:**
- Single helper `stampTrialState(agencyId, tx)` called from inside the PropertyTransaction-create write path. If `agency.firstSubmissionAt` is null, set it to now. Compute `freeOnExchange` from the delta. Returns the flag for the caller to set on the new transaction.
- Wired into the canonical create path used by both manual create and claim-signup.

**Files touched:** new `lib/services/trial.ts`, edits to [lib/services/transactions.ts](../../lib/services/transactions.ts) and [app/api/claim/route.ts](../../app/api/claim/route.ts).

**Verification:**
- Staging: create a brand-new agency via signup, create a sale → `firstSubmissionAt` set, `freeOnExchange = true`
- Create a second sale immediately → `freeOnExchange = true`, `firstSubmissionAt` unchanged
- Manually backdate `firstSubmissionAt` by 8 days in staging DB, create a third sale → `freeOnExchange = false`
- Walk a fresh claim-signup end to end → `freeOnExchange = true` on the claimed transaction, `firstSubmissionAt` set on the brand-new agency
- `npx tsc --noEmit` green

**Rollback:** revert the helper call; flag stays set on rows already written but is read by nothing yet.

---

### PR 3 — Exchange snapshot + billable marker (write-only)

**What changes:**
- Post-completion hook in [lib/services/milestones.ts:458](../../lib/services/milestones.ts#L458) (`completeMilestone`) for VM19/PM26. After the atomic transaction commits:
  - Determine the primary side (the one the user explicitly confirmed, not the auto-cascaded counterpart) — use the `milestoneDefinitionId` originally passed to `completeMilestone`, not the bilateral partner.
  - Always set `exchangedAt = now()` (idempotent — no-op if already set). This is the "did it exchange?" signal, written for trial and paying files alike.
  - If `freeOnExchange = true` → stop here. Trial files exchange without billing; `billedAtExchange` and `priceAtExchange` stay null. This keeps the audit clean: a count of "trial exchanges (value given away)" is just `where freeOnExchange = true and exchangedAt is not null`, distinct from paid exchanges.
  - Otherwise: if `billedAtExchange` is already set → no-op (idempotent against retries and re-entry from the bilateral pair). Else snapshot `purchasePrice` → `priceAtExchange` and set `billedAtExchange = now()`.

**Files touched:** [lib/services/milestones.ts](../../lib/services/milestones.ts), new `lib/services/billing-trigger.ts` for the hook logic.

**Verification:**
- Staging: complete VM19 on a test vendor file (non-trial) → `exchangedAt` set, `priceAtExchange` snapshotted, `billedAtExchange` set
- Verify the bilateral partner PM26 completion did NOT set `billedAtExchange` a second time
- Complete a free-trial file's VM19 → `exchangedAt` set, `billedAtExchange` and `priceAtExchange` both null
- Edit `purchasePrice` after exchange → `priceAtExchange` does not change
- Try to re-fire the completion through any code path → idempotent, no double-write

**Rollback:** revert the hook; rows already snapshotted keep their values but nothing reads them yet.

---

### PR 4 — Reversal handling on `executeUndoMilestone`

**What changes:**
- Post-reversal hook in [lib/services/milestones.ts:1003](../../lib/services/milestones.ts#L1003) (`executeUndoMilestone`) for VM19/PM26. After the atomic reversal commits:
  - If `billedAtExchange` is set and no invoice has been issued yet for that month → clear `billedAtExchange`, clear `priceAtExchange`. Drops it from the building invoice.
  - If `billedAtExchange` is set and the invoice for that month has been issued → leave the timestamp + snapshot intact (history), and write a `CreditNote` against the agency for the same amount, to be applied to next month's invoice.

**Files touched:** [lib/services/milestones.ts](../../lib/services/milestones.ts), `lib/services/billing-trigger.ts`.

**Verification:**
- Staging: complete VM19, then immediately undo → `billedAtExchange` cleared
- Complete VM19, fake an issued invoice for the current month, undo → `billedAtExchange` retained, `CreditNote` row created
- Bilateral case: undo cascades to PM26 — no second CreditNote written

**Rollback:** revert the hook; live billing isn't on yet so no real-world impact.

---

### PR 5 — Invoice accrual + director-facing running total

**What changes:**
- Daily cron `accrue-invoices` reads exchanges with `billedAtExchange` set in the current billing month (Europe/London boundary; see `lib/billing/period.ts` below) and accrues durable lines onto a single open `Invoice` per agency per month. Applies any unapplied `CreditNote` rows.
- Month-end cron (or 1st-of-month) flips the prior month's open invoice from `building` → `issued` and triggers Stripe invoice creation (in PR 7 — for now just status flip + audit row).
- New page `/agent/billing` shows the director the current month's running total. **The total and line breakdown are computed live at page-load** from `PropertyTransaction` rows where `billedAtExchange` is set in the current billing month and `agencyId` matches — NOT from `InvoiceLine` rows. This makes "watch it build" feel instant regardless of cron cadence. The cron writes durable `InvoiceLine` rows for billing history and Stripe issuance; the page never depends on the cron having run.
- Negotiators denied at the route guard.

**Carryover items closed in this PR (flagged in PR 3 and PR 4):**

- **`lib/billing/fee.ts`** — single shared fee function knowing both in-house flat (£59) and outsourced tiers (£250/£300/£350). The accrual cron and `lib/services/billing-reversal.ts` both consume it. Replaces the local `feePence()` in [billing-reversal.ts](../../lib/services/billing-reversal.ts) that was inlined for PR 4 focus. `lib/services/fees.ts` currently only knows outsourced tiers (clientType=standard) — the new helper is the single source of truth going forward; the legacy `calculateOurFee` is left in place for any analytics already reading it (no breakage, no duplication for the billing path).

- **Partial unique index on `CreditNote`** — Postgres `CREATE UNIQUE INDEX … WHERE "appliedAt" IS NULL` so the database itself prevents two unapplied CreditNotes per transaction. Closes PR 4 branch (b)'s concurrency gap (two concurrent `executeUndoMilestone` calls on the same transaction couldn't both write a CreditNote, even theoretically). Structural defence at the DB layer, mirroring the `@@unique([agencyId, monthStart])` trick on `Invoice`. The existing-credit lookup in `handleExchangeReversal` becomes belt-and-suspenders rather than the only line of defence. Migration is hand-rolled (Prisma's `@@unique` doesn't express partial indexes; the constraint lives in the migration SQL only).

**Files touched:** `app/api/cron/accrue-invoices/route.ts`, `vercel.json` (add cron entry), `app/agent/billing/page.tsx`, role-guard at the page level.

**Verification:**
- Staging: complete VM19 on three test files (mix of in-house and outsourced bands) → invoice page shows three lines, correct rate per band, correct total
- Add a fourth → invoice updates next cron tick
- Confirm negotiators get 403 on `/agent/billing`
- Confirm the outsourced band reads from `priceAtExchange`, not the live `purchasePrice`

**Rollback:** disable the cron entry; invoice rows stay but are never issued.

---

### PR 6 — Stripe Elements card capture + pricing acknowledgement gate

**What changes:**
- Stripe SDK installed, `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` added (founder action in `docs/active/ELLIS_MANUAL_TODO.md`).
- `/agent/billing/payment-method` page renders Stripe Elements card form. On mount it checks for a `PricingAcknowledgement` row for the agency. If none, renders the pricing disclosure first, sourced from the active `TermsVersion.body`. An "I understand, billed monthly on exchange" button writes the `PricingAcknowledgement` row (with FK to the `TermsVersion` shown) before unlocking the card form.
- Stripe Customer created on first card capture. `Agency.stripeCustomerId` set.
- No charging yet — just card on file.

**Hard pre-merge requirement:** The `TermsVersion.body` text is **a design/voice deliverable, not a code task**. Build the gate with a **clearly-marked placeholder** (e.g. `body: "[PLACEHOLDER — DO NOT SHIP. Final pricing disclosure copy pending design/voice pass — see docs/active/payments-build-plan.md PR 6 flag.]"`). Do not invent the final terms wording. PR 6 must not merge to master until Ellis has supplied the real disclosure copy and it has replaced the placeholder via a separate `TermsVersion` row insert. The PR description must call this out as a merge blocker.

**Files touched:** new `lib/stripe.ts`, `app/agent/billing/payment-method/page.tsx`, `app/api/billing/setup-intent/route.ts`, `app/api/billing/acknowledge/route.ts`.

**Verification:**
- Staging: brand-new agency, attempt to access card form → pricing disclosure shown first
- Acknowledge → form unlocks, capture a Stripe test card → `Agency.stripeCustomerId` set
- Re-visit → no second acknowledgement prompt, card-on-file shown
- Negotiators denied at the route guard

**Rollback:** disable the route; acknowledgement rows stay but are read by nothing else yet.

---

### PR 7 — Real charging + failed-payment block

**What changes:**
- Month-end cron's "issue invoice" step now creates a Stripe invoice from the issued `Invoice` rows and charges the customer's default payment method.
- Stripe webhook handler at `app/api/webhooks/stripe/route.ts`:
  - `invoice.payment_succeeded` → mark `Invoice.paidAt`, clear `Agency.paymentFailedAt` and `newFileCreationBlockedAt`
  - `invoice.payment_failed` → set `Agency.paymentFailedAt = now()` if not already set
- Daily cron checks: if `paymentFailedAt + 7 days < now()` and not already blocked → set `newFileCreationBlockedAt = now()`
- `createTransaction` (manual path) and `/api/claim` (claim path) both check `Agency.newFileCreationBlockedAt` and reject with a clear "a payment failed — update your card to add new files" error and a link to `/agent/billing/payment-method`.
- Director-facing banner on `/agent/hub` when blocked.

**Files touched:** `app/api/webhooks/stripe/route.ts`, `app/api/cron/check-failed-payments/route.ts`, `vercel.json`, [lib/services/transactions.ts](../../lib/services/transactions.ts), [app/api/claim/route.ts](../../app/api/claim/route.ts), hub banner component.

**Verification:**
- Staging: trigger a Stripe test card that fails → webhook fires, `paymentFailedAt` set
- Backdate `paymentFailedAt` by 8 days in DB, run the check cron → `newFileCreationBlockedAt` set
- Attempt to create a new transaction → blocked with the expected error
- Update card to a working test card, trigger Stripe retry → both flags clear, banner disappears, file creation re-enabled
- Verify the block does NOT affect existing files (chases keep firing, comms work, milestone completion still records)

**Rollback:** disable the webhook + revert the create-transaction block check.

---

### PR 8 — VAT flip rehearsal (staging only, do not deploy)

**What changes:** none to behaviour or production. Pure verification that the flip works.

**Verification:**
- Staging: set `Agency.vatRegisteredAt` on a test agency
- Confirm invoice rendering now shows `£49.17 + £9.83 VAT (20%)` instead of `£59`
- Confirm running total on `/agent/billing` shows both lines
- Confirm Stripe invoice line items match
- Set back to null → reverts to single inclusive figure

**Outcome:** prove the flip is a one-field change, no schema migration needed when we actually register. No prod deploy from this PR.

---

## Decisions locked (2026-05-24)

1. **VAT rate stored as basis points** (`vatRateBps: Int?`, `2000` = 20%). Lossless for future reduced/zero rates.
2. **Two fields, not one:** `exchangedAt` (did it exchange?) + `billedAtExchange` (did it bill?). Trial exchanges set the former only — trivially countable as "value given away."
3. **Terms text stored versioned, not just identifier.** `TermsVersion` model holds the actual disclosure body; `PricingAcknowledgement` FKs to it. First tag: `"2026-05-payments-v1"`. We can always produce the exact text the director agreed to.
4. **Daily accrual cron at 03:00 UTC** writes durable invoice rows. The `/agent/billing` running total reads live from `PropertyTransaction.billedAtExchange` rows so "watch it build" is instant regardless of cron tick.

## Gating between PRs

Each PR boundary is a verification pause. **Specifically: walk PR 1's staging state with Ellis before PR 2 opens.** The pattern repeats per PR — no PR N+1 begins until PR N's staging verification has been walked.

---

## What this plan deliberately does NOT include

- Document upload size caps (logged separately in `docs/active/TODO.md`)
- Outsourced labour cost tracking (`FileTimeSession` wiring, future)
- Self-serve plan changes / agency-initiated cancellation
- Refund flow (model is credit-only, not cash refunds)
- Multi-currency
- Per-negotiator billing or seat counts (whole-agency only)
