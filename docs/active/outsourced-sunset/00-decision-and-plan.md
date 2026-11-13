# Outsourced sunset — business-model pivot (living doc)

**Status:** planning. Created 2026-11-12. This is the single source of truth for the
pivot. Keep it current; when it contradicts `docs/PRODUCT_TRUTH.md` or the code,
fix the stale one (and note it here).

> One-line summary: TSP stops *selling* outsourced progression to new agents. From
> the New Year it's a platform — agents free + £50/exchange, external progression
> businesses on a seat model — with a reversible master switch so outsourced intake
> can be turned back on later without redoing the work. The existing outsourced book
> (Boardwalk + TSP's own files) is **serviced out privately to ~February**, not
> handed back.

---

## 1. The decision

Move away from TSP doing outsourced sales progression. The model becomes:

| Who | Price |
|---|---|
| **Estate agents** (self-serve) | **Free to use, £50 per exchange — flat, every exchange** |
| **External sales-progression businesses** | **£59 per user · £39 per team member · £5 per *added* sale** |
| **TSP** | Platform operator only. No longer takes on outsourced files from new agents. |

The "submit to TSP / we'll progress it for you" path closes to new agents. In its
place, an agent who wants a file progressed is **introduced to an external
progression business** (a marketplace/intro — see §6, Workstream B).

**£50/exchange is flat and universal (confirmed 2026-11-12).** Every exchange on the
go-forward agent model is £50 — no tiers, no £250/£350 bands, and **no automatic
free** (the old "self-progress free" and "first outsourced free" giveaways end). The
only way a sale is free is a **deliberate manual grant** (next para). The old £250–£350
outsourced band pricing is **gated off with the rest of the TSP-outsourced capability**
— it is not deleted (revert story), and the **existing outsourced tail keeps billing at
its current rates until the book is cleared** (~Feb; that's the ~£8k). New intake never
reaches the bands.

**Free sales are a manual grant, not an automatic allowance (confirmed 2026-11-12).**
Ellis's call: *"click which sales are deemed free is probably better"* than a numeric
per-agency count. So the mechanism is a **per-sale "mark this exchange free" control in
the Command Centre** — which reuses the existing `PropertyTransaction.freeOnExchange`
flag (no new schema needed for the core). Optionally a small **bulk-grant helper** for
blocks like Boardwalk's 41. This replaces the earlier "editable numeric allowance"
idea. Still CC-editable, still a marketing/A-B lever — just expressed per-sale.

---

## 2. Timeline — three gates, not one

The "light switch" the critique asks for is really **three separate things** that
flip at different times. Treating them as one is the mistake to avoid.

1. **Intake gate (New Year, ~1 Jan 2027).** New agents can no longer outsource to
   TSP. The marketplace/intro is the alternative. *Reversible.*
2. **Marketing/public model (HARD deadline: Christmas, ~25 Dec 2026).** Website,
   terms, in-app pricing/positioning all flip to the new model. Must be done by
   Christmas so the New-Year transaction push lands.
3. **Internal servicing (runs to ~February 2027).** TSP keeps progressing the
   **existing** outsourced files — Boardwalk's (they keep adding until Christmas,
   ~£8,000 in fees) and TSP's own — **privately**, to completion. The internal
   progression tools (Command Centre, assigned-progressor workflow) stay fully live
   for these files. Nothing is handed back.

So the master switch gates **agent-facing intake + public marketing**. It does
**not** switch off internal servicing — that continues until the book is cleared,
then the tools go dormant (kept, not deleted, for revert).

**New-Year "fresh start" also includes (growth, §6 Workstream C):** automated email
marketing campaigns to agents, and inviting agents via the exponential Boardwalk
chains (chain data surfaces other agents to invite).

---

## 3. The master switch (the "light switch")

**Principle: gate, don't delete.** Outsourced code stays in the codebase, wrapped
behind the switch. Flipping it hides/shows; it never requires re-building. Reverting
is a flag flip. **Ordinary UI improvements we make along the way are permanent** —
only the *outsourced capability* toggles, never polish.

- **Mechanism:** one superadmin-flippable server flag (app). The marketing **website
  is a separate Vercel deploy** (we have access) — aligned manually / its own flag,
  not literally the same env var.
- **What it gates (to be filled by the Week-1 audit):** submit-to-TSP intake, the
  outsourced-tier presentation/pricing, outsourced marketing copy across app + portal
  + website + terms.
- **What it does NOT gate:** internal servicing of existing files; the assigned-
  progressor workflow for live files; any UI polish.
- **Revert story:** flip back on → outsourced intake + marketing reappear, no rework.
  "Ghost TSP, and a link/confirmed number reinstates it."

---

## 4. Boardwalk specifics

- 6-month trial. Prepaid a block of **free sales = 41** (confirmed 2026-11-12 from
  `Sale_Migration_For_Agents_COMPLETED (2)(Sales).csv` — every Boardwalk sale live
  as of 5 Nov 2026 4pm, all migrated on). The CSV has 42 address rows; row 1
  (`12 Juniper Way`, owner `jordan.neg@youragency.co.uk`) is the template's fake
  example and is excluded → **41**. (Rows 17 & 18, `71 Muller Road` /
  `5 Redcliffe Lofts`, are real sales with a blank owner-email cell — kept.)
  Everything after the 41: **£50/exchange**.
- **No card captured yet** — needs card capture before the free block runs out.
- Tier: **same as any agent** (free to use + £50/exchange), minus the 41 gifted free
  sales. Their files are **self_managed** (migrated via the agent import path), so they
  are a clean test case of the new go-forward model.
- Their 41 is a block of the **manual free grant** (§1): mark those 41 specific files
  `freeOnExchange=true` (per-sale "mark free" in CC, or a one-off bulk helper). After
  the 41, every exchange is £50.

**TODO:** mark Boardwalk's 41 files free (reuse `freeOnExchange`; bulk helper optional)
+ schedule card capture before the 41 are used up.

---

## 5. Open items / decisions still to make

- **Marketplace vs light intro (Workstream B):** the full agent→business directory is
  significant work. Not deferred, but its depth depends on how much we get through.
  A lighter "request an intro" bridge may ship first if the full build isn't ready by
  the New Year. Priority/placement: TBD as the plan runs.
- **Website + terms ownership:** "we'll go through this at the time." Who drafts the
  new terms (legal vs a draft from me). Hard Christmas deadline regardless.
- **Pricing reconciliation (RESOLVED, Week 1).** Audit confirmed what's net-new: the
  £50 flat agent fee (self-managed is currently hard-coded £0 in several readers —
  `fee.ts:21-24,72-76`, `billing-trigger.ts:104` — those change to £50), retiring the
  agency outsourced bill path for new intake, and the per-sale free grant. Already
  built & LIVE: the £59/£39/£5 business seat model. See `01-audit-inventory.md` §3.
- **Forward idea (not Week-2 work):** give external progression businesses some of the
  useful TSP plumbing — e.g. the "sale added" holding email (`send-outsource-intro.ts`)
  is useful to them too. Park as a Workstream-B enhancement.

---

## 6. The 8-week plan (mid-Nov 2026 → early Jan 2027)

Three parallel workstreams. **A (sunset)** is the spine; **B (new-model plumbing)**
and **C (growth)** hang off it. Hard gate: website/terms by Christmas; switch flip at
New Year; servicing tail to February (ops, beyond the build).

### Workstream A — Sunset & the reversible switch
- **Week 1 — Audit + switch design + this doc.** The definitive inventory of *every*
  outsourced surface (flows, flags, routes, copy, billing hooks, CC tools, portal +
  website references). Design the master switch (gate-don't-delete). Confirm Boardwalk
  numbers. Reconcile pricing against PRODUCT_TRUTH. **Nothing ships** — this is the map.
- **Weeks 2–3 — Build the switch + gate intake.** Master flag (default ON = today).
  Wrap new-outsourced intake in the agent app behind it. Flag-off = no new submissions;
  flag-on = byte-identical to now. Internal servicing untouched.
- **Weeks 5–6 — Portal + Command Centre gating** of the agent-facing/marketing
  outsourced surfaces; confirm internal servicing stays live for existing files.
- **Week 7 — Flip rehearsal** (on → off → on) proving revert is a true light-switch.

### Workstream B — New-model plumbing
- **Weeks 3–4 — Pricing + billing.** Agent free + **£50/exchange**; **CC-editable
  free-sales allowance**; external-business seat pricing reconcile; **Boardwalk**
  billing (prepaid block → £50/exchange + card capture).
- **Weeks 4–5 — Marketplace / intro** (the submit-to-TSP replacement), as far as
  feasible; lighter "request an intro" bridge otherwise. (Flexible — see §5.)

### Workstream C — Growth (New-Year push)
- **Weeks 5–6 — Website + terms (HARD: by Christmas).** New-model copy; remove
  outsourced-TSP marketing; new terms. Separate Vercel deploy.
- **Weeks 6–7 — Marketing engine.** Automated email campaigns to agents (set up +
  schedulable); agent-invite loop via Boardwalk chains.

### The flip (New Year)
Marketing/website/terms live · new-user outsourced intake OFF · campaigns pumping ·
chain-invites going out · **existing files serviced privately to ~Feb**.

---

## 7. Doc hygiene

When this lands, update: `docs/PRODUCT_TRUTH.md` (pricing §1–2, business types §9,
surfaces §4), any terms/marketing copy, and flag stale outsourced references. Log
every decision below as it's made.

### Decisions log
- 2026-11-12 — Pivot agreed; existing book serviced out (not handed back) to ~Feb;
  website/terms hard deadline Christmas; intake + marketing flip New Year; free-sales
  allowance must be CC-editable; switch is reversible (gate-don't-delete).
- 2026-11-12 — **Week 1 audit complete.** Full classified inventory in
  `01-audit-inventory.md` (6 parallel mappers: data model, agent-app intake, billing,
  portal, Command Centre, copy/flags/docs). Key findings: the single determination
  chokepoint is `transactions.ts:1230-1231`; the CC has NO intake surface (gating lives
  in the agent app + marketing); the portal is already white-labelled to the agency
  (one client-facing GATE = the outsourced intro email); the £50/exchange, the £5/added-
  sale dial, and the CC-editable free-sales allowance are all genuinely **net-new**
  (the £59/£39/£5 business seat model already exists and is LIVE). Three decisions
  pushed to the founder before Week 2 (see `01-audit-inventory.md` §★): scope of the
  £50 fee; whether external businesses/trials are in-scope; broker-fallback timing.
- 2026-11-12 — **Week 2 built (staging, not pushed): intake gate + flat-£50 billing,
  both behind one switch `OUTSOURCED_INTAKE_ENABLED` (defaults ON → byte-identical to
  today).** Intake gate: server (`createTransactionAction`, `switchServiceTypeAction`)
  + UI hide (new-sale toggle, file-page "Switch to TSP" pill). Billing: new pricing
  version `2027-01_flat_fifty`, stamped on new sales only when the switch is off;
  `computeFee` returns a flat £50 for those; the exchange trigger bills a flat-fifty
  self-managed file; `freeReason` no longer stamps `permanent_free_self` under the new
  model. Readers threaded: accrual, running total, reversal, lifetime. **One flip =
  intake closed + £50 pricing live, nothing retroactive.** Commits 8a483c21, aea5bc0b,
  d61db1b0 (+ docs 6b0771de). **Billing follow-ups (next):** CC revenue forecasting
  (`lib/command/revenue.ts` — 4 sites still value flat-fifty at £0), `retention.ts`
  free-value, and the agent-facing earnings/plan-terms presentation (`EarningsBuilder`,
  `PlanTermsCollapsed`, `MetricsStrip`, billing page) + the per-sale "mark free" CC
  control. NOTE: £50 pricing is tied to the SAME switch as intake (the New-Year flip),
  per founder "built behind the switch exactly like this".
- 2026-11-13 — **Scheduling (founder):** the **marketplace/intro** (Workstream B) and
  the **billing-engine card requirement** (collect the £50) are both deferred to the
  **Christmas shutdown / mid-December** build window. App-side new model is otherwise
  complete. Paused here.
- 2026-11-13 — **In-app copy gating (#1) BUILT (staging, not pushed).** All behind the
  switch, byte-identical when on. B onboarding (`4a89e07c`): welcome modal/tour show
  self-progress framing when off. A emails (`7dbc037e`): welcome + sale-connected drop
  the outsourced promise; the "send us another sale" win-back stops dispatching. C
  pricing presentation (`3f48f294`): Plan & terms / metrics strip / new-sale earnings
  read the flat-£50 model. **Verification guide written: `02-verification-guide.md`**
  (the December walk-through — every visible change, where to look, before/after). One
  carve-out: the billing-page Payment-method block ("send to TSP's own team") is left
  for the billing-engine **card-requirement** decision (logic, not copy).
- 2026-11-13 — **`/outsource` reclassified to the marketing bucket (founder).** It's a
  public, no-auth COLD-OUTREACH landing page (`portal.thesalesprogressor.co.uk/outsource`),
  not linked anywhere in the app — reached only via links in outreach emails. So it's
  prospect-facing marketing, not an in-app surface: it ships/dies with the website +
  outreach work (Christmas/growth), NOT with the in-app copy gating (#1).
- 2026-11-13 — **In-app copy gating (#1) scope FIXED (founder).** Gate behind the
  switch, copy/visibility only, external-SP copy untouched: (a) welcome + re-engagement
  emails (drop "first outsourced free / let our team run it"), (b) onboarding modal +
  tour (self-progress framing when off), (c) agent billing + pricing presentation
  (£50-per-exchange story instead of £250–£350 / "first sale free" / "send to TSP's
  team"). The new £50 copy to be drafted + founder-approved mid-build before commit.
  Excludes `/outsource` (now marketing bucket).
- 2026-11-13 — **Billing follow-ups done (staging, not pushed):** CC revenue
  forecasting now values flat-fifty files at £50 (pricingVersion threaded through all
  7 `lib/command/revenue.ts` computeFee sites, commit 61660a16); and the per-sale
  **"mark free" CC control** is built (commit 17d636b5) — `setSaleFreeOnExchangeAction`
  + `MarkFreeToggle` in the agency sales table, shown only on flat-fifty files,
  refusing already-billed files. Boardwalk's existing 41 are pre-flip free-self
  (already £0); the grant is for comping post-flip £50 sales. **Remaining Workstream B
  billing: agent-facing presentation** (EarningsBuilder / PlanTermsCollapsed /
  MetricsStrip / billing page still narrate £250–£350) — gated with the marketing copy.
- 2026-11-12 — **Three decisions resolved (founder):**
  (1) **£50/exchange is flat and universal** — every agent exchange, no bands, no auto-
  free. Old £250–£350 gated off (not deleted); existing outsourced tail bills at current
  rates until cleared (~Feb). Self-managed £0 hard-coding → £50.
  (2) **External businesses / trials are OUT of scope** — keep and grow. Forward idea:
  reuse TSP plumbing (e.g. the "sale added" holding email) for external businesses.
  (3) **Broker fallback: keep current rules** — agency's own broker if set, else
  recommended TSP; new-year focus shifts to provider/surveyor/mortgage referrals.
  (4) **Free sales = manual per-sale grant** (reuse `freeOnExchange`), not a numeric
  allowance — "click which sales are free."
