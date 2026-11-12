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

### Increment 2B — card-capture reframed · 2026-08-31 · staging
Hub payment nudge now fires only on a real outsourced charge with no card (billed outsourced file that isn't the free first one), never on a trial clock, never for self-progress. Banner + modal copy reframed to "add a card to send sales to us" (first outsourced free, then bill on exchange; self-progress stays free). Files: `PaymentMethodNudge.tsx`, `TrialBannerWithModal.tsx`, `TrialExpiredModal.tsx`. (Component name TrialExpiredModal kept — rename is later cleanup.) tsc clean.

### Increment 2C — billing hub reframed · 2026-08-31 · staging
Plan & terms panel: "Self-progress · Free" + "Outsourced · £250/£300/£350, first sale free"; the £59 "In-house" value and the whole "Trial" countdown column removed. Metrics: "Saved via trial" → "Given free"; "in-house" → "self-progress". Files: `PlanTermsCollapsed.tsx` (dropped the `trialState` prop), `billing/page.tsx` + polish `billing-hub-v2/page.tsx` (removed `getTrialState`/prop), `MetricsStrip.tsx`. tsc clean. (A dedicated "you're on the free plan" hero was left out — the reframed panel + empty invoice already read as free; noted as optional polish.)

### Increment 2D — signup + earnings copy · 2026-08-31 · staging
Claim signup subline "Free 14-day trial · No card needed" → "Free to use · No card needed". EarningsBuilder comments updated (the `withinTrial` prop now means "first outsourced free"). Files: `ClaimSignupForm.tsx`, `EarningsBuilder.tsx`. tsc clean.

**Cleanup noted (not user-facing):** `lib/billing/trial-state.ts` (`getTrialState`/`TrialState`) is now unused by the billing hub; leave for a later dead-code sweep. The `withinTrial` prop + `TrialExpiredModal` component name are misnomers now — rename in a later pass.

### Phase 2 verification (how to see it)

Local dev server `http://localhost:3001` (runs the committed Phase-2 code, points at the staging DB with the seeded verification agency). Log in as `pricing-verify@thesalesprogressor.test` / `PricingVerify2026!`.

- **`/agent/transactions/new`** — the form loads straight away; no "trial has ended" wall. A self-progressing agency is never blocked.
- **`/agent/billing`** — "Plan & terms" reads **Self-progress · Free** and **Outsourced · £250/£300/£350, first sale free**; no £59, no Trial countdown column. The building invoice shows the outsourced charges + the first-file-free credit. Because this agency has a billed outsourced sale and no card, the reframed nudge **"Add a card for your outsourced sales"** appears (not "your trial has ended").
- **Hub** — no trial banner / countdown for self-progress.

(Not in this phase: the file-sidebar "£59" line and the marketing site — Phase 4 / Phase 5.)

---

## Fix — first-outsourced-free representation · 2026-08-31 · staging

**Found by the Phase-2 screenshot pass** (the billing page showed £600, not £300): the first-outsourced-free CreditNote was invisible to the live running total once the accrual cron applied it (running-total reads transactions, not invoice lines), and a CreditNote also risked double-counting against the page's pending-credit figure before accrual ran.

**Fix:** dropped the CreditNote for first-outsourced-free. The `firstOutsourcedFree` flag now drives a **£0 "Outsourced — first file free" line** directly in both the accrual cron and the live running total, so the file bills its band conceptually but nets to £0 everywhere, regardless of cron timing. The band value stays recoverable from `freeReason` + `priceAtExchange` for reporting.

**Files:** `lib/services/billing-trigger.ts` (no CreditNote, just the flag), `lib/billing/accrual.ts` (£0 first-free line), `lib/billing/running-total.ts` (£0 first-free line). **Verified:** re-seeded staging → billing page shows £300.00, invoice reads "first file free £0.00" + "£300.00" (screenshot `pricing-migration-screens/01-billing-plan-and-invoice.png`). tsc clean.

**Screenshot workflow:** `pricing-shoot.mjs` (git-ignored) logs into the seeded staging agency via Playwright and captures every changed surface into `pricing-migration-screens/` (git-ignored). Re-run after any visual change.

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

### Increment 3A — Command Centre pricing copy fixed · 2026-08-31 · staging
Removed the actively-wrong pricing copy from the superadmin views: "In-house (£59)" breakdown labels -> "Self-progress (free)"; fee column "£59 / 250-350" -> "Free / £250-350"; rulebook "Self-managed £59 per exchange" -> "Self-progress free"; stale "7-day trial" footnote -> "self-progress never bills; first outsourced file free"; AgencyFeeManager + growth InfoTip reframed. Files: revenue/page.tsx, AgencyFeeManager.tsx, growth/page.tsx. tsc clean.

### Increments 3B + 3C — free-model signals · 2026-08-31 · staging
New `getFreeModelSignals(mode, agencyIds)` in `lib/command/retention.ts` + a "Free model" section on `/command/retention`: **free→outsourced conversion** (of agencies with a self-progress sale, the share who also outsource — the flagship monetisation signal), the **first-file giveaway cost** (what the first-outsourced-free files would have billed, distinct from the free self-progress product), and the self-progress agency count. This is the split the audit asked for (D6/D11): the real giveaway (first-outsourced-free) is now measured on its own rather than buried in the old "trial value" figure. tsc clean.

**Verification:** superadmin-only page — Ellis verifies `/command/retention` himself (no admin login on this side to screenshot). 

**Follow-up (minor):** the CC revenue page still has a "Trial given away" KPI reading `freeOnExchange` files (now only old-trial + comped); trends to £0 as legacy trial files clear. Relabel to "Legacy trial value" in a later pass.

## Phase 4 — app copy + Terms v5 (in progress)

### Increments 4A-4C — agent copy + legal refs + outsource · 2026-08-31 · staging
Approved against the Phase-4 was→will-be artifact. 4A: file sidebar self-progress fee £59 → "Free" (+ "Free — first file on us" for firstOutsourcedFree, degrades gracefully until the field is plumbed to SidebarPanel). 4B: emails — activation "you only pay when it exchanges" → "self-progress is free…first outsourced on us"; first-exchange "An invoice for £59 will follow shortly" → "Nothing to pay for this one" (the first exchange is always free now); dormant claim-welcome de-trialed. 4C: /terms + /legal "your free trial" phrase removed; /outsource flat £250 → "first sale free, then £250 to £350". Files: AgentFileSidebar.tsx, retention/index.ts, terms/page.tsx, legal/page.tsx, outsource/page.tsx, OutsourceIntakeForm.tsx. tsc clean.

**Follow-up:** plumb firstOutsourcedFree through SidebarPanel + the [id] page query so the sidebar first-file label lights up (currently self shows "Free", a first-free outsourced shows its band).

### Increment 4D — Terms v5 · 2026-08-31 · staging (committed, migration applies on push)
Shipped a new **TermsVersion v5** (`2026-08-payments-v5`) rather than editing v4 in place, so every director who acknowledged v4 re-acknowledges v5 (`getActiveTermsVersion` picks the latest `effectiveFrom`, and v5's is later). All three v5 sources are in sync:
- **Migration** `prisma/migrations/20260831120000_terms_version_v5/migration.sql` — inserts the full v5 body (ON CONFLICT DO NOTHING), runs via `prisma migrate deploy` on deploy. Applies to whichever env the branch deploys to (staging now, prod at the Phase-6 cutover).
- **Preview** `app/billing-terms/page.tsx` — SECTIONS + metadata + PolicyShell `version="5"` / `lastUpdated="31 August 2026"`. This page is static, so it shows v5 copy without the DB.
- **Legacy override** `lib/billing/terms-sections.ts` — Charges override drops the £59 in-house line (self free); heading match `Free trial period` → `Free sales`; legacy body updated (self free, fixed outsourced fee from sale 1, **no** free first file — grandfathered).

Substantive v5 changes vs v4: Charges (in-house £59 removed, self free, first outsourced free), Payment (scoped to outsourced), Free trial period → **Free sales**, Failed payments (blocks sending new sales to our team, self stays free/unaffected). Wording verbatim from the approved Phase-4 artifact. tsc clean; no stale `payments-v4` / `Free trial period` refs remain in app/lib.

**Verify (once pushed to staging):** `/billing-terms` shows the v5 preview immediately (static). The acknowledged disclosure (director saving a card) shows v5 only after Vercel applies the migration to the staging DB — confirm the Vercel deploy is GREEN before trusting it.

### Phase 4 pushed to staging + deploy verified · 2026-08-31
Pushed the 11-commit Phase 1-4 stack to `origin/staging` (`c37213c0..cf98cb88`). Vercel Preview deploy `salesprogressor-ra9wfibzi` went **Ready** (green).

**Gotcha found + fixed — migration data-inserts don't run on staging.** `scripts/vercel-db-deploy.mjs` runs `prisma db push` on Preview/staging (schema-only) and only `prisma migrate deploy` on Production. So the v5 TermsVersion **INSERT** never ran on staging (the schema columns did, via db push — that's the "already in sync" log line). Inserted the v5 row into the staging DB directly via a guarded one-shot (project-ref check == etidawkbqctarmsdjoxp). `getActiveTermsVersion` on staging now returns `2026-08-payments-v5`.

**Implication for Phase 6 (prod cutover):** production DOES use `prisma migrate deploy`, so the v5 migration WILL run and insert the row automatically at cutover — no manual insert needed on prod. But any FUTURE staging test of a data-bearing migration needs the same manual insert, because staging never runs migration SQL.

---

## Phase 5 — marketing site (../marketing-site) · 2026-08-31 · NOT deployed

Separate repo, **not** git-tracked — deploys via the Vercel CLI. Changes are on disk only. Per the atomic-cutover plan, this flip must go live in the SAME window as the app copy (Phase 6), never before, so site and app never disagree on price. Approved against the Phase-5 was→will-be artifact + five locked decisions (self "Free" wording, symmetric two cards, "First sale on us" ribbon, calculator rescoped, CTAs split).

**Source of truth flipped:** `lib/pricing.ts` — `SELF_PRICE 59 → 0`, `SELF_PRICE_DISPLAY "£59" → "Free"`. Every consumer that renders the constant flips automatically.

**Files edited (hand-rolled, Law 16):**
- Pricing page — `app/pricing/PricingClient.tsx`: H1 "Pay on exchange." → "Free to self-progress."; self qualifier → "every sale · always"; self CTA "Get started" → "Start free"; outsourced badge "Full service" → "First sale on us"; outsourced qualifier + "· first one free"; outsourced CTA "Book a demo"/demo → "Talk to us"/**/contact** (decision A); caption + "Your first outsourced sale is on us."; calculator intro rescoped; comparison row + "first one free"; pricing FAQ de-blanketed. `app/pricing/page.tsx` meta description rewritten (`SELF_PRICE` still passed → JSON-LD price "0").
- Calculator — `components/pricing/PricingCalculator.tsx`: fee math now `outsourcedCount * rate` (self free), dropped unused `SELF_PRICE` import, stat relabelled "Per-sale fee" → "Avg fee per sale" + "Self-progress is free, so you only pay to outsource." (fixes the blended £60 reading like a flat charge / echoing £59).
- Homepage — `Hero.tsx` (label £59→Free auto + hardcoded; 2× trust-chip sets de-trialed), `TheChoice.tsx` (self suffix), `PricingPreview.tsx` (self price/qualifier/CTA + H2 "Pay on exchange. Nothing else." → "Free to self-progress. Pay only to outsource."), `FooterCTA.tsx` trust line.
- SEO/AI — `lib/jsonld.tsx` (self Offer price "0" via constant + unitText, doc comment; decision B), `lib/faq-data.ts` (2 answers rewritten + new "Is there a trial?" FAQ), `app/llms.txt/route.ts` (2 lines).
- Long-tail — `app/about/page.tsx` two-ways paragraph (+ dropped unused import), `app/terms/page.tsx` "your free trial" removed, `components/blog/PostFooterCTA.tsx`, `lib/signup.ts` comment.
- **Deleted** (decision C): `app/test/homepage-v2/`, `app/test/homepage-v3/` (stale £250–£600 + trial mocks, noindexed).

**Verified:** `tsc --noEmit` clean (after clearing stale `.next` route types from the deletions). Grep sweep: zero `£59`, zero "free trial", zero umbrella "Pay on exchange" remain. Screenshots (`marketing-site/phase5-screens/`): pricing desktop + mobile + calculator, homepage hero. No em dash in any added string.

**Outstanding:** deploy (Vercel CLI) held for the Phase-6 atomic cutover. Post-launch: request Google re-crawl of /pricing + homepage after the JSON-LD/FAQ flip (ELLIS_MANUAL_TODO candidate).

---

## Phase 6 — ATOMIC CUTOVER COMPLETE · 2026-08-31 · LIVE ON PROD

Both halves flipped in the same window:

1. **App (portal)** — merged `staging → master` (isolated git worktree, so the shared working dir / second tab was never touched). Vercel prod deploy `salesprogressor-rjbocztbu` GREEN. `prisma migrate deploy` applied **both** migrations to the prod DB — build log: "Applying migration `20260831000000_free_reason_pricing_version`" + "Applying migration `20260831120000_terms_version_v5`" + "All migrations have been successfully applied." So the v5 terms row is live on prod and is now the active acknowledged version (directors re-acknowledge on next card action). The merge also carried the second tab's portal motion sweep + Stamp Duty drawer (Ellis approved).
2. **Marketing site** (`../marketing-site`, non-git) — `vercel --prod`, deploy `marketing-site-br3pgqpss` READY, aliased to **www.thesalesprogressor.co.uk**.

**Verified live:**
- www/pricing: serves "Free to self-progress", "First sale on us", "per sale · on exchange · first one free"; **zero £59**. /llms.txt shows free model. Apex 308→www.
- portal/billing-terms: "Free sales" section + "31 August 2026" (v5 preview). portal/outsource: "first sale is on us" + "£250 to £350", no £59.

**Manual follow-up (added to ELLIS_MANUAL_TODO):** request a Google Search Console re-crawl of /pricing + homepage now the JSON-LD/FAQ flipped, so the old £59 rich-result clears.

**Migration is DONE.** Self-progress is free; first outsourced file free; £250/£300/£350 bands unchanged; no trial anywhere; Terms v5 live on staging + prod.
