# 07 — Growth Analytics consolidation (investigation + proposal)

**Status: READ-ONLY INVESTIGATION. Nothing implemented. Awaiting founder approval of the IA before any change.**

Mirrors the Content consolidation arc (docs 06): one tabbed workspace, legacy routes redirect in, sidebar collapses, legacy pages retired only after per-tab parity, lazy per-tab loading, all behaviour/gates/write-paths/deep-links preserved.

---

## 1. Every Growth entry today (sidebar `growth` section — 12 items)

All are single `page.tsx` routes under `app/command/(protected)/`, `force-dynamic`, superadmin-gated by the `(protected)` layout. Split by nature:

### A. Read-only analytics dashboards (10) — consolidation candidates
| Route | Label | Purpose | Scope filter | Notes |
|---|---|---|---|---|
| `/command/growth` | Trends | Platform trends over time, segment breakdowns, acquisition, signup cohorts | `?mode&agency` | 501 lines. Points *out* to activation for the funnel. |
| `/command/activation` | Getting started | The real activation cohort funnel (owns it) | `?mode&agency` | 403 lines. Cohort set-intersection in JS. |
| `/command/retention` | Repeat use | Returning-user trend/rate/frequency + churn-risk list | `?mode&agency` | 333 lines. |
| `/command/adoption` | App adoption | Portal notifications + PWA install + engagement per client | — | 456 lines. `AdoptionTable` (expandable). |
| `/command/followup-usage` | Feature usage | Whole-platform feature usage ranked, with a per-feature **detail drill-down** | `?mode&agency` + detail | 384 lines. |
| `/command/timeframes` | Timeframes | Live median/mean/n per milestone step vs the app's assumptions | `?mode&agency` + ParamTabs (segment…) | 178 lines. Operational, not lifecycle. |
| `/command/website-growth` | Website & Growth | PostHog site behaviour + homepage section reach + the journey funnel | ParamTabs (period, tier) | 231 lines. **PostHog-gated** (`posthog-read`). |
| `/command/chain-invites` | Chain invites | Agent-to-agent invite funnel + call-list of lookers who haven't joined | `?range` | 335 lines. |
| `/command/enquiries-chase` | Chase experiment | "Is our chasing working?" — chase effectiveness + opted-out list | **`?tab`** (4 sub-tabs) | 126 lines. Write paths (OptedOut). **`?tab` collides with a workspace `?tab`.** |
| `/command/experiments` | Growth tests | Growth experiment tracker: snapshots, before/after, suggestions | — | 191 lines. **Write paths** (new experiment, actions, hypothesis). |

### B. Operational feature arcs (2) — KEEP STANDALONE
| Route | Label | Why it is NOT an analytics dashboard |
|---|---|---|
| `/command/prospects` | Prospects | Full CRUD acquisition tracker + AI web research (`maxDuration 300`, AI-gated import). ~16 `revalidatePath` write sites across `prospects.ts` + `prospect-flow.ts`. |
| `/command/ai-outreach` | AI Outreach | 699 lines. Objective funnel + segments + experiments + cycles + sends + AI activity **plus operational controls** (generate proposals, build orders). Write paths in `outreach.ts`; linked to Prospects. |

**Recommendation:** treat Prospects + AI Outreach like Content treated `engagement/[draftId]` and `/think` — leave them as their own routes. Consolidating them is a different concern (heavy write paths, AI, operational) and would risk behaviour. They stay as standalone Growth sidebar entries.

---

## 2. Duplicate / overlapping functionality
- **`growth` (Trends) vs `activation`**: Trends deliberately does NOT repeat the activation funnel — it links to Getting started, which owns it. Minor narrative overlap (both cover signup/cohorts); consolidation makes the relationship explicit (adjacent tabs).
- **`followup-usage` vs `adoption`**: both answer "are they using it" (platform features vs portal/PWA adoption). Natural pairing under one "Engagement" tab.
- **`website-growth` vs `chain-invites`**: both answer "how do people find/come to us" (public web vs agent-to-agent invites). Natural pairing under "Acquisition".
- **`experiments` vs `enquiries-chase`**: both are "is this working?" tests. Natural pairing under "Experiments".
- No true dead duplication — each has a distinct loader + dataset. The overlap is thematic, which is exactly what a tabbed IA resolves.

## 3. Must-preserve features / workflows
- Every loader + dataset (DB aggregations, PostHog reads, cohort set-intersection).
- The `?mode&agency` scope filter on the five scope-aware dashboards (built inline per page).
- `website-growth` period/tier ParamTabs; `timeframes` segment/mode ParamTabs; `followup-usage` feature **detail drill-down**; `enquiries-chase` 4 sub-tabs; `chain-invites` `?range`.
- **Write paths**: `experiments` (new/actions/hypothesis via `ExperimentActions`/`NewExperimentForm`/`ProposedHypothesisEditor`, revalidated from `app/actions/command-centre.ts`), `enquiries-chase` (opted-out), `adoption` (expandable table). These live inside imported components, so relocating the page body preserves them unchanged.

## 4. Permissions & gates
- **Permissions**: all under `(protected)` → `hasSuperAdminPowers` via the layout. `commandDb` full-access. Unchanged by consolidation (shell lives under the same layout).
- **Analytics gates**: `website-growth` is explicitly PostHog-gated; several others read PostHog via loaders and degrade to honest empty states. No change — a tab only loads when active, so PostHog is hit no more than today.
- **AI gates**: none in the 10 analytics pages. AI gates live in Prospects / AI Outreach (staying standalone).

## 5. Deep links & cross-surface dependencies
- `app/command/(protected)/overview/page.tsx:835` → `/command/experiments` (Today page CTA).
- `components/command/insights/SignalActions.tsx:40` → `/command/experiments` (Briefing signal action).
- `app/actions/command-centre.ts` → `revalidatePath("/command/experiments")` ×6, `revalidatePath("/command/enquiries-chase")` ×1 (post-write cache busts — the Content-style deferred-revalidatePath situation).
- No inbound links to growth/activation/retention/adoption/followup-usage/timeframes/chain-invites/website-growth found beyond the sidebar + the orphaned `TabNav`.
- `buildFilterUrl` (scope.ts) has **zero call sites** — scope links are built inline, so there are no inter-page scoped URLs to rewrite.
- `TabNav.tsx` / `CommandTabNav` — orphaned legacy whole-CC tab bar (zero importers); unrelated to this work; delete as a separate decision.

## 6. Query / compute / infrastructure cost
These are the **heaviest pages in the Command Centre** (PostHog reads, cohort intersections, large aggregations). The consolidation must not change per-visit cost:
- **Mandatory lazy loading** (the Content lesson): render only the active tab + active secondary view via `{active === X && <View/>}` gating async server components. One dashboard renders at a time — identical cost to today. Rendering all tabs would fire ~10 heavy loaders; the gate prevents it. This is implementation rule #1.
- Shell stays `force-dynamic` (no new caching posture). Shared scope parse is trivial.
- PostHog quota unaffected (website tab hits PostHog only when active, as now).

## 7. Concurrency risk
LOW. Every Growth `page.tsx`, its `lib/command/*` loader, and the write-path components are **clean** in the working tree; the concurrent session is working in agent/marketing design-system, not `/command`. Re-verify `git status` at implementation time, but no collision expected.

---

## 8. Proposed information architecture

A tabbed **Growth** workspace at **`/command/growth`** (reuse the route, as Content reused `/command/content`), default tab **Trends**, with lazy per-tab loading and the `?mode&agency` scope header surfaced where relevant.

**Recommended — 6 lifecycle tabs:**
| Tab (`?tab=`) | Secondary (`?view=`) | Sources |
|---|---|---|
| **trends** (default) | — | `growth` |
| **acquisition** | `website` (default), `invites` | `website-growth`, `chain-invites` |
| **activation** | — | `activation` |
| **engagement** | `features` (default), `adoption` | `followup-usage` (keeps its detail drill-down), `adoption` |
| **retention** | — | `retention` |
| **experiments** | `tests` (default), `chasing` | `experiments`, `enquiries-chase` |

**Two open IA decisions for the founder:**
1. **Timeframes** — it is operational (milestone-step timing vs assumptions), not a customer-lifecycle metric. Recommend **rehoming to Platform** (next to `/command/rules`, which it informs via the expected-days engine) rather than adding a 7th Growth tab. Alternative: keep it as a 7th "Timeframes" tab.
2. **Experiments + Chasing sharing one tab** vs two separate top tabs. Recommend sharing (both are "is X working?"), accepting that `enquiries-chase`'s internal `?tab=` must be renamed to avoid colliding with the workspace `?tab=` (see §9).

**Sidebar result:** the `growth` section goes from 12 entries to **3** — `Growth` (workspace), `Prospects`, `AI Outreach`.

---

## 9. Exact route map

| Legacy route | Canonical destination | Notes |
|---|---|---|
| `/command/growth` | `/command/growth?tab=trends` | reused as the shell; default tab = Trends |
| `/command/website-growth` | `/command/growth?tab=acquisition&view=website` | preserve `period`/`tier` sub-params |
| `/command/chain-invites` | `/command/growth?tab=acquisition&view=invites` | preserve `range` |
| `/command/activation` | `/command/growth?tab=activation` | preserve `mode`/`agency` |
| `/command/followup-usage` | `/command/growth?tab=engagement&view=features` | preserve `mode`/`agency` + feature detail param |
| `/command/adoption` | `/command/growth?tab=engagement&view=adoption` | |
| `/command/retention` | `/command/growth?tab=retention` | preserve `mode`/`agency` |
| `/command/experiments` | `/command/growth?tab=experiments&view=tests` | preserve write paths; repoint overview + insights links |
| `/command/enquiries-chase` | `/command/growth?tab=experiments&view=chasing` | **its internal `?tab=` → `?chase=`** (the one required behaviour-preserving URL change) |
| `/command/timeframes` | per decision 1 (rehome to Platform, or 7th tab) | preserve its ParamTabs |
| `/command/prospects` | **unchanged** (standalone) | no redirect |
| `/command/ai-outreach` | **unchanged** (standalone) | no redirect |

Redirects via `next.config` (a `GROWTH_REDIRECTS` array in a pure `lib/` module, as `lib/content-redirects.ts`), **`permanent: false`**, kept in place after the legacy pages are retired. Next forwards request query, so `mode`/`agency`/`range`/`period`/`tier`/feature-detail are preserved; none collide with `tab`/`view` except `enquiries-chase`'s `?tab=` (handled by the rename above).

---

## 10. Phased plan (mirrors Content 1 → 4B; each phase: tsc + ESLint + tests + lazy-load check + parity-before-delete + hold for review)

- **Phase 1** — Shell at `/command/growth` + **Trends** (default) + one more low-risk read-only tab (**Retention**) to prove the pattern. Legacy routes stay operational. Lazy loading. No redirects/sidebar yet.
- **Phase 2** — **Acquisition** tab (`website-growth` + `chain-invites`, `?view=`), incl. the PostHog gate.
- **Phase 3** — **Activation** + **Engagement** (`followup-usage` + `adoption`, preserving the detail drill-down).
- **Phase 4** — **Experiments** tab (`experiments` + `enquiries-chase`): the write-path group; resolve the `?tab=`→`?chase=` rename; most care.
- **Phase 5A** — Redirects (`GROWTH_REDIRECTS`, 302) + collapse sidebar (12 → 3) + repoint the 2 cross-surface deep links (overview, insights). Keep legacy pages.
- **Phase 5B** — Retire legacy pages after per-tab parity; repoint the `experiments`/`enquiries-chase` navigation redirects; **defer** the post-write `revalidatePath` legacy targets (Content precedent — harmless no-ops under `force-dynamic`).
- **Decision gate** — Timeframes placement (decision 1).

## 11a. Phase 1 — DONE (implemented, uncommitted, held for review)

Shell + Trends (default) + Retention. Legacy routes untouched/operational; no redirects, no sidebar change, no other tabs.

**Changed**
- `app/command/(protected)/growth/page.tsx` — now the tabbed shell (`ParamTabs`, `?tab=`, default `trends`, `force-dynamic`). Reads `?tab&mode&agency`; renders only the active tab via `active === key &&` (lazy); preserves `mode`/`agency` across tab switches in `hrefFor`.
- `components/command/growth/tabs/TrendsTab.tsx` *(new)* — verbatim body of the former `/command/growth` (6 parallel `commandDb` queries + conditional agency lookup + `WhatChanged` + `InfoTip`), as `TrendsTab({ mode, agency })`. Only the former page `<h1>` dropped (shell + tab strip replace it).
- `components/command/growth/tabs/RetentionTab.tsx` *(new)* — verbatim body of `/command/retention` (3 loaders + `DriftRow` + `InfoTip`), as `RetentionTab({ mode, agency })`. Only the `<h1>` dropped; intro paragraph + scope label kept.
- `__tests__/command/growth-consolidation.test.ts` *(new, 6 tests)* — two built tabs, lazy gating, scope threading/preservation, verbatim loaders + no-PostHog/fetch/polling, legacy retention page preserved.

**Decisions honoured:** Timeframes untouched (route + sidebar intact). Experiments/Chasing + Prospects/AI-Outreach not touched. No redirects/sidebar/other tabs. No polling/refresh/cron/new PostHog.

**Parity:** both tabs are verbatim extractions (loaders, scope, charts, tables, empty states, links identical). Sole cosmetic change: each tab's own `<h1>` removed (the shell heading + tab strip label it) — same relocation-only deviation as Content.

**Checks:** `tsc` 0 · ESLint 0 errors (4 pre-existing `no-command-import-outside` warnings on `commandDb` imports) · jest 53/53 (10 suites). **Runtime unverified** (no CC creds/app) — authenticated pass of both tabs + scope + tab-switch still outstanding, as in Content.

### Cost: before vs after (per-visit, and at 10× / 100×)
- **Before:** `/command/growth` ran Trends' 6 `Promise.all` queries + conditional agency lookup + `WhatChanged`'s 3 `cache()`d queries (~10 `commandDb` calls, **0 PostHog**); `/command/retention` ran its 3 loaders (~10–12 `commandDb` calls, **0 PostHog**) — two separate page visits.
- **After:** `/command/growth` (default) renders **only** `TrendsTab` (identical ~10 calls); `/command/growth?tab=retention` renders **only** `RetentionTab` (identical loaders); legacy `/command/retention` unchanged. The `active === key &&` gate guarantees exactly one tab's loaders run per request.
- **Difference:** effectively zero — identical queries per dashboard view, no new PostHog, no polling/cron. The shell adds only a `searchParams` parse + tab-strip render.
- **10× / 100×:** scales linearly with visits, same slope as today — consolidation does not multiply queries (one dashboard's loaders per request, never both). A tab switch costs the same as navigating to the old separate page (`force-dynamic`, no cache either way). No amplification risk introduced.

### enquiries-chase `?tab=` backward-compatibility (for Phase 4 — investigated, not implemented)
Existing values: `enquiries` (default/no param), `solicitor`, `client`, `opted_out` (`parseTab` falls back to `enquiries`). Under the workspace these must become `/command/growth?tab=experiments&view=chasing&chase=<value>` **without** the old `?tab=` colliding with the workspace `?tab=`. **Recommended resolution:** a `has`-conditioned redirect that captures the old value and references it in the destination, which *consumes* the `tab` query so Next does not re-append it (referenced query params are not forwarded):
```
{ source: "/command/enquiries-chase",
  has: [{ type: "query", key: "tab", value: "(?<v>solicitor|client|opted_out)" }],
  destination: "/command/growth?tab=experiments&view=chasing&chase=:v", permanent: false }
// + a bare fallback (no/other tab) → ...&chase=enquiries
```
Plus: rename the live Chasing sub-nav to emit `?chase=`, and have the Chasing view's parser accept a legacy `tab` value as a fallback for `chase` so no selection is silently dropped. To be verified at runtime in Phase 4.

## 11b. Phase 2 — DONE (implemented, uncommitted, held for review)

Acquisition tab with two secondary views (`?view=website|invites`). Legacy routes untouched; no sidebar/redirects; Prospects/AI-Outreach/Timeframes/other Growth pages untouched.

**Changed**
- `components/command/growth/tabs/AcquisitionTab.tsx` *(new)* — the `?view=` strip (ParamTabs) + `WebsiteView` (verbatim `/command/website-growth`: `getGrowthDashboard` + the two PostHog reads, period/tier controls, all Sections, HealthTile) + `InvitesView` (verbatim `/command/chain-invites`: 4 loaders + Funnel/FollowUps/KnockOn/AfterJoin/UninvitedList/Stat, range control). Each page's `<h1>` dropped (shell + strips label it); every dataset/chart/table/empty-state/gate identical. Internal filter links repointed to `/command/growth?tab=acquisition&view=…` (period/tier for Website, range for Invites).
- `app/command/(protected)/growth/page.tsx` — added `acquisition` to `TABS` (IA order: Trends, Acquisition, Retention); searchParams extended with `view/period/tier/range`; renders `<AcquisitionTab view period tier range />` gated by `active === "acquisition"`.
- `__tests__/command/growth-consolidation.test.ts` — +7 tests (13 total): three built tabs, view strip + lazy gating, Website loaders incl. PostHog-only-in-Website, Invites loaders, filter-link repoint, no polling/caching, legacy pages preserved.

**Parity:** both dashboards verbatim; only the per-page `<h1>` dropped (same relocation-only deviation as Phase 1). Visual hierarchy, responsive grids and the PostHog `TrackingDisabled` empty states unchanged.

**Checks:** `tsc` 0 · ESLint 0 errors (3 pre-existing `no-command-import-outside` warnings on the lib/command imports) · jest 60/60. **Runtime unverified** (no CC creds/app).

### Cost: before vs after (per-visit, 10× / 100×)
- **Website view** (`?tab=acquisition&view=website`): `getGrowthDashboard` (3 `commandDb` finds — agency/propertyTransaction/invoiceLine, **no PostHog**) + `getWebsiteBehaviour` + `getHomepageSectionReach`. Both PostHog reads **short-circuit to `null` with zero fetch when `isPosthogConfigured()` is false** (current project state — PostHog unset); when configured they issue their PostHog `fetch`es. Identical to the old `/command/website-growth`.
- **Invites view** (`?view=invites`): the 4 `commandDb` loaders only — **no PostHog, no fetch**. Identical to the old `/command/chain-invites`.
- **Switching views causes no unnecessary PostHog / duplicate loading:** `WebsiteView` and `InvitesView` are each gated by `view === key`, so exactly one view's loaders execute per request. Selecting **Invites makes ZERO PostHog calls** (the two reads live only inside `WebsiteView`, which isn't rendered). A view switch is one server render of the active view — same as navigating to the old standalone page; no stacking, no duplicate fetch.
- **Difference:** effectively zero per view. No polling, auto-refresh, extra PostHog or new caching introduced (shell + tab stay `force-dynamic`; no `unstable_cache`/`revalidate`).
- **10× / 100×:** linear with visits, same slope as today; a given view always runs exactly its own loaders. The only PostHog cost is Website-view renders × its existing read count — unchanged by consolidation, and zero while PostHog stays unconfigured.

## 11c. Phase 3 — DONE (implemented, uncommitted, held for review)

Activation tab + Engagement tab (two secondary views). Legacy routes untouched; no sidebar/redirects; Prospects/AI-Outreach/Timeframes/Experiments/Chasing untouched.

**Changed**
- `components/command/growth/tabs/ActivationTab.tsx` *(new)* — verbatim `/command/activation` (7-read `Promise.all` incl. the two `$queryRaw` PERCENTILE_CONT aggregations + the conditional 2 `event.findMany(distinct)` + JS set-intersection + StatCard/FunnelTable/TimeToCard), as `ActivationTab({ mode, agency })`. `<h1>` dropped.
- `components/command/growth/tabs/EngagementTab.tsx` *(new)* — the `?view=` strip + lazy gate; imports the two views below.
- `components/command/growth/tabs/engagement/FeaturesView.tsx` *(new)* — verbatim `/command/followup-usage`: league table **and** the full per-feature detail drill-down (`?feature=`), with the single `href()` base repointed from `/command/followup-usage` to `/command/growth?tab=engagement&view=features` so every surface pill / period+sort chip / drill-down + back link stays in-tab. `getFeatureUsage` **or** `getFeatureDetail` runs (mutually exclusive). League `<h1>` dropped; the drill-down keeps its feature-name heading + back link.
- `components/command/growth/tabs/engagement/AdoptionView.tsx` *(new)* — verbatim `/command/adoption`: `getPortalAdoption` + 2 `prisma.user` reads + the expandable `AdoptionTable` (client component, rendered unchanged) + all sub-components. `<h1>` dropped.
- `app/command/(protected)/growth/page.tsx` — `TABS` now `[trends, acquisition, activation, engagement, retention]` (IA order); searchParams extended with `surface/sort/feature`; renders `ActivationTab` + `EngagementTab` gated by `active === key`, threading the feature params to Engagement.
- `__tests__/command/growth-consolidation.test.ts` — +9 tests (22 total): five built tabs, lazy gating, Activation loaders, Engagement views, Features league+detail+repointed links, feature-detail drill-down + back link, Adoption table preserved, legacy pages preserved, and the URL-parameter audit (below).

**Parity:** all three dashboards verbatim. Deviations: each tab's own `<h1>` dropped (shell + strips label them — same as Phases 1-2); and **one render-identical HTML-entity escape** in AdoptionView's "By agency" tooltip (`agencies'`/`don't` → `&apos;`) — the legacy `/command/adoption` carries that string as a literal apostrophe, a **pre-existing grandfathered `react/no-unescaped-entities` error** (confirmed: the legacy page fails that lint rule too; CI only greps em-dashes so it shipped). Escaping keeps the new file lint-clean with identical rendered output; the legacy page is left as-is.

**Checks:** `tsc` 0 · ESLint 0 errors (pre-existing `no-command-import-outside` warnings only) · jest 69/69 (22 Growth). **Runtime unverified** (no CC creds/app).

### Cost: before vs after (per-visit, 10× / 100×)
- **Activation view:** `getGrowthDashboard` is NOT used here — Activation runs its own 7-read `Promise.all` (2 `dailyMetric.findMany`×30d + 2×60d + `agency.findMany` cohort + **2 `$queryRaw` PERCENTILE_CONT** over `Event` joins) + a conditional 2 `event.findMany(distinct)` + JS set-intersection. **No PostHog, no external.** Identical to the old `/command/activation`. These raw percentile aggregations are the most expensive queries in the tab — unchanged by consolidation, and only run when the Activation tab is active.
- **Engagement → Features:** exactly one of `getFeatureUsage` (league) or `getFeatureDetail` (drill-down) per request — same as the old page's early-return branch. No PostHog.
- **Engagement → Adoption:** `getPortalAdoption` + 2 `prisma.user` reads; the `AdoptionTable` expansion is client-side (no server round-trip). No PostHog.
- **Switching:** only the active tab + active Engagement view's loaders run (`active === key &&`). Features and Adoption never load together; Activation's percentile queries never run unless Activation is active. Identical to navigating to the old standalone pages.
- **Difference:** effectively zero per view. No polling/auto-refresh/new caching/new PostHog introduced.
- **10× / 100×:** linear with visits, same slope as today. The expensive Activation percentile queries scale with Activation-tab visits only — no amplification from consolidation.

### URL-parameter audit (Phases 1-3) — findings
- **Tab switches preserve scope, drop view-state (by design):** the shell `hrefFor` carries only `mode`/`agency`. View-specific params (`view/period/tier/range/surface/sort/feature`) are deliberately NOT propagated across top tabs, so a Features drill-down or an Acquisition sub-view never bleeds into another tab.
- **Unrelated params can't alter the destination view:** every tab/view parser validates against its own allowed set and defaults safely — `AcquisitionTab` (`? view : "website"`), `EngagementTab` (`? view : "features"`), the feature `period`/`surface`/`sort` parsers, the shell `tab` parser. A stale `?view=website` arriving on Engagement resolves to `features`; a stale `?view=features` on Acquisition resolves to `website`. No cross-tab bleed.
- **Feature-detail links resolve in-workspace:** the drill-down link `href(base, { feature: f.id })` → `/command/growth?tab=engagement&view=features&feature=<id>` (+ preserved scope/period/surface/sort); the shell threads `sp.feature` to `FeaturesView`, whose `if (feature)` branch renders the detail; the back link clears `feature` to return to the league. Verified by tests.
- **Collisions checked:** `period` is used by both Acquisition→Website and Engagement→Features with different value sets, and `view` by both Acquisition and Engagement — but only one tab/view renders per request and each parser is independent, so there is no collision. **Outstanding for Phase 4:** `enquiries-chase`'s own `?tab=` (see §11a) — the one real collision, handled by the documented `has`-capture redirect.
- **No navigation regressions found** in the three built tabs.

## 11d. Phase 4 — DONE (implemented, uncommitted, held for review)

Experiments tab with two secondary views (Tests + Chasing). **Write-capable; no server action modified.** Legacy routes untouched; **no redirects activated, no sidebar change** (both are Phase 5A). Prospects/AI-Outreach/Timeframes untouched.

**Write-path trace (pre-implementation, functional preservation):**
- **Tests** write UI → existing actions in `app/actions/command-centre.ts`, all with superadmin guards + `revalidatePath("/command/experiments")`: `ExperimentSuggestions` (`generateAiExperimentIdeasAction` [AI, returns ideas] + `createExperimentFromSuggestionAction` → `router.refresh()`), `NewExperimentForm` (`createManualExperimentAction`, validation `A name and a hypothesis are both required.` → `router.refresh()`), `ProposedHypothesisEditor` (`updateExperimentHypothesisAction`, validation `The hypothesis can't be empty.` → `router.refresh()`), `ExperimentActions` (`start`/`conclude`/`abandonExperimentAction` via `startTransition` → server-action auto-revalidate).
- **Chasing** write UI → `ChaseHubTable` (`getChaseDetailAction` read drawer, guard `redirect("/dashboard")`; `ChaseRepliedToggle` → `setChaseRepliedByEmailAction`, optimistic local state + revert-on-failure + `revalidatePath("/command/enquiries-chase")`); `OptedOutTable` is a **read-only server component** (no writes — the opt-out itself happens in the portal).
- **Every post-action path refreshes the CURRENT route** (`router.refresh()` / server-action auto-revalidate / optimistic state) — none navigate to a hardcoded legacy path. So on the canonical route they refresh `/command/growth`; the actions' legacy `revalidatePath` targets are harmless no-ops there and still correctly serve the live legacy pages. **Conclusion: no action needs modification** (your #4).

**Changed**
- `components/command/growth/tabs/ExperimentsTab.tsx` *(new)* — `?view=tests|chasing` strip + lazy gate.
- `components/command/growth/tabs/experiments/TestsView.tsx` *(new)* — verbatim `/command/experiments` (all four write components + loaders + helpers). `<h1>` dropped.
- `components/command/growth/tabs/experiments/ChasingView.tsx` *(new)* — verbatim `/command/enquiries-chase` (4 sub-views, `ChaseHubTable`, `OptedOutTable`, loaders), with the sub-view selector moved from `?tab=` to **`?chase=`**. `<h1>`/eyebrow + the page's `max-w-6xl mx-auto px-6 py-8` wrapper dropped (the shell + Experiments strip label + contain it).
- `lib/growth-chasing-compat.ts` *(new, inert)* — `mapLegacyChaseUrl()` reference mapping (NOT imported by next.config).
- `app/command/(protected)/growth/page.tsx` — `experiments` added to `TABS` (last); searchParams + `chase`; renders `ExperimentsTab` gated by `active === "experiments"`.
- `__tests__/command/growth-consolidation.test.ts` — +13 (35 total).

**Parity:** both pages verbatim. Deviations (relocation only): each page `<h1>` dropped; ChasingView's `?tab=`→`?chase=` sub-view param (the required collision fix); ChasingView's outer `max-w-6xl mx-auto px-6 py-8` page padding dropped to sit in the shell container like every other tab.

**Checks:** `tsc` 0 · ESLint 0 errors (pre-existing `no-command-import-outside` warnings only) · jest 82/82 (35 Growth). **Static tests do NOT prove the write actions work** — see Verification below.

### Cost: before vs after
- **Tests view:** `experiment.findMany` + `getExperimentSuggestions` (identical to `/command/experiments`). No PostHog.
- **Chasing view:** `getChaseTabCounts` + `getOptedOutCount`, then per-sub-view `getChasingData(tab)` **or** `getOptedOutClients` (identical to `/command/enquiries-chase`). No PostHog.
- Tests and Chasing never load together (`view === key &&`). No polling/auto-refresh/new caching/new external calls. Difference ≈ zero per view; linear at 10×/100×, same slope as today.

### enquiries-chase `?tab=` → `?chase=` backward-compat — mapping (prepared, NOT activated)
`mapLegacyChaseUrl` (the oracle; tests assert all of these):
| Legacy URL | Canonical |
|---|---|
| `/command/enquiries-chase` (default) | `/command/growth?tab=experiments&view=chasing` |
| `…?tab=enquiries` | `…?tab=experiments&view=chasing` |
| `…?tab=solicitor` | `…&chase=solicitor` |
| `…?tab=client` | `…&chase=client` |
| `…?tab=opted_out` | `…&chase=opted_out` |
| `…?tab=garbage` (invalid) | `…?tab=experiments&view=chasing` (default) |
| `…?foo=bar` | `…&foo=bar` (unrelated forwarded) |
| `…?tab=solicitor&foo=bar` | `…&chase=solicitor&foo=bar` |

The output **always** carries `tab=experiments` — the legacy `tab` value can never overwrite the workspace tab. **Phase-5A config to paste** (one `has`-capture entry consumes `tab` via `:v` so Next does not re-forward it, plus a bare fallback):
```ts
{ source: "/command/enquiries-chase",
  has: [{ type: "query", key: "tab", value: "(?<v>solicitor|client|opted_out)" }],
  destination: "/command/growth?tab=experiments&view=chasing&chase=:v", permanent: false },
{ source: "/command/enquiries-chase", destination: "/command/growth?tab=experiments&view=chasing", permanent: false },
```
**Still requires RUNTIME verification (Phase 5A):** that these `has` entries in a running Next app produce exactly the URLs above (especially that the matched `tab` is consumed, not re-appended). Not relying on query-forwarding assumptions — the design explicitly consumes `tab` via `:v`.

## 11e. Phase 5A — DONE (implemented, uncommitted, held for review)

Sidebar collapse + legacy redirects (`permanent: false`) + deep-link repoints. **No legacy page deleted, no server action changed, Content redirects untouched.**

**Changed**
- `lib/growth-redirects.ts` *(new)* — `GROWTH_REDIRECTS` (9 entries: 7 simple + the enquiries-chase `has`-capture + bare fallback), `permanent:false`. Pure data, in `lib/` (not `lib/command/`).
- `next.config.ts` — `import { GROWTH_REDIRECTS }` + `...GROWTH_REDIRECTS` spread **after** the untouched `...CONTENT_REDIRECTS`.
- `components/command/workspace-nav.ts` — Growth section 12 → 4 (`Growth`, `Prospects`, `AI Outreach`, `Timeframes`); pruned 7 now-unused icons (`Zap`/`RefreshCw`/`FlaskConical`/`MailCheck`/`Smartphone`/`BarChart3`/`Globe`).
- `app/command/(protected)/growth/page.tsx` — hardened `tab` resolution: `Array.isArray(sp.tab) ? sp.tab[0] : sp.tab` (a forwarded legacy `tab` can never beat the destination's `experiments`, which is always first).
- `components/command/growth/tabs/TrendsTab.tsx` — the "Go to Getting started" cross-link `/command/activation` → `/command/growth?tab=activation` (single hop).
- `app/command/(protected)/overview/page.tsx` + `components/command/insights/SignalActions.tsx` — the two `/command/experiments` deep links → `/command/growth?tab=experiments&view=tests`.
- `__tests__/command/growth-consolidation.test.ts` — +9 (44 total); `e2e/surface-command-growth-redirects.spec.ts` *(new, runtime, UNRUN)*.

**Sidebar coverage confirmed before removal:** each of the 9 retired dashboards is a built tab/view — growth→Trends, website-growth→Acquisition/Website, chain-invites→Acquisition/Invites, activation→Activation, followup-usage→Engagement/Features, adoption→Engagement/Adoption, retention→Retention, experiments→Experiments/Tests, enquiries-chase→Experiments/Chasing. Kept standalone: Prospects, AI Outreach, Timeframes.

**NOT redirected:** `/command/growth` (the workspace), `/command/prospects`, `/command/ai-outreach`, `/command/timeframes`.

**Checks:** `tsc` 0 · ESLint 0 errors · jest 91/91 (44 Growth).

### Redirect matrix
| Legacy URL | Canonical destination | Params preserved/transformed | Test evidence | Runtime status |
|---|---|---|---|---|
| `/command/website-growth` | `…?tab=acquisition&view=website` | `period`,`tier` forwarded (Next) | static map ✓ | e2e UNRUN |
| `/command/chain-invites` | `…?tab=acquisition&view=invites` | `range` forwarded | static map ✓ | e2e UNRUN |
| `/command/activation` | `…?tab=activation` | `mode`,`agency` forwarded | static map ✓ | e2e UNRUN |
| `/command/followup-usage` | `…?tab=engagement&view=features` | `mode`,`agency`,`period`,`surface`,`sort`,**`feature`** forwarded | static map ✓ | e2e UNRUN |
| `/command/adoption` | `…?tab=engagement&view=adoption` | (none) | static map ✓ | e2e UNRUN |
| `/command/retention` | `…?tab=retention` | `mode`,`agency` forwarded | static map ✓ | e2e UNRUN |
| `/command/experiments` | `…?tab=experiments&view=tests` | (none) | static map ✓ | e2e UNRUN |
| `/command/enquiries-chase` | `…?tab=experiments&view=chasing` | default/enquiries/invalid | static map ✓ | e2e UNRUN |
| `/command/enquiries-chase?tab=solicitor\|client\|opted_out` | `…?tab=experiments&view=chasing&chase=<v>` | legacy `tab` → `chase` (consumed via `:v`) | static map + `has` structure ✓ | **e2e UNRUN — the key one** |

**`tab` overwrite guarantee:** two independent layers — (1) the `has`-capture references `:v`, which consumes the legacy `tab` so Next does not re-forward it; (2) even if it were forwarded, the shell coerces a duplicated `tab` to its first value, which is always the destination's `experiments`. So `tab=experiments` cannot be overwritten. Layer 1 (the `:v` consume) is the part that **still needs runtime confirmation** — the e2e spec asserts `searchParams` + that the Chasing view actually renders.

### Internal links updated
- `overview/page.tsx:835`, `insights/SignalActions.tsx:40` → canonical Experiments/Tests. `TrendsTab` cross-link → canonical Activation. **Left (classified):** `command-centre.ts` revalidatePath ×8 (req 4 — see §11f); legacy pages' own internal links (retire in 5B); `components/command/TabNav.tsx` (orphaned legacy whole-CC tab bar, **zero importers** — dead; recommend separate deletion, not touched).

## 11f. revalidatePath — NOT proven equivalent; write workflows needing runtime verification

`app/actions/command-centre.ts` is **unchanged** (per Phase 5A req 4). Its writes still `revalidatePath("/command/experiments")` / `("/command/enquiries-chase")` — the **legacy** paths. On the canonical `/command/growth` route these are **not demonstrated equivalent** to canonical-route revalidation: the UI refresh on the workspace is expected to come from the components' own `router.refresh()` / server-action auto-revalidation of the *current* route, **not** from these `revalidatePath` calls (which target a different path). This is **plausible but UNVERIFIED** — do not describe the legacy `revalidatePath` targets as definitively harmless until a running app demonstrates the canonical route refreshes after each write. Keeping them also correctly serves the still-live legacy pages.

**Write workflows requiring an authenticated runtime run before Phase 5B:**
1. Create experiment from AI suggestion (`createExperimentFromSuggestionAction` → `router.refresh`).
2. Create manual experiment (`createManualExperimentAction`, incl. the name/hypothesis validation throw).
3. Edit proposed hypothesis (`updateExperimentHypothesisAction`, incl. empty-throw).
4. Start / Conclude / Abandon experiment (`ExperimentActions` via `startTransition` — auto-revalidate).
5. Generate AI experiment ideas (`generateAiExperimentIdeasAction`).
6. Chase "email reply" toggle (`setChaseRepliedByEmailAction` — optimistic; confirm persistence + no stale read).
7. Chase detail drawer (`getChaseDetailAction` — read + superadmin guard).
Each must be exercised on `/command/growth?tab=experiments&view=…` to confirm the mutation runs AND the workspace UI reflects it.

## 11g. Phase 5B — DONE (implemented, uncommitted)

Legacy pages retired; `revalidatePath` repointed. Redirects kept.

**Changed**
- **Deleted** the 8 retired legacy pages + dirs: `app/command/(protected)/{website-growth,chain-invites,activation,adoption,followup-usage,retention,experiments,enquiries-chase}/page.tsx`. (The `/command/growth` shell + `prospects`/`ai-outreach`/`timeframes` remain.) Confirmed no module imports them (routes only) and each is fully represented in the workspace before deletion.
- **`app/actions/command-centre.ts`** — repointed `revalidatePath` from the retired `/command/experiments` (×7) and `/command/enquiries-chase` (×1) to the canonical **`/command/growth`**. **Only the revalidatePath path strings changed** — guards, mutations, validation throws, redirects all untouched.
- `components/command/growth/tabs/experiments/TestsView.tsx` — comment updated to reflect the repoint.
- `GROWTH_REDIRECTS` kept (`permanent: false`) — now the sole server for the retired paths.
- Tests updated: the four "legacy page operational" assertions → "retired + redirect still maps it"; the shared-actions test → asserts revalidatePath now canonical.

**Checks:** `tsc` 0 (after clearing the stale generated `.next/dev/types/validator.ts`) · ESLint 0 errors (pre-existing command-import warnings only) · jest 91/91.
**Browser smoke test:** NOT run — no server on :3000; the live :3001 server is the concurrent session's and predates the redirect edit (so redirects aren't active there), and no isolated staging server was stood up (per the "don't build test infra" directive). Documented, moved on.

**Still outstanding (unchanged from §11f — now lower urgency, legacy pages gone):** authenticated runtime confirmation that the canonical route refreshes after each write and that the enquiries-chase `has`-capture resolves. The write actions are unchanged bar the revalidatePath target; the components also `router.refresh()` the current route, so the canonical refresh is expected. Verify opportunistically on staging when convenient.

## 11. Risks
- **Cost regression if lazy loading is missed** — the dashboards are heavy; the per-tab gate is mandatory (§6).
- **Write-path group (experiments/enquiries-chase)** — highest-care phase; parity-verify the `ExperimentActions`/`NewExperimentForm`/`ProposedHypothesisEditor`/`OptedOutTable` flows before retiring pages.
- **`enquiries-chase` param rename** — the only required behaviour-preserving URL change; its inbound links (none found beyond sidebar) and its own internal links must move together.
- **Deferred revalidatePath drift** — same documented, harmless no-op situation as Content.
- **Runtime verification** — needs CC credentials + a running app (Playwright), unavailable here; must be founder-run, as in Content.
