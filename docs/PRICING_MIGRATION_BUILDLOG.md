# Pricing Migration — Build Log

**Running record of every change made during the pricing-model migration.** One entry per increment. Companion to the plan/decisions in [PRICING_MODEL_MIGRATION_AUDIT.md](PRICING_MODEL_MIGRATION_AUDIT.md).

Every code/schema/copy change gets an entry here: what changed (plain English), files, commit, verification, and whether it is on staging / prod. Nothing ships free-facing to prod until the atomic cutover (see plan §25).

---

## Verification protocol (agreed 2026-08-31)

- **Every change is logged in this file.**
- **At the end of every full phase**, a local, seeded (if needed) link is provided so Ellis can verify the change in the running app, with a note on exactly what to look at. Increments within a phase are logged but the verification link comes at the phase boundary.

---

## Phase 1 — Billing engine (in progress)

### Increment 1 — Self-progress is free · commit `a4dd22b4` · 2026-08-31 · staging

**Plain English:** A sale an agency runs itself is now worth £0. When it exchanges, the exchange is recorded but no bill is created — self-progress is genuinely free, decided by the kind of sale (D1), regardless of any old trial stamp. Also fixes the dashboard trap where free self-progress sales were valued at £59 (they now read £0). Outsourced £250/£300/£350, legacy deals, and VAT are unchanged.

**Files:**
- `lib/billing/fee.ts` — `grossFee` returns £0 for `self_managed`; retired the £59 `IN_HOUSE_FEE_PENCE` constant.
- `lib/services/billing-trigger.ts` — `maybeStampExchange` skips `self_managed` (exchanges but never sets `billedAtExchange`), so no invoice line is ever created (D2, off-invoice).
- `lib/billing/__tests__/fee.test.ts` — new; 11 tests pinning self = £0 and guarding outsourced bands, legacy override, VAT split.

**Decisions:** D1 (free by service type), D2 (off-invoice).
**Verified:** `tsc` clean; `jest lib/billing/__tests__/fee.test.ts` → 11/11 pass.
**Status:** staging (unpushed at time of writing). Not prod. No customer-visible change yet.

### Increment 2 — freeReason + price-version stamp · 2026-08-31 · staging

**Plain English:** Every sale now carries a "why is this free" label and a stamp of the price rules it was created under. The label lets internal reporting tell the free *product* (self-progress) apart from the free *giveaway* (first outsourced file) apart from old trial files. The price-version stamp means a future price change never silently re-prices sales already in flight. No change to what bills — this is labelling + future-proofing.

**Files:**
- `prisma/schema.prisma` — new enum `FreeReason` (permanent_free_self / first_outsourced_free / legacy_trial); new `PropertyTransaction` columns `freeReason`, `pricingVersion`, `firstOutsourcedFree`; new `InvoiceLineKind` value `intro_credit` (for increment 3's discount line).
- `prisma/migrations/20260831000000_free_reason_pricing_version/migration.sql` — adds the enum/columns and backfills: existing rows → `pricingVersion = 'legacy_2026_paid_self'`; not-yet-billed self-managed → `freeReason = 'permanent_free_self'`; old trial-free outsourced → `freeReason = 'legacy_trial'`.
- `lib/billing/pricing-version.ts` — new; `CURRENT_PRICING_VERSION = "2026-08_free_self"`.
- `lib/services/transactions.ts`, `app/actions/transactions.ts` (draft promotion — the main agent new-sale path), `app/api/claim/route.ts` — stamp `freeReason` + `pricingVersion` at every real-sale create.

**Decisions:** D6 (freeReason), D7 (price-version stamp).
**Verified:** `prisma generate --no-engine` clean; `tsc` clean. Migration SQL validated by review (applies to the staging DB on the next staging deploy — Law 3).
**Status:** staging (code committed). **The migration applies to a DB when a deploy runs `prisma migrate deploy` (staging first). Code that reads/writes the new columns needs the migration applied first** — flagged for the push/verification step.
**Note:** `firstOutsourcedFree` + `intro_credit` are added now (one migration) but only wired in increment 3.

### Increment 3 — First outsourced file free · 2026-08-31 · staging

**Plain English:** When an outsourced sale exchanges, we check whether it's the agency's very first outsourced sale to reach exchange. If it is (and they've never had one before — new agencies only, D3), it's on us: the sale bills its normal band fee, and a full-value credit cancels it, so the invoice reads "£300 · first file free −£300 = £0" (visible and auditable, D4). Consumed once, at exchange, and exchange is final (D5). Every later outsourced sale bills normally.

**How it nets to zero without new plumbing:** the free file gets `billedAtExchange` set (so it appears on the invoice at the band price) plus a `CreditNote` for the full fee. The existing accrual + running-total code already turns an unapplied CreditNote into a visible `credit_applied` line and nets it against the total — so no accrual or live-total changes were needed.

**Files:**
- `lib/services/billing-trigger.ts` — outsourced first-free decision at exchange: count prior exchanged outsourced files for the agency; if none, stamp `firstOutsourcedFree` + `freeReason='first_outsourced_free'` + `billedAtExchange` + `priceAtExchange`, and write a full-value `CreditNote`. Bilateral-safe (credit written once). Imports `computeFee`.

**Decisions:** D3, D4, D5.
**Verified:** `tsc` clean. (End-to-end DB behaviour verified at the Phase 1 seeded link.)
**Status:** staging (code committed).

---

## Phase 2 — remove the trial (in-app UI)

Approved against the Phase-2 mockup artifact (billing page free-plan state, outsourcing charges with first-file-free credit, reframed card prompt, retired trial surfaces).

### Increment 2A — new-sale gate removed · 2026-08-31 · staging

**Plain English:** The old wall that blocked a director with no card from adding *any* new sale after the trial is gone. A self-progressing agency now always reaches the New Sale form, forever, no card. The earnings builder's "sending to us is free" flag no longer keys off a 14-day window — it's now true when it would be the agency's first outsourced sale (free first file). Card capture for billable outsourcing moves to the hub nudge (increment 2B).

**Files:** `app/agent/transactions/new/page.tsx` — removed the `TrialExpiredModal` page gate + `TRIAL_WINDOW_MS` + trial-only imports; replaced the `withinTrial` window with `priorExchangedOutsourced === 0` (first-outsourced-free). Prop still named `withinTrial` (meaning repurposed; rename is a later cleanup).

**Verified:** `tsc` clean.
**Status:** staging (committed).

### Increments 2B–2D — pending
- 2B: reframe the card-capture modal/banner/nudge copy (trial-ended → "add a card to send sales to us"), and gate the nudge to outsourcing only.
- 2C: billing hub reframe (PlanTermsCollapsed "Free" + no Trial column; MetricsStrip relabel; the free-plan billing page state).
- 2D: signup microcopy (ClaimSignupForm) + earnings-builder comment + `lib/billing/trial-state.ts` cleanup.

---

## Deferred / follow-ups

- **First-outsourced-free concurrency hardening (D3a).** The "is this the first?" check is a count, safe at pre-launch scale (a same-agency simultaneous double-exchange cannot happen yet). Before real volume, add a Postgres **advisory lock on `agencyId`** at the start of the outsourced decision (never throws, so it can't poison the shared exchange transaction — unlike a unique-index violation). The `firstOutsourcedFree` column is ready for it.
- **D13a** — outstanding-outsourced-debt ceiling + escalation (from the failed-payment decision).
- **D5a** — an erroneous exchange later undone should clear `freeReason`/`firstOutsourcedFree` (build edge; belongs with the reversal path in a later increment).
- **`intro_credit` invoice-line kind** was added (increment 2) but is currently unused — the CreditNote path uses `credit_applied`. Keep for a possible future inline-discount representation, or drop in a cleanup.

### Increment 4 — Remove the 14-day trial (create-time) · 2026-08-31 · staging

**Plain English:** The old rule "any sale added in your first 14 days is free" is gone. A new sale is no longer made free by a trial window. Self-progress is free because of what it is (handled at exchange); an outsourced sale bills unless it's the free first one (decided at exchange). A comped agency (the deliberate "everything free" setting) is unchanged, and the first-sale activation timestamp is still recorded for analytics.

**Files:**
- `lib/services/trial.ts` — `stampTrialState` no longer applies a 14-day window: it sets the first-submission anchor, returns true only for a comped (`feeTier='free'`) agency, else false. Removed the `TRIAL_WINDOW_MS` constant. (The trial *UI* — banners, the new-sale card gate — is Phase 2.)

**Decisions:** part of removing the trial model.
**Verified:** `tsc` clean; fee tests (11) still green.
**Status:** staging (code committed).

---

## Phase 1 — billing engine: CODE COMPLETE (2026-08-31)

All four increments committed on staging. Net effect: self-progress is free by type; outsourced bills its band; the first outsourced file per new agency is free (visible credit); the 14-day trial is gone from the engine; every sale is labelled (`freeReason`) and version-stamped (`pricingVersion`). Nothing is on prod.

**→ Phase 1 verification:** see the verification section at the bottom of this file.

---

## Phase 1 verification (how to see it)

**What to check** (on the director billing page `/agent/billing` and a file's sidebar):

| Scenario | Expected after exchange |
|---|---|
| A self-progress sale exchanges | **£0** — no invoice line, nothing on the billing total. `freeReason = permanent_free_self`. |
| A new agency's **first** outsourced sale exchanges | Bills its band fee **and** a full-value credit — billing page shows the fee in the total and the same amount in pending credits, netting **£0**. `firstOutsourcedFree = true`, `freeReason = first_outsourced_free`. |
| That agency's **second** outsourced sale exchanges | Bills its band (£250/£300/£350) normally, no credit. |
| Any sale created | Carries a `pricingVersion` stamp. |

**Blocker on producing the live link:** the increment-2 migration must be applied to whatever DB the app runs against, and the code reads/writes the new columns. The local `.env` contains **both a staging and a production `DATABASE_URL`**, so self-applying the migration or a seed is unsafe (could hit prod). Safe options, pick one:

1. **Push Phase 1 to `staging`.** Vercel runs `prisma migrate deploy` against the **staging** DB (Law 3, no prod risk), then a seed script sets up the three sales above and I give you the **staging** verification URL.
2. **Local:** confirm the dev server's active `DATABASE_URL` is the **staging** one; I apply the migration to it and seed, then give you the **localhost:3001** link.

Either way the seed uses the real create + exchange paths so it genuinely exercises the new billing code, not faked rows.

### VERIFIED on staging · 2026-08-31

Migration applied to staging (the seed used the new columns successfully). `scripts/seed-pricing-verification.ts` ran against staging and produced exactly the intended behaviour:
- **First outsourced sale** (£425k): `freeReason=first_outsourced_free`, `firstOutsourcedFree=true`, billed at the £300 band **with a £300 "First outsourced file free" CreditNote** → nets to £0.
- **Second outsourced sale** (£400k): `freeReason=null`, bills its band.
- **Self-progress sale**: skipped (free, no bill).
- **Accrual**: 1 invoice, 2 fee lines + 1 credit applied.

**View it:** dev server at `http://localhost:3001/agent/billing`, logged in as `pricing-verify@thesalesprogressor.test`. The self-progress sale never bills; the first outsourced shows a fee + a first-file-free credit netting to £0; the second bills its band. (The file sidebar still shows the old £59 self copy — that's Phase 4 copy, not done yet.)
