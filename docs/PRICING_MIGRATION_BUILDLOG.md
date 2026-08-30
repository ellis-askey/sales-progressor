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
