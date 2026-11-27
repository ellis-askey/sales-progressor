# TSP Outsourced Hub — restructure plan

**Status:** Phase 1 (hub) in build. Phases 2–3 (re-axis + per-page strip) are the collaborative follow-up.
**Owner decisions:** founder-confirmed 2026-11-27 (see "Decisions" below).
**Arc goal:** TSP's own outsourced progression book gets ONE dedicated hub page and lives NOWHERE else in the Command Centre. Every other CC page becomes a three-way business-type lens: **All · Agents · External Prog**. This also sets outsourced up for a clean later removal (it is being wound down — see `docs/active/outsourced-sunset/`).

---

## The two axes (why this was tangled)

The CC mixes two independent axes on `PropertyTransaction`:

| Axis | Field(s) | Meaning |
|---|---|---|
| Who progresses | `serviceType` (`self_managed`/`outsourced`), `Agency.modeProfile` | the "outsourced" axis — today's sidebar SP/PM toggle |
| Who owns the book | `progressionBusinessId` (null = TSP), `ProgressionBusiness.isTsp` | estate-agency vs external progression business |

The three populations are a **two-field combination**, not one field:

| Population | `serviceType` | `progressionBusinessId` |
|---|---|---|
| **Agents** (self-managed) | `self_managed` | `null` |
| **TSP outsourced** | `outsourced` | `null` |
| **External Prog** | (`outsourced`) | not null (`isTsp=false`) |

**Existing bug this fixes:** the sidebar "PM" = `serviceType:"outsourced"`, which *also* matches external-business sales (they're `outsourced` too). The only discriminator is `progressionBusinessId`. So "PM" silently folds external businesses into TSP numbers everywhere except the overview `POPULATIONS` block (the one correct pattern — reused by the hub).

---

## Decisions (founder-confirmed)

1. **"All" excludes TSP-outsourced.** All = Agents + External Prog only. Nothing about TSP's own sales bleeds into the main CC — the hub is the sole home.
2. **An outsourcing agency is still an Agent customer.** It stays in the Agents roster / signups / account views; only its *outsourced sales* move to the hub. Mixed agencies split naturally at the transaction level.
3. **Rollup limitation accepted.** `DailyMetric`/`WeeklyCohort` have no business dimension, so the hub reads **live transactions** (the clean `progressionBusinessId:null` split). No rollup migration for v1; deep historical trend lines are deferred (fine — TSP progression is winding down).
4. **Sequencing:** build the hub first (additive, breaks nothing), then re-axis + strip page-by-page.

---

## Target model

- **Primary sidebar toggle** `All · Agents · External Prog` replaces `All · SP · PM`. `CommandMode` goes `sp|pm|combined` → `all|agents|external`. Secondary picker becomes context-aware (agencies in Agents mode, businesses in External mode).
- **TSP Outsourced hub** (`/command/tsp-outsourced`) owns 100% of `serviceType=outsourced AND progressionBusinessId=null`. Removed from every other page.
- **External Prog** already has a clean home (`/command/businesses`, `isTsp:false`).

---

## The hub (what it contains)

A full operational hub for TSP's own book, all live-tx, clean `progressionBusinessId:null`:

- **Summary tiles:** active files, exchanged-not-completed, completed (period), overdue (expected exchange past, not exchanged), supplying agencies, unassigned.
- **Revenue:** pipeline estimate (live active files via `computeFee()`, labelled estimate) + banked (`InvoiceLine` kind `outsourced_fee` on TSP files).
- **The book:** every live outsourced file — agency, address, assigned progressor, days outsourced, expected exchange, days silent (overview's proven filter).
- **Supplying agencies:** which agencies feed TSP work + counts + modeProfile.
- **Progressor workload:** files per assigned SP progressor + unassigned.

Nothing is deleted anywhere yet — the hub is additive. Each outsourced surface *relocates* here in Phase 3 (conservation rule: zero loss).

---

## Phasing

- **Phase 1 — Hub (additive).** `lib/command/tsp-outsourced.ts` service + `/command/tsp-outsourced` page + `workspace-nav.ts` entry. Breaks nothing. ← *in build*
- **Phase 2 — Re-axis sidebar.** `scope.ts` (`CommandMode` → `all|agents|external`) + `CommandSidebar.tsx` + context-aware picker. Coupled to Phase 3 (every `parseMode`/`serviceTypeScope` consumer must convert in lockstep).
- **Phase 3 — Strip outsourced from each general page (founder-driven, page-by-page):** overview, agencies, agency/[id], money/RevenueTab, revenue/breakdown + [agencyId], growth tabs (Trends/Activation/Retention/Acquisition/Engagement), platform/Timeframes. Each stops rendering the outsourced slice and adopts the three-way lens.

During Phases 1→3, outsourced shows in both the hub and the un-stripped pages. Expected and safe.

---

## Consumer inventory (Phase 3 worklist)

Pages: `overview`, `agencies`, `agency/[agencyId]`, `money` (RevenueTab), `revenue/breakdown`, `revenue/[agencyId]`, `growth` (TrendsTab, ActivationTab, RetentionTab, AcquisitionTab, engagement/FeaturesView), `platform` (engine/TimeframesView).
Services: `scope.ts`, `today-live.ts`, `revenue.ts`, `retention.ts`, `feature-usage.ts`, `timeframes.ts`, `growth-analytics.ts`, `agency-file.ts`, `files.ts`, `email-senders.ts`, `email-catalogue/*`.
Already clean: `businesses.ts` (External Prog surface).
