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

### Increment 3 — First outsourced file free · pending

Planned: decide "is this the agency's first outsourced file?" at exchange (concurrency-guarded), render as an explicit discount line. Decisions D3, D4, D5.

### Increment 4 — Remove the 14-day trial plumbing · pending (Phase 2 overlap)

Planned: retire the trial window from the create-time free computation now that self is free by type.

**→ Phase 1 verification link: provided once increments 2–4 land.**
