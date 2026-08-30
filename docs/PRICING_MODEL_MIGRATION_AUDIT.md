# Pricing Model Migration — Forensic Audit & Implementation Plan

**Status:** audit complete / nothing built. Authoritative working document for the migration.
**Opened:** 2026-08-30
**Repos audited:** `full` (app + Command Centre), `marketing-site` (public site).
**Method:** 12 parallel read-only forensic agents; every claim below is file:line-anchored.

> **New commercial model (locked, non-negotiable):** self-progress is genuinely **FREE** (not a trial); outsourced stays **£250 / £300 / £350** by band; the **first outsourced file per agency is free**. This is an uptake strategy — free users are not failed conversions. Do not preserve old pricing concepts just because they exist.

---

## 0. How to read this document

- Sections 1–19 are **findings** (what exists today, what breaks).
- Sections 20–23 are **decisions & design**.
- Sections 24–27 are **execution** (tests, deploy, risks, phases).
- Section 28 is the **Decision Register** — the systematic list of your calls. **Start here when we reconvene.**
- Sections 29–30 are **your decisions** and **your manual actions**.

---

## 1. Executive summary

The billing engine is unusually clean: **one function, `computeFee` in `lib/billing/fee.ts`, is the sole authority** on what an exchanged file is charged, and every surface (accrual cron, live billing page, credit notes, revenue dashboard) delegates to it. The exchange event is captured once at a single idempotent chokepoint (`lib/services/billing-trigger.ts`, milestones VM19/PM26) into immutable snapshots (`billedAtExchange`, `priceAtExchange`).

**Three facts make this migration far smaller than it looks:**
1. **A permanent-free tier already exists** — `ClientType.free` (schema, added 2026-08-26) plus a `feeTier === "free"` branch in `lib/services/trial.ts` that stamps files free forever. There is an in-progress plan at `docs/active/free-agency-launch/SPEC.md` (Phase 0.2 shipped the tier). **This migration extends that work; it does not start fresh.**
2. **Billing keys off `serviceType` only**, and `serviceType` is 1:1-derived from the agent's `progressedBy` choice at create. So "self-progress is free" is cleanly expressible at the service-type level.
3. **Registration, onboarding, and both client/solicitor portals are entirely clean** — zero pricing/trial copy. No work there.

**Three facts make it dangerous if rushed:**
1. **`freeOnExchange` is a frozen, create-time, service-type-blind stamp.** It cannot express "self-managed is always free," and existing self-managed rows carry stale `false` values → wrongful £59 charges if leaned on.
2. **Every revenue figure calls `computeFee` directly**, which returns £59 for self-managed *regardless of the free tier*. Post-launch, pipeline / forecast / "trial given away" inflate by £59 per free file, and self-progressed revenue collapses to ~£0 and reads as "failure."
3. **The billing terms cannot be edited in place** — the code's own process rules require shipping a **new `TermsVersion` (v5)** with director re-acknowledgement, and the existing "30 days' notice, applies only to sales added after" clause **governs the rollout**.

**"First outsourced file free" is a genuine new build.** No primitive exists; `firstSubmissionAt` is first-*any*-file and won't serve; the self↔outsourced switch path leaves billing untouched, so eligibility for converted files is undefined.

---

## 2. Current pricing architecture

**Source of truth (app):** `lib/billing/fee.ts`.
```
IN_HOUSE_FEE_PENCE   = 5900   // £59 self-managed, flat, ignores sale price and legacy override
OUTSOURCED_BAND_LOW  = 25000  // £250  (< £350,000)
OUTSOURCED_BAND_MID  = 30000  // £300  (£350,000–£499,999)
OUTSOURCED_BAND_HIGH = 35000  // £350  (≥ £500,000)
```
`computeFee(serviceType, priceAtExchangePence, agencyVat, feeOverride)` → `grossFee()` picks the amount; VAT split applied on top (currently no agency is VAT-registered, so gross == net). **All amounts in pence.**

**Source of truth (marketing):** `marketing-site/lib/pricing.ts` — `SELF_PRICE = 59`, `OUTSOURCED_BANDS` (£250/£300/£350). Feeds 8 consumer files' *numbers*, but the *narrative* strings ("pay on exchange", "14-day free trial", "no subscription") are hardcoded separately across ~14 files and do **not** update from `pricing.ts`.

**The three "mode" signals** (schema):
| Signal | Level | Set how | Role |
|---|---|---|---|
| `PropertyTransaction.progressedBy` (`agent`/`progressor`) | per-file | Agent's New-Sale toggle | The **input** |
| `PropertyTransaction.serviceType` (`self_managed`/`outsourced`) | per-file | **Derived 1:1 from `progressedBy`** at create (`lib/services/transactions.ts:917-921`) | The **billing key** |
| `Agency.modeProfile` (`self_progressed`/`progressor_managed`/`mixed`) | per-agency | Lagging 90-day cron rollup | **Reporting only** — never gates pricing |

Mapping is fixed: `agent ⇄ self_managed`, `progressor ⇄ outsourced`. `modeProfile` must **not** be used for eligibility (it's a lagging aggregate).

---

## 3. Current self-progress billing

- Self-managed exchanges are charged a **flat £59** (`fee.ts:69-71`), ignoring sale price and the agency legacy override.
- **£59 lives in three places:** `fee.ts:21` (billing truth), and two hardcoded display copies that do **not** read `fee.ts` — `components/transaction/AgentFileSidebar.tsx:197-198` and `components/billing/v2/PlanTermsCollapsed.tsx:59`. All three must move together.
- Self-managed files are billed via the same monthly-accrual path as outsourced (see §10).
- **The EarningsBuilder already displays self-progress as "Free"** (`components/transactions-v2/EarningsBuilder.tsx:127-129`) — so its display becomes *correct* under the new model.

---

## 4. Current outsourced billing

- Bands £250/£300/£350 selected off `priceAtExchange` (null price defensively → bottom band, `fee.ts:91-93`).
- **Legacy override:** `Agency.feeTier = legacy` + `legacyOutsourcedFeePence` replaces the sliding scale with a flat fee for outsourced only (`fee.ts:75-88`). Self-managed stays £59 even for legacy agencies.
- A public `/outsource` landing page hardcodes a **flat "£250 per sale"** (`app/outsource/page.tsx:16,24,64,102`) which contradicts even the current bands and omits first-file-free.
- **Outsourced bands are unchanged by this migration** — the £250/£300/£350 numbers stay.

---

## 5. Trial architecture

**It is 14 days, per-agency, anchored on `Agency.firstSubmissionAt`, frozen onto `PropertyTransaction.freeOnExchange` at create, and never recomputed.**

- Authoritative constant: `lib/services/trial.ts:44` `TRIAL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000` (bumped 7→14 on 2026-05-24). **The "7 days" in the schema comments (`schema.prisma:87,457`), `app/api/claim/route.ts:157`, and the live superadmin footnote `app/command/(protected)/revenue/page.tsx:576` are STALE** — code is 14. The footnote is the only user-facing 7-day bug.
- `stampTrialState()` logic: `feeTier==="free"` → always free; `feeTier==="legacy"` → never free; first-ever file → set `firstSubmissionAt`, free; else → `elapsed <= 14d`.
- **Only ONE thing hard-locks:** `app/agent/transactions/new/page.tsx:30-80` blocks a **director with no card** from creating a **new sale** once the 14-day window elapses (or legacy tier). Nothing else is gated — existing files keep running. Negotiators/internal staff bypass. *(Note a latent edge: a `free`-tier director with no card and >14 days elapsed would also hit this gate — the guard checks legacy-vs-standard, not `free`.)*
- **No trial-expiry email and no trial cron exist.** All trial messaging is in-app (modal + banner).
- Full component/metric classification (delete / retain-for-history / rename / repurpose / keep) is in §11, §13, §15, §16.

---

## 6. First-outsourced-free — design options

**No existing primitive.** `freeOnExchange` is create-time, time-windowed, and service-type-blind; the free tier is all-or-nothing per agency; `firstSubmissionAt` is first-*any*-file; `outsourcedAt` is re-stamped on every switch (so it's "most recent became-outsourced", not "first ever"). Recommended design:

- **Decide eligibility at the exchange chokepoint** (`billing-trigger.ts` `maybeStampExchange`) — the single idempotent, race-safe, bilateral-safe point. "First to **exchange**" is what should be free (files can be created out of order).
- **Stamp a new flag** `PropertyTransaction.firstOutsourcedFree` (or a `freeReason` value) there: on an outsourced exchange, if the agency has **no prior** outsourced file with `billedAtExchange != null`, mark it free and skip billing (or bill £0 via an explicit discount line).
- **Concurrency:** the NULL-guard that protects `billedAtExchange` does **not** protect a "count prior outsourced files" query — two outsourced files exchanging simultaneously could both claim free. Needs a **partial unique index** (`@@unique(agencyId) WHERE firstOutsourcedFree = true`) or a `SELECT … FOR UPDATE` on the agency row. This is the one genuinely new concurrency surface.
- **Representation:** record the real band price + an explicit **discount line** (`discountReason` / new `InvoiceLineKind`), e.g. "Outsourced — £300 · first-file introductory credit −£300 = £0", **not** a silent £0. Keeps `computeFee` honest, VAT math sane, and the giveaway auditable/distinct from trial value.
- **Reversal interaction:** if the free file later falls through (its VM19/PM26 is undone), decide **once-consumed-always-consumed** (recommended, matches existing "withdrawal doesn't reverse billing" posture) vs re-grantable.
- **Switch path:** a file created self-managed then switched to outsourced must be handled — decide at the switch-to-outsourced event too, not only at create.

→ **Decisions D3, D4, D5** in §28.

---

## 7. Existing customer transition cohorts

Historical financial records stay **untouched** (frozen `InvoiceLine` amounts). Recommendations per cohort:

| Cohort | Who | Recommended stance |
|---|---|---|
| **A** | In 14-day trial now | Becomes free self-progress immediately; new-sale gate lifts |
| **B** | Trial expired | Same as A — gate lifts, self-progress now free |
| **C** | Paying £59 self-progress | History preserved; future self-progress free |
| **D** | Historical £59 exchanges | **Never rewrite** — frozen invoice lines stay correct |
| **E** | Never outsourced | First outsourced file free available |
| **F** | Already outsourced ≥1 | **DECISION D3:** retroactive free file, or grandfathered out? |
| **G** | New agency post-launch | Clean new model |
| **H** | Created before launch, exchanges after | **DECISION D9:** the terms' "price set at add time" clause implies pre-launch self files could still bill £59 — forgive or honour? |
| **I** | Active self-progress txn | Stops billing (→ £0) |
| **J** | Active outsourced txn | Unchanged (£250-350) |

→ **Decision D9** in §28.

---

## 8. Pricing-versioning recommendation

**There is no fee-schedule version/effective-date field.** Fees are hardcoded constants; `running-total.ts` and `accrual.ts` recompute live from `computeFee`, so **any repricing applies retroactively to every not-yet-issued invoice line**. The only version artifacts are `TermsVersion.effectiveFrom` (disclosure *copy*, not fees), `InvoiceLine.amountPence` (frozen per line after billing), and `priceAtExchange` (sale price, not fee schedule).

**Recommendation:** add a lightweight `feeScheduleEffectiveFrom` / `pricingVersion` concept (you will reprice again). At minimum, the £59→£0 change must not silently re-price already-exchanged-but-not-yet-issued self-managed files at a different amount than the customer was told. → **Decision D7**.

---

## 9. Database / schema impact

Enums today: `ClientType {legacy, standard, free}`, `ServiceType {self_managed, outsourced}`, `ProgressedBy {progressor, agent}`, `AgencyModeProfile {self_progressed, progressor_managed, mixed}`, `InvoiceLineKind {in_house_fee, outsourced_fee, credit_applied}`.

| Field | Current meaning | Under new model | Risk |
|---|---|---|---|
| `PropertyTransaction.freeOnExchange` (frozen at create) | Trial/free stamp | **MEANING-CHANGES — most dangerous.** Cannot express "always free by type"; stale `false` on self files = wrongful charges | **VERY HIGH** |
| `PropertyTransaction.serviceType` | Billing key; self→£59 | £59 → £0 | **HIGH** — leaving £59 in `fee.ts` bills self-progress |
| `Agency.feeTier = free` | Frees **every** file incl. outsourced (agency-wide) | Conflicts with "free self + paid outsourced" | **HIGH** — a mixed agency set to `free` wrongly frees outsourced |
| `Agency.firstSubmissionAt` | First-any-file trial anchor | Keep (analytics), no longer a self-progress pricing gate; **≠ first outsourced** | **HIGH** if reused for first-outsourced-free |
| `InvoiceLineKind.in_house_fee` + `grossFee` self branch | £59 line | **OBSOLETE** (dead code) if self never bills | Low |
| `PropertyTransaction.outsourcedAt` | Stamped on become-outsourced; re-stamped on every switch | Candidate anchor but "most recent", not "first" | Medium |
| `billedAtExchange` / `priceAtExchange` / `exchangedAt` | Immutable snapshots | REMAIN-VALID | Low |
| `DailyMetric.serviceType/modeProfile`, `WeeklyCohort.modeProfile` | Reporting splits | REMAIN-VALID | Low |

**New fields likely needed:** `freeReason` discriminator (`permanent_free_self` / `first_outsourced_free` / `legacy_trial`) on `PropertyTransaction`; a `firstOutsourcedFree` flag (or reuse `freeReason`); optional `pricingVersion`/`feeScheduleEffectiveFrom`; optional `discountReason`/`discountPence` on `InvoiceLine`.

**Migration history (pricing-relevant):** `20250418000003_sprint6_fees` (ClientType), `20260428000000_deploy_a_schema_rebuild` (ServiceType/ProgressedBy), `20260501000002_add_agency_mode_profile`, `20260524150000_payments_scaffolding` (firstSubmissionAt, VAT, Stripe, freeOnExchange, Invoice/InvoiceLine/TermsVersion/CreditNote), `20260525-26 terms_version v2-v4`, `20260529180000_agency_fee_tier`, `20260826120000_client_type_free`.

---

## 10. Billing / invoice impact

- **Monthly accrual** (`lib/billing/accrual.ts`): one `building` Invoice per agency per London month; fee lines reconciled against billed transactions; issued invoices are immutable (later exchanges/reversals flow to next month via `CreditNote`). Free self-progress agencies with no outsourced files simply **have no invoice** (clean).
- **Live director total** (`lib/billing/running-total.ts`) recomputes from `computeFee` independently of the cron.
- **Reversal** (`lib/services/billing-reversal.ts`) only fires on **undoing the VM19/PM26 milestone** — a status change to withdrawn/fallen-through does **not** reverse a bill. So if a file exchanges (bills) then falls through without the milestone being undone, **the charge stands** (existing behaviour; interacts with first-outsourced-free accounting).
- **Invoice PDF** (`lib/billing/invoice-pdf.ts`) is fully data-driven; a "trial" variant line already renders the amount as literal **"Free"** (`:250`) — reusable for first-outsourced-free.
- **Recommended new-model billing:** do **not** create £0 lines or set `billedAtExchange` for free self-progress (reuse the existing "exchanged but not billed" path); make first-outsourced-free an explicit discount line. → **D1, D2, D4**.

---

## 11. Agent portal impact

| Surface | File:line | Impact |
|---|---|---|
| **New Sale form gate** | `app/agent/transactions/new/page.tsx:30-80` | **Must be rescoped to outsourced-only** — never block a self-progressing director. *The single most important behavioural change.* |
| EarningsBuilder | `EarningsBuilder.tsx:84-129` | Self row already "Free" (becomes correct); the `withinTrial` "Sent to us = Free" branch → first-outsourced-free logic |
| Hub payment nudge | `components/billing/PaymentMethodNudge.tsx` | Repurpose: never nudge a self-only agency; card only for outsourced |
| TrialExpiredModal / TrialBannerWithModal | `components/billing/*` | Repurpose from "trial ended" → "add a card to send files to us" (card capture survives for outsourced) |
| Billing hub (PlanTermsCollapsed, MetricsStrip, BuildingInvoiceHero) | `components/billing/v2/*` | Remove Trial column/countdown; "£59 per exchange" → "Free"; "Saved via trial" → relabel |
| File sidebar fee row | `AgentFileSidebar.tsx:197-198,513-519` | Hardcoded £59 → Free; remove "Free during your trial" |
| Registration / onboarding | `app/register/page.tsx`, onboarding-progress | **No pricing/trial copy — no change** |

---

## 12. Client / other portal impact

**None.** Buyer/seller portal (`app/portal/[token]/*`, `components/portal/*`) and solicitor portal (`app/s/[token]/*`) contain **zero** service-pricing/trial/paid-free references. The only money strings are the property sale price and the client's own "cancel subscriptions" moving checklist. **No portal work required.**

---

## 13. Internal / Command Centre impact

**Root cause bug:** `computeFee` returns £59 for self-managed regardless of `feeTier=free`, and every revenue-valuation figure calls it directly (`revenue.ts:521,539,561,644,857,871,878,897`).

| Metric | Verdict | Note |
|---|---|---|
| `banked` / `lifetimeBilled` (frozen `InvoiceLine`) | **HISTORICAL — valid** | Real past £59/£250 charges preserved |
| `bankedByServiceType.inHousePence`, `pipelineByServiceType.inHousePence` | **OBSOLETE** | Structural £0 |
| `trialValueThisMonth` / `trialValueLifetime` ("given away") | **REPLACE** | Conflates permanent-free-self with first-outsourced-free; balloons under free model |
| Pipeline / forecast headline + by-mode | **MISLEADING** | Inflated by £59 × self active files; `pipelineByMode.sp` reads as ~£0 "failure" |
| Fee-model rulebook / labels ("£59", "In-house (£59)", "7 days" trial line) | **WRONG COPY** | `revenue/page.tsx:397,549-577` |
| `AgencyFeeManager` copy + `feeTier=free` semantics | **CHANGE** | "free = self free" conflated with "free = everything free" |
| Activation funnel / retention (`/command/retention` 2nd/5th/10th) | **RETAIN — promote** | Already sale-not-payment framed; becomes headline health |
| ARPA/ARPU/LTV/MRR/ARR | **N/A** — none exist |

**Absent capabilities to build:** first-outsourced-free visibility; **free→outsourced conversion** (the single most important new-model signal — recommend an `outsourced_adopted` event mirroring `activated`); a revenue view that treats self-progress as £0-by-design.

---

## 14. Analytics impact

- **Two systems:** a server-side `Event` table (always on) and PostHog (consent-gated, **dormant — no key**). **No GA4 in the app repo.**
- **No trial-started/converted/paid/revenue events exist** — revenue is reconstructed from `InvoiceLine` at read time.
- `DailyMetric` splits by `serviceType`/`modeProfile`; `WeeklyCohort` is **login retention**, not sales/revenue.
- **Recommended new-funnel metrics** (all DB-derivable, no PostHog dependency): free→outsourced conversion; first-outsourced-free cost (split from trial value via `freeReason`); signup-intent (`signupTier`) vs realised tier; referral revenue as the "other monetisation" tail; revenue-per-signup as *informational* (free lowers it without being a failure). Reference `/command/retention` for 2nd/5th/10th — don't rebuild.
- **Fix `freeReason` before the switch** or the revenue dashboard reports the permanent free tier as ever-growing "lost revenue."

---

## 15. Email / notification impact

- **No app-authored invoice/billing email** — Stripe sends those (`lib/billing/issuance.ts`, `charge_automatically`, `auto_advance`). **No trial-expiry email/cron.**
- **Highest-risk line:** `first_exchange` retention email — **"An invoice for £59 will follow shortly"** (`lib/emails/retention/index.ts:196,206`) — fires on the first exchange of *any* file; post-launch it contradicts a free first bill.
- `activation_day_1` "You only pay when it exchanges" (`:66,77`) → misleading for free self-progress.
- `claim_welcome` "next 14 days is also free" (`:121,135`) → **currently dormant/unwired**; trial-framed; rewrite or drop.
- In-app: TrialExpiredModal / TrialBannerWithModal / PlanTermsCollapsed trial copy → repurpose/remove. `PaymentBlockBanner` (failed-payment) → **KEEP** (still valid for outsourced).
- `TRANSACTIONAL_EMAIL_KEYS` (activation_day_1, claim_welcome, stuck_day_3, first_exchange) send regardless of opt-out.

---

## 16. Legal / terms impact

**The billing terms live in a `TermsVersion` DB row (v4) mirrored across 4 sources** (public preview `app/billing-terms/page.tsx`, migration SQL, insert script, DB row). Per the code's own rules, **a material change ships as a NEW `TermsVersion` v5 with director re-acknowledgement — not an in-place edit.**

- **Must change (v5, legal review):** Charges section (£59 in-house line), "Free trial period" section (14 days), Payment/collection scope, Failed-payments "unable to add new sales" (should a failed *outsourced* payment block *free* self-progress? → **D13**). **New concept to author:** first-outsourced-free (covered nowhere in current terms).
- **Governs the rollout:** the "Changes to pricing — 30 days' notice, applies only to sales added after" clause (`billing-terms/page.tsx:141-146`). **KEEP and honour.**
- **KEEP:** VAT section (factually current), invoice PDF wording (data-driven), Provider Terms, Privacy/DPA/Cookie, Stripe/billing-party/disputes.
- Minor "your free trial" phrase in `app/terms/page.tsx:187`, `app/legal/page.tsx:42` (material docs — do not auto-edit).

---

## 17. Marketing-site pricing inventory

Source of truth `marketing-site/lib/pricing.ts` (`SELF_PRICE=59`, bands £250/£300/£350). Key visible pricing:
- `/pricing` (`PricingClient.tsx`): h1 "Pay on exchange."; self card "£59 / per sale · on exchange"; outsourced "From £250" + band table; calculator (`PricingCalculator.tsx` math `selfCount * SELF_PRICE`).
- Homepage: `Hero.tsx` ("£59 · You progress" `:299`, **literal `£59` `:492` bypassing the constant**, **"14-day free trial" trust chips `:796,809`**); `TheChoice.tsx`, `PricingPreview.tsx` ("Pay on exchange. Nothing else." `:87`), `FooterCTA.tsx` ("14-day free trial" `:118`).
- `/about` "£59 per sale" (noindexed); `/how-it-works` £300 demo stat; `/changelog` (dated); `/outsource` flat £250 (app repo).
- `/llms.txt` "£59 per sale self-managed, from £250 fully outsourced" (AI answer engines).
- **Blog content clean.** Test pages `/test/homepage-v2,v3` carry stale `£59`/`£250–£600`/trial (noindexed, not in sitemap — but robots doesn't disallow `/test/`).

**Pre-existing contradiction:** the site advertises a "14-day free trial" (3 places + terms) while every pricing surface says "£59, pay on exchange, no subscription." These can't both be true today — the migration must resolve it.

---

## 18. Marketing-site copy inventory (classification)

Full string-by-string table (current copy · file:line · why affected · action · class) is captured in the audit agents' output and summarised here. Headline classification:
- **AUTOMATIC (remove/factual):** the three "14-day free trial" chips (`Hero.tsx:796,809`, `FooterCTA.tsx:118`); literal `£59` in `Hero.tsx:492`; `/test/*` robots disallow.
- **NEEDS-ELLIS (positioning/wording), ~30 strings:** every "£59 → Free" display, the "Pay on exchange. Nothing else." master hook (h1 `/pricing`, h2 `PricingPreview`, `PostFooterCTA`, meta, `llms.txt`), the symmetric two-tier framing, the calculator premise, "Everything in Self-progress", "nothing if it falls through" rescoping, `/about` two-ways paragraph, `/terms` "your free trial".
- **KEEP:** outsourced band strings, "no contracts/setup fees" (subordinated), dated changelog, dashboard mock figures.

---

## 19. SEO / metadata / structured-data impact

**Two SERP-visible artefacts must change first** (they render as Google rich results):
1. **JSON-LD `Offer price:"59"` + `unitText:"per sale (charged on exchange)"`** — `lib/jsonld.tsx:128-142`, mounted on indexed `/pricing` (`app/pricing/page.tsx:21`). Represent free as `price:"0"` or omit the self Offer (decision, not a value edit). **Most damaging artefact** — Google keeps showing "£59" long after launch.
2. **FAQPage schema** answers asserting universal "pay per sale on exchange" — `lib/faq-data.ts:11-20`, mounted on indexed homepage (`app/page.tsx:43`). Split self (free) vs outsourced (pay-on-exchange, first free); consider adding a "no trial — self-progress is free" FAQ.

Also: `/pricing` meta/OG/Twitter description; `/llms.txt`; the homepage price tiles need a deliberate "Free" treatment (not "£0"); `/test/*` noindex relies solely on meta (add robots disallow). **OG/Twitter images are clean** (no baked-in pricing). First-outsourced-free is represented **nowhere** in schema/copy.

---

## 20. New commercial positioning decisions

Today TSP is positioned as **two symmetric paid-per-sale tiers** ("your team or ours") with **"Pay on exchange. Nothing else."** as the master brand hook. Under free self-progress this hook is half-wrong and buries the strongest message. The likely shift: **"the free progression layer for estate agents, with outsourced progression as the optional paid service."** Major decisions (→ §28 D12, D15–D18):
- The new **master hook** (retire "pay on exchange" as the umbrella? make it outsourced-only?).
- How to render **"free"** (Free / Free forever / Free for your team / £0 — `£0` reads broken).
- Whether the **symmetric two-tier model** is dead (free hero → optional paid upgrade).
- Whether **first-outsourced-free** gets its own surface (hero tick / card badge / banner) and its terms.
- What replaces the **"14-day free trial"** chips.
- Whether the **pricing calculator** survives (rescope to "cost of outsourcing" or cut).

---

## 21. Pricing-page options (to prototype as artifacts)

- **Option A — Two cards, reframed:** "Self-progress · Free" and "Outsourced · £250–£350, first sale free." Minimal restructure; keeps familiarity; risk: still reads as symmetric peers, under-selling free.
- **Option B — Free-led:** hero "Use TSP for free", outsourcing presented as an optional upgrade/service below. Strongest for the uptake strategy; risk: must still make the paid product legible and desirable.
- **Option C — Product-led "free OS":** position the free progression layer as the product, outsourcing as a done-for-you add-on, first file free as the trial-replacement hook. Highest upside for the "free layer" identity; most copy work; needs the clearest paid-value story.

Each to be mocked as a visual artifact when we reach the decision (message hierarchy, likely interpretation, pros/cons, trust/confusion risk).

---

## 22. App UI decisions

- Free self-progress files on the billing hub: show as £0 line items or omit? (Recommend omit — reuse "exchanged but not billed".)
- First-outsourced-free on a file/invoice: "£300 · first file free" discount line (recommend) vs silent £0.
- Do agents see remaining first-outsourced-free eligibility in-app? Do internal staff? (→ D19)
- What replaces the trial banners/countdowns/empty-states (repurpose to outsourced card-capture).

---

## 23. Historical-data handling

- **Never rewrite issued/frozen `InvoiceLine` amounts** — historical £59/£250 revenue stays correct.
- Distinguish **legacy paid self-progress** from **new free self-progress** in reporting via `freeReason` and/or a pricing-effective-date, so "trial given away" and by-mode revenue don't retroactively lie.
- Keep "Saved via trial"/free-tier surfaces for historically-stamped rows (relabel), don't delete history. → **D11**.

---

## 24. Tests required

- **Fee calc:** self-managed → £0; outsourced bands unchanged; legacy override intact; VAT split.
- **First-outsourced-free eligibility:** first-to-exchange; prior-billed-outsourced disqualifies; migrated/demo excluded; **switch self→outsourced**; fall-through then later file; **concurrency** (two simultaneous outsourced exchanges — only one free).
- **Invoice generation:** free self files create no line; first-outsourced-free renders the discount line; monthly accrual/reversal/credit-note still correct.
- **Transition cohorts A–J** behaviour.
- **Trial removal:** new-sale gate no longer fires for self-progress; card gate still fires for outsourced.
- **Copy/UI snapshots:** billing hub, sidebar, emails; marketing pricing surfaces.
- **Analytics:** `freeReason` splits; free→outsourced conversion; revenue no longer inflated by £59×self.

---

## 25. Deployment strategy

**The website must never say "free" while the app still charges £59.** Sequence:
1. **Backend/data first** (schema + `freeReason` + billing rules + first-outsourced-free) — behind the scenes, self still visibly £59 until copy flips.
2. **Internal reporting** (fix the £59-inflation, add free→outsourced) — internal only.
3. **App copy + Terms v5** — ship v5 TermsVersion (migration + insert + preview + DB row in lockstep), re-acknowledgement, honour 30-day-notice clause.
4. **Marketing site** — flip SERP artefacts (JSON-LD, FAQ) + copy **in the same window** as the app copy flip, ideally same day.
5. Migration ordering (staging → prod, `prisma migrate deploy`, verify Vercel green); cache/revalidation on pricing surfaces; re-crawl consideration.

Aim for an **atomic copy cutover** (app + marketing) even if backend lands earlier behind unchanged copy.

---

## 26. Risks

1. **Frozen `freeOnExchange` stale `false`** → wrongful £59 charges on existing self files if billing leans on the stamp. *Mitigate: skip self-managed in billing by type, backfill.*
2. **Revenue-dashboard £59 inflation / "lost revenue"** misreads. *Mitigate: `freeReason` + reframe before switch.*
3. **`feeTier=free` overreach** → freeing outsourced on mixed agencies. *Mitigate: free-by-service-type, not agency-wide.*
4. **First-outsourced-free concurrency** double-free. *Mitigate: partial unique index / row lock.*
5. **Terms drift** — editing v4 in place breaks acknowledgement integrity. *Mitigate: v5 versioned + re-ack.*
6. **SERP lag** — Google keeps serving £59/trial. *Mitigate: fix JSON-LD Offer + FAQ first; request re-crawl.*
7. **Website/app mismatch window.** *Mitigate: atomic copy cutover.*
8. **Two hardcoded £59s** outside the fee engine drift silently. *Mitigate: change all three together.*

---

## 27. Recommended implementation phases

(Full phase table in the chat plan; summarised.)
- **P0 Decisions + spec** (reconcile with `docs/active/free-agency-launch/SPEC.md`).
- **P1 Data model + billing engine** — self=£0 by type; `freeReason`; first-outsourced-free at exchange + switch, concurrency-guarded; backfill; pricing-version call.
- **P2 Remove trial** — delete the 14-day branch; rescope new-sale gate to outsourced-only; repurpose card-capture; strip trial UI; fix stale 7-day copy.
- **P3 Internal reporting/analytics** — fix £59 inflation; split trial value; add first-outsourced-free visibility + free→outsourced; promote retention.
- **P4 App copy + Terms v5** — v5 + re-ack; email/hub/sidebar copy; three £59s.
- **P5 Marketing** — SERP artefacts first, then copy + `lib/pricing.ts` free modelling + pricing-page option; `/test/*` cleanup.
- **P6 Rollout + tests** — atomic cutover, migration ordering, full test suite.

---

## 28. Decision register

| ID | Decision | Why it matters | Option A | Option B | Option C | Recommendation | Blocks build? | Artifact helps? |
|---|---|---|---|---|---|---|---|---|
| **D1** | Self-free mechanism | `feeTier=free` frees outsourced too | Free-by-`serviceType` rule in `grossFee`/billing-trigger | Default `feeTier=free` | Zero `IN_HOUSE_FEE_PENCE` | **A** | Yes | No |
| **D2** | Do free self files create £0 invoice lines / set `billedAtExchange`? | Line pollution vs auditability | Off-invoice (reuse "exchanged not billed") | £0 lines | — | **A** | Yes | No |
| **D3** | First-outsourced-free **eligibility** | Defines the whole offer | First outsourced **exchanged** | First created | First submitted | **A**; per-agency lifetime; exclude migrated/demo; **cohort F: grandfather or retro-grant?** | Yes | No |
| **D4** | Free first outsourced **representation** | Accounting clarity | Explicit price + discount line (`discountReason`) | Silent £0 | — | **A** | Yes | Yes (invoice mock) |
| **D5** | When consumed + reversal | Giveaway integrity | At exchange, once-consumed-gone | At create | Re-grantable on reversal | **A** | Yes | No |
| **D6** | Add `freeReason` discriminator | Honest revenue math | Add before switch | Don't | — | **A** | Yes | No |
| **D7** | Pricing-version / effective-date | Historical integrity; avoid retro-repricing | Add `feeScheduleEffectiveFrom` | Accept retroactive-to-unissued | — | **A (lightweight)** | Partially | No |
| **D8** | When is a self-progress agency asked for a card? | Core gate rescope | Never (card only for 2nd+ outsourced) | On 1st outsourced | — | **A** | Yes | No |
| **D9** | Cohort transition policy (A–J), esp. H (pre-launch self exchanging after) | Fairness + no history rewrite | Forgive pre-launch self £59 | Honour terms (bill £59) | — | Lean **A** | Yes | No |
| **D10** | Legacy tier carve-out | Don't break contracts | Unchanged | — | — | Unchanged | No | No |
| **D11** | Keep vs retire "saved via trial"/free-tier historical surfaces | Reporting continuity | Keep + relabel | Retire | — | **A** | No | No |
| **D12** | "Free" language + JSON-LD free representation | Brand + SEO | "Free" | "Free forever" | `price:"0"` vs omit Offer | Decide with artifacts | No (P5) | Yes |
| **D13** | Failed outsourced payment blocks free self-progress? | Don't lock free users out | No | Yes | — | **A (No)** | Yes | No |
| **D14** | Terms v5 wording | Legal accuracy | Draft + counsel review | — | — | Draft, you/counsel review | P4 | No |
| **D15** | New master hook (retire "pay on exchange" umbrella?) | Whole-site message | Free-led hook | Keep pay-on-exchange (outsourced-only) | — | Free-led | No (P5) | Yes |
| **D16** | Symmetric two-tier model dead? | Reshapes Hero/pricing | Free hero → paid upgrade | Keep symmetric | — | Free hero | No (P5) | Yes |
| **D17** | First-outsourced-free own surface? + terms | Acquisition lever | Dedicated badge/banner | Fold into outsourced card | — | TBD | No | Yes |
| **D18** | Pricing calculator survives? | Its premise was £59×self | Rescope to outsourcing cost | Cut | — | Rescope | No (P5) | Yes |
| **D19** | Show remaining first-outsourced-free eligibility to agents / internal? | Transparency | Both | Internal only | Neither | Internal + agent badge | No | Yes |

---

## 29. Ellis — decisions required (systematic)

Work through **§28** in order. The **build-blocking** ones (must answer before Phase 1–2 code): **D1, D2, D3, D4, D5, D6, D8, D9, D13**. Phase-3+ (can follow): **D7, D11, D14**. Marketing/positioning (Phase 5, artifact-assisted): **D12, D15, D16, D17, D18, D19**.

Also confirm the two facts the audit surfaced that you may not have decided yet:
- **Cohort F** (agencies that already outsourced): do they get a retroactive free file, or is first-outsourced-free grandfathered to new agencies only?
- **Cohort H** (self-progress files created before launch, exchanging after): forgive the £59 or honour the "price set at add time" terms clause?

## 30. Ellis — manual actions eventually required (at the very end)

Not needed to continue the audit or planning; parked for the build/launch window:
1. **Confirm the new pricing numbers** beyond what's stated (bands stay £250/£300/£350? outsourced ceiling really £350 — the unshipped test pages say £250–£600).
2. **Legal review** of the Terms v5 draft before it ships + re-acknowledgement flow.
3. **Stripe** — confirm no product/price changes needed (self-progress leaving billing means fewer invoices, not new Stripe objects; verify).
4. **Marketing copy sign-off** on the master hook + "free" language + first-file-free wording.
5. **Google Search Console** — request re-crawl of `/pricing` and homepage after the JSON-LD/FAQ flip.
6. **Honour the 30-day pricing-notice clause** timing for existing acknowledged agencies.
7. **Delete or update** the `/test/homepage-v2,v3` marketing concept pages (stale pricing).

---

*End of audit. Nothing in this document has been built. Next step: work through the Decision Register (§28), then produce pricing-page artifacts for the positioning decisions, then Phase 1.*
