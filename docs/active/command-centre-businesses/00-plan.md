# Command Centre — Progression Businesses adaptation

**Status:** planned, not started. Written 2026-10-09.
**Audit it comes from:** the three-agent Command-Centre audit (this folder is the actionable version).
**Owner surface:** Command Centre (`/command/*`, superadmin only). Law 8 applies — all new server code lives in `lib/command/`, reads via `commandDb`, never imported outside `/command`.

---

## Goal

The Command Centre currently reads **zero** `ProgressionBusiness` data. As external Sales Progression businesses enter the system we need to (a) see each business and its health, (b) fold the income they pay us into the Revenue picture, and (c) keep a light-touch eye on churn/payment risk — without disturbing the existing agency revenue model.

## Key facts (verified)

- **What a business pays TSP:** £59 base + £39/extra active member (monthly **MRR**, billed 1st pro-rata, card-gated) + £5/sale (stamped at sale *creation*, rides the next subscription invoice). No VAT. Constants in `lib/progression/business-billing.ts` (`BUSINESS_BASE_PENCE` 5900, `BUSINESS_PER_MEMBER_PENCE` 3900, `BUSINESS_PER_SALE_PENCE` 500).
- **The maths already exists** — this is a *display* job:
  - `getBusinessBillingSummary(businessId, now)` → `{ memberCount, basePence, seatsPence, saleCount, perSalePence, totalPence }` (`lib/progression/business-billing.ts`).
  - `getBusinessBillingState(...)` → dunning verdict `ok | warning | blocked` (`lib/progression/business-dunning.ts`).
  - `businessBillingActive(businessId)` + `getBusinessPlanSchedule(businessId)` (`lib/progression/business-stripe.ts`) → subscription present / cancel schedule.
- **Three income streams** on Revenue (this corrects the audit's two-stream framing):
  1. Agency fees — at-exchange, `lib/command/revenue.ts` (`getRevenueDashboard`), from `InvoiceLine`.
  2. Provider referrals — `quoteRequest.referralFeePence` (earned=`status:won`, collected=`referralFeeCollected`), already shown as *"Other income · provider referrals"*.
  3. Progression businesses — new (MRR + £5).
  The unified **"Total income this month"** = agency banked + provider referrals collected + business (MRR take + £5s).
- A sale belongs to a business when `PropertyTransaction.progressionBusinessId` is set (null = TSP/agency). A business's client agencies are `ProgressionBusinessClient` rows (each with a `feeModel`); an agency belongs to at most one business.

## Assumptions (defaults — tell me to flip any before Phase 1)

1. **Nav placement:** "Businesses" under *Day to day*, next to "Agencies & agents" (management with money columns).
2. **Combined top-line:** one "Total income this month" spanning all three streams, itemised beneath.
3. **MRR is a first-class KPI** on Revenue (it compounds; it behaves nothing like lumpy at-exchange fees).
4. **Client tagging:** show "managed by {business}" on the Agencies list + file views (Phase 3), not only inside the business drill.
5. **Scope:** build Phase 1, review, then Phase 2/3.

## Non-goals

- No change to **business billing logic** (subscription build, £5 stamping, dunning) — we only read it.
- No per-business data leaking into **agency-scoped** (director/negotiator) surfaces — Command Centre only.
- Don't touch the provider-referral or agency-fee computations beyond rolling them into the shared total.

---

## Phase 1 — Visibility (see the businesses at all)

### PR1 — `lib/command/businesses.ts` (read service)
- `getBusinessesOverview()` → list of `{ id, name, senderVerified, clientCount, memberCount, summary (getBusinessBillingSummary), state (getBusinessBillingState), subscriptionActive }`, excluding the `isTsp` row. Loops the existing per-business helpers; `commandDb` for the `ProgressionBusiness` / `ProgressionBusinessClient` reads.
- `getBusinessDetail(id)` → the above + members (seats billed), client agencies + `feeModel` each, sales (this month + lifetime count), Stripe customer id, cancel schedule (`getBusinessPlanSchedule`).
- **Note:** `getBusinessBillingSummary` currently uses `prisma` (not `commandDb`). Superadmin reads-all, so acceptable; keep the `ProgressionBusiness` list query on `commandDb` for Law 8 consistency.
- **Acceptance:** unit-callable; returns correct MRR/sales/clients for the seeded business; TSP row excluded.

### PR2 — `/command/businesses` list page + nav
- `app/command/(protected)/businesses/page.tsx` + `components/command/businesses/BusinessesTable.tsx`.
- Columns: Business (+ verified-sender badge), Clients, Seats, MRR, Sales MTD, £5 MTD, Total MTD, Status chip (live / payment-failed / blocked).
- Add nav item "Businesses" to `components/command/CommandSidebar.tsx` under *Day to day*.
- **Acceptance:** page lists every non-TSP business with live figures; empty state when none; row links to the drill.

### PR3 — `/command/businesses/[id]` detail
- `app/command/(protected)/businesses/[id]/page.tsx` + `components/command/businesses/*` (fact strip, members, clients+fees, sales, income breakdown, subscription/dunning).
- Mirrors the `/command/revenue/[agencyId]` drill, re-pointed at a business.
- **Acceptance:** one business's full picture renders; cancel schedule + payment state correct.

---

## Phase 2 — Revenue integration (fold their money in)

### PR4 — unified income on `/command/revenue`
- `getBusinessesRevenue()` in `lib/command/businesses.ts` — totals MRR, this-month MRR take, £5s this month across active businesses.
- In `lib/command/revenue.ts` / the revenue page: add
  - **Combined "Total income this month"** headline = agency banked + provider referrals collected + business (MRR take + £5s). (Provider referrals already computed on the page — just include them in the total.)
  - **Two new KPIs:** "Recurring MRR" and "Business income MTD".
  - **New "Progression businesses" section:** per-business table (same shape as per-agency) + failed/blocked business payments in the existing *Outstanding & risks* feed.
- **Acceptance:** total reconciles to the three itemised streams; agency pipeline figures unchanged; businesses with no card/sub don't inflate MRR.

### PR5 — breakdown lines
- Add business income lines to `app/command/(protected)/revenue/breakdown/page.tsx` (statement-style), alongside the existing per-sale fee + referral tables.
- **Acceptance:** breakdown subtotal matches the Revenue headline.

---

## Phase 3 — Monitoring (keep an eye without looking)

### PR6 — Overview tile
- Add a "Progression businesses" tile to `app/command/(protected)/overview/page.tsx`: active count, total MRR, payment issues, new business-sales today.

### PR7 — risk + churn signals
- Surface failed & blocked business payments in Revenue's *Outstanding & risks*; business-billing cron status on `/command/health`.
- Churn signal: active businesses with **zero sales this month** (reuse adoption/usage last-active), flagged on the Businesses list and/or Overview.
- Client tagging (assumption 4): "managed by {business}" on the Agencies list + file views.
- **Acceptance:** a payment-failed business shows amber on list + Overview; a zero-sales business is flagged.

---

## Page relevance (what we are / aren't touching)

- **Touching:** Businesses (new), Revenue (+breakdown, drill), Overview, Files (filter by `progressionBusinessId`), Agencies (managed-by tag), System health / Audit / Activity.
- **Leaving TSP-only:** all Content/*, AI Outreach, Prospects, Website & Growth, Experiments, Trends, Chain invites, Activation, Messages/Proposals/WhatsApp, Quote inbox / Surveyor firms (that *is* the provider stream, unchanged), Rules, Settings, Email catalogues.

## Open questions

- Should provider referrals move *into* the headline permanently, or stay a sub-line that the combined total merely sums (keeps the existing block intact)? Default: keep the block, add to the total.
- MRR "take this month" vs "contracted MRR" — do you want the headline to show cash actually collected this month, or the run-rate? Default: show both (run-rate as the KPI, collected in the total).
