# TSP Admin — Content workspace consolidation (implementation plan)

**Status:** plan for review. **Not implemented.** No code until approved.

**Date:** 2026-11-20. Grounded against current HEAD (13 content routes mapped fresh).
**Reads with:** [`00-AUDIT-AND-ARCHITECTURE.md`](00-AUDIT-AND-ARCHITECTURE.md) §B, and the account consolidations [`03`](03-CUSTOMER-ACCOUNT-WORKSPACE.md)/[`04`](04-PROGRESSION-COMPANY-WORKSPACE.md) (same in-place `?tab=` pattern).

---

## 1. Current state (what we're consolidating)

**13 routes** under `app/command/(protected)/content/**`, superadmin-only. The sidebar lists **10** of them as flat items; `topics`, `voice`, `engagement/[draftId]` are reached only via in-page links. They form **two clusters**:

- **Newer "SPEC" set:** overview · inbox · opportunities · strategy · create · calendar · performance · thoughts · brand
- **Older drafter cluster:** drafts ↔ topics ↔ voice ↔ engagement

Everything is pure personal brand/content tooling (self-contained — nothing outside `lib/command/content/*` + `app/actions/{content,brand,ellis,voice}-*` depends on it). It's the cleanest, lowest-risk consolidation in the workspace.

---

## 2. Recommended information architecture

Grounded in how the tools actually chain (capture → create → plan → measure, with brand/voice as guardrails), not forced into a fixed count. The provisional five hold up, **plus** an Overview landing — so **one `/command/content` route with a `?tab=` strip, 6 tabs** (down from 10 sidebar items / 13 routes):

| Tab (default **Overview**) | Folds in | Why |
|---|---|---|
| **Overview** *(default)* | `content` (overview) | At-a-glance KPIs + "worth saying now" + Create CTA — the workspace home. |
| **Ideas** | `inbox` + `opportunities` + `thoughts` + `topics` | Every *input to a post* in one place. All four feed Create; today they're four separate destinations. (Distinct models — `ContentInboxItem`/`BrandOpportunity`/`EllisThought`/`ContentTopic` — shown as sub-sections, not merged.) |
| **Create** | `create` + `drafts` (+ image studio) | Turn an input into a draft and manage the draft queue/history/images. **Both drafters kept** (`CreateFlow`/`Composer` via `/compose`, and `DraftComposer` via `/generate`) — different sub-views, no logic merge. |
| **Plan** | `calendar` | Pipeline ready→published, weekly plan, autopilot, publishing connections. |
| **Measure** | `performance` | Published results + by-pillar + UTM tagger. |
| **Brand** | `brand` + `strategy` + `voice` | The guardrails/identity: positioning, brand memory, quarter focus, pillar balance, AI brand review, and voice training. |

**Stays a separate route (not a tab):**
- `engagement/[draftId]` — a per-record drill-down (log metrics for one posted draft); linked from Measure/Create's draft history. It can't be a tab.
- `/think` (`app/think/page.tsx`) — a standalone, bookmarkable quick-capture outside `/command/content`; unaffected.

**Judgment calls to confirm (I can move either):**
- **Opportunities → Ideas** (it feeds Create like the other inputs) rather than Brand. If you think of it as reputation *strategy*, it could sit under Brand instead.
- **Voice → Brand** (identity: "how we sound") rather than Create. The drafter's first-run voice gate would link across to Brand → Voice.
- **Overview as the default tab** (6 tabs). If you want exactly five, its KPIs can head the Ideas tab instead.

**Nothing is retired as a feature.** Both drafters stay wired; `FloatingThoughtCapture.tsx` is already orphaned (not mounted) and is out of scope. Legacy *routes* become redirects (see §4), not deletions-of-capability.

---

## 3. How it looks & behaves

- **One nav entry** ("Content") → opens `/command/content` on the Overview tab. The sidebar's 10 content items collapse to this single entry (the global `ThoughtQuickCapture` stays in the sidebar, unchanged).
- **`ParamTabs`** (the established CC primitive — already used by the agency/business accounts, trials, website-growth, timeframes) renders the tab strip; `hrefFor(key)` → `/command/content?tab=key`. Reuses the exact dark CC look; `ParamTabs` is `flex-wrap`, so the strip wraps cleanly on mobile (the sidebar is already an off-canvas drawer on mobile).
- **Per-tab server rendering, lazy loaders** (the account pattern): the route reads `?tab=` and renders only the active tab's component, which calls only that tab's existing loaders — no slower than today, and the AI tabs keep `maxDuration = 60`.
- **Each tab body is an extracted component** (`components/command/content/tabs/{Overview,Ideas,Create,Plan,Measure,Brand}Tab.tsx`) — i.e. the current page bodies move almost verbatim into tab components the route composes. Keeps the code modular (mirrors today's per-page files), minimises churn, preserves every component/loader/action.
- **Existing in-tab tabbing stays** (e.g. `InboxList`/`ThoughtsPanel`/`OpportunitiesList` fresh/saved lanes via local state) — the Ideas tab shows these as sections; no change to those components.
- **Gating preserved exactly:** Create's whole-page `aiEnabled` gate, strategy/calendar/voice section gates, performance's PostHog gate — all move with their bodies.

---

## 4. Route migration map

Canonical route becomes `/command/content?tab=…`. Legacy URLs must keep working (cron emails + seed links hard-code them), so they **redirect**, not 404:

| Legacy route | New location | Redirect? |
|---|---|---|
| `/command/content` | `?tab=overview` (default) | — (unchanged URL) |
| `/command/content/inbox` | `?tab=ideas` | 301/308 |
| `/command/content/opportunities` | `?tab=ideas` | 301/308 |
| `/command/content/thoughts` | `?tab=ideas` | 301/308 |
| `/command/content/topics` | `?tab=ideas` | 301/308 |
| `/command/content/create` | `?tab=create` (**preserve `?item=`/`?opp=`/`?thought=`**) | 308 (keeps query) |
| `/command/content/drafts` | `?tab=create` | 301/308 |
| `/command/content/calendar` | `?tab=plan` | 301/308 |
| `/command/content/performance` | `?tab=measure` | 301/308 |
| `/command/content/strategy` | `?tab=brand` | 301/308 |
| `/command/content/brand` | `?tab=brand` | 301/308 |
| `/command/content/voice` | `?tab=brand` | 301/308 |
| `/command/content/engagement/[draftId]` | unchanged (separate drill-down) | — |

**Deep links / externals that must keep resolving (verified):**
- **Create seed params:** the Create tab must read `?item=`, `?opp=`, `?thought=` (fold `create/page.tsx`'s seeding into the Create tab). In-app links (`InboxList`, `OpportunitiesList`, overview, `WeeklyPlanPanel`) point to `create?item=/opp=` → their redirect must carry the query. *(Flag: `?thought=` is supported in code but no current UI emits it — confirm before relying on it, but preserve the handler regardless.)*
- **Cron emails:** `content-batch` links to `/command/content` (fine — default tab); `content-schedule-reminder` links to `/command/content/calendar` → the redirect sends it to `?tab=plan`. Using redirects means **no cron code change is required** (lower-touch than editing the cron emails).
- **Sidebar / `workspace-nav.ts`:** collapse the 10 content items to one entry (and drop the `create`-when-`!aiOn` special-case line, since Create is a tab now — the gate still lives inside the tab).
- **`/think`** and `ThoughtQuickCapture`: untouched (separate surfaces writing `EllisThought`).

Redirects via `next.config.ts` `redirects()` (static, cheap, SEO-stable) for the fixed paths; the `create` one keeps its query. Legacy page files are retired **only after** each tab reaches parity.

---

## 5. Preservation — every write path stays wired

No business logic, data, or permissions change. Write paths that must remain (all moved verbatim with their components):
- **Server actions:** `content-topics`, `content-inbox`, `ellis-thoughts`, `brand`, `brand-strategy`, `brand-opportunities`, `content-settings`, `content-schedule`, `voice-samples`, `voice-learning`, `content-engagement`, `draft-posts`.
- **API routes:** `/api/command/content/{compose,generate,refine,adapt,suggest-visual,images/ai,images/text-card,images/chart}`.
- **Both drafters** (`/compose` and `/generate`) and the **drafts first-run voice gate** preserved. AI + PostHog gates preserved per tab.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Cron/bookmark/seed deep links break | Redirect every legacy route (query-preserving for `create`); verified the exact external links. No cron code change needed. |
| Create-tab seed (`?item/?opp/?thought`) regressions | Move `create/page.tsx` seeding verbatim into the Create tab; test each seed param resolves. |
| Two drafters co-located cause confusion/merge temptation | Keep them as distinct sub-views; **do not** merge `/compose` and `/generate` — both stay. |
| `maxDuration`/AI-gate loss when pages merge | Set `maxDuration = 60` on the consolidated route; move each gate with its tab body. |
| Large single refactor | Phase it (below); extract tab components one at a time behind the shell, verify parity, redirect last. |
| Concurrent design-system session on same branch | Content area is self-contained; coordinate only on `workspace-nav.ts` + `next.config.ts` edits. |

---

## 7. Phased implementation plan (reviewable slices)

1. **Shell + Overview + Ideas.** Add `?tab=` + `ParamTabs` to `/command/content`; extract `OverviewTab` (verbatim) + `IdeasTab` (inbox/opportunities/thoughts/topics as sections, reusing `InboxList`/`OpportunitiesList`/`ThoughtsPanel` + the topics forms). Legacy routes still live. Ship/verify first — proves the pattern.
2. **Create tab.** Fold `create` (seed params) + `drafts` (+ image studio) + the voice-intake gate into `CreateTab`; preserve both write paths.
3. **Plan + Measure + Brand tabs.** Move calendar / performance / (brand+strategy+voice) bodies into their tabs.
4. **Redirects + nav + cleanup.** Add `next.config.ts` redirects for all legacy routes (query-preserving for `create`); collapse the sidebar to one Content entry; once each tab's parity is verified, retire the legacy page files. `engagement/[draftId]` and `/think` stay.

Each slice: full `tsc`, ESLint, command tests, and a per-tab parity check (same loaders/components/write paths, deep links resolve). Authenticated visual/keyboard verification on staging by you.

---

## 8. Open questions for you
1. **Opportunities** in **Ideas** (my recommendation — it feeds Create) or **Brand** (if it reads as reputation strategy)?
2. **Voice** in **Brand** (my recommendation) or **Create** (drafting setup)?
3. **Overview** as a 6th default tab (my recommendation) or folded into Ideas for exactly five?
4. Confirm **redirects** (keep legacy URLs alive) over editing cron-email links — lower-touch, nothing else changes.

---

## 9. Phase-4 record — legacy routes, redirects & links to resolve

Captured during Phases 1–3 (all implemented; legacy routes left operational). Phase 4 resolves these together.

### A. Legacy route → canonical tab (add `next.config.ts` redirects)
| Legacy route | Redirect target |
|---|---|
| `/command/content/inbox` | `/command/content?tab=ideas&source=inbox` |
| `/command/content/opportunities` | `/command/content?tab=ideas&source=opportunities` |
| `/command/content/thoughts` | `/command/content?tab=ideas&source=thoughts` |
| `/command/content/topics` | `/command/content?tab=ideas&source=topics` |
| `/command/content/create` | `/command/content?tab=create&build=new` **(preserve `?item`/`?opp`/`?thought`)** |
| `/command/content/drafts` | `/command/content?tab=create&build=drafts` |
| `/command/content/calendar` | `/command/content?tab=plan` |
| `/command/content/performance` | `/command/content?tab=measure` |
| `/command/content/strategy` | `/command/content?tab=brand&view=strategy` |
| `/command/content/brand` | `/command/content?tab=brand&view=positioning` |
| `/command/content/voice` | `/command/content?tab=brand&view=voice` |
| `/command/content/engagement/[draftId]` | **keep as-is** (drill-down; not a tab) |

### B. Cross-surface links still pointing at legacy routes (resolved by the redirects above — no code change needed, but listed for awareness)
- **Shared components (deliberately NOT edited):** `InboxList` + `OpportunitiesList` "draft this" buttons push to `/command/content/create?item=` / `?opp=` → redirect routes them into the Create tab. (Editing them would change behaviour on any other consumer — left for Phase 4 to decide: redirect-only, or update the push targets.)
- **Shared server actions (deliberately NOT edited):** `VoiceIntakePanel`'s `saveVoiceSamplesAction` redirects to `/command/content/drafts?error=` (first-run gate); `addVoiceSampleAction` redirects to `/command/content/voice?error=` → both land via redirect on the right tab.
- **Cron emails:** `content-batch` → `/command/content` (fine — default tab); `content-schedule-reminder` → `/command/content/calendar` → redirect sends to `?tab=plan`. (No cron code change required.)
- **`DraftComposer`** (shared) links to `/command/content/topics` → redirect routes to Ideas → Topics.
- **Workspace nav (`workspace-nav.ts`):** still lists the 10 content routes as flat items → Phase 4 collapses to a single "Content" entry, and drops the `create`-when-`!aiOn` special case (the gate now lives inside the Create → New view).

### C. Links already repointed into the workspace (done in Phases 1–3, in my new tab files only)
- Overview KPIs/CTA → `?tab=ideas&source=…`, `?tab=create&build=new|drafts`, worth-saying cards → `?tab=create&build=new&item=`.
- Create → Drafts "Topic queue →" → `?tab=ideas&source=topics`; "Voice samples →" → `?tab=brand&view=voice`.
- Measure "Log results →" → `/command/content/engagement/[id]` (intentionally kept — the engagement drill-down stays a separate route).

### D. `/think` + global `ThoughtQuickCapture`
Separate surfaces that write `EllisThought`; unaffected by consolidation — no change needed.

---

## 10. Phase 4A — DONE (implemented, uncommitted, held for review)

Implemented the redirects + sidebar collapse; **legacy page files kept in place** (not retired — that is Phase 4B).

**Files changed**
- `lib/content-redirects.ts` *(new)* — pure data: the 11-row `CONTENT_REDIRECTS` table (A above), `permanent:false` (302, reversible). Placed in `lib/` not `lib/command/` so `next.config.ts` can import it without the `no-command-import-outside` lint rule.
- `next.config.ts` — `import { CONTENT_REDIRECTS }` + `...CONTENT_REDIRECTS` spread into the existing `redirects()` array.
- `components/command/workspace-nav.ts` — Content section collapsed from 10 items to one (`/command/content`, `PenLine`, `exact:true`); removed the now-unused `Compass`/`Sparkle`/`CalendarDays`/`Fingerprint` icon imports.
- `__tests__/command/content-consolidation.test.ts` *(new)* — 14 regression tests (map lock, 302s, no-collision, preserved engagement/`/think`, seed threading, error display, tab/view strips, single sidebar entry).

**Route safety (verified)** — Next evaluates config `redirects()` **before** filesystem routes, so each redirect shadows the still-present legacy page without deletion (same mechanism as the repo's `/agent/settings`). Existing redirects are `/agent/*` only → no conflict. Next forwards the request query onto the destination; legacy routes carry only `item`/`opp`/`thought`/`error`, none of which collide with `tab`/`source`/`build`/`view` → seeds + errors preserved and merged, and the destination views read + display them (Brand → Voice `error==="empty"`; Create → Drafts → `VoiceIntakePanel error`). Double-hop for the two shared voice actions (action → legacy URL → config redirect → canonical view) — acceptable; can be made single-hop in 4B by repointing the actions.

**Checks:** `tsc` 0 · ESLint 0 · jest 44/44 (9 suites). Outstanding: authenticated visual/functional run (no CC credentials; not bypassed).

## 11. Phase 4B — DONE (implemented, uncommitted, held for review)

Pre-deletion parity verified page-by-page: all 11 legacy bodies (loaders, components, serialisers, server actions, AI/PostHog gates, the engagement drill-down link) are reproduced in the tabs; only the per-page `<h1>` + "← back" chrome was dropped (the shell + tab strips replace it). No unique behaviour, metadata (none existed) or route config (shell carries `force-dynamic` + `maxDuration=60`, a superset) is lost.

**Changed**
- **Deleted** the 11 legacy `app/command/(protected)/content/{inbox,opportunities,thoughts,topics,create,drafts,calendar,performance,strategy,brand,voice}/page.tsx` (+ their emptied dirs). `engagement/[draftId]/page.tsx` and the canonical `page.tsx` remain. The `next.config` redirects now serve those paths.
- **Redirects kept `permanent:false`** — NOT promoted to 301/308 (founder decision).
- **Repointed the 4 navigation redirects to canonical** (only these): `app/actions/voice-samples.ts` ×3 (`saveVoiceSamplesAction` → `?tab=create&build=drafts[&error=empty]`; `addVoiceSampleAction` empty → `?tab=brand&view=voice&error=empty`); `app/actions/content-engagement.ts` ×1 (`→ ?tab=create&build=drafts`).
- **Removed the dead sidebar AI-gate** (`CommandSidebar.tsx`: the `/command/content/create && !aiOn` conditional) plus its now-orphaned `aiOn` prop (sidebar signature + the single caller arg in `app/command/(protected)/layout.tsx`). `aiOn` stays in the layout for `AiEnabledProvider` (unaffected). **Gate preservation confirmed first:** Create → New view enforces `aiEnabled()` itself (empty state → Settings); the single Content nav entry correctly shows regardless of AI.
- **Tests:** extended `__tests__/command/content-consolidation.test.ts` (14 → 17) with a static lock that the 4 redirects are canonical and the sidebar conditional is gone; added **runtime** `e2e/surface-command-content-redirects.spec.ts` (redirect firing, query-forward, voice error round-trip, engagement-not-redirected, single sidebar entry).

**Checks:** `tsc` 0 (after clearing a stale Next-generated `.next/dev/types/validator.ts` that still listed the deleted `voice/page.js` — regenerates on next `next dev`/`build`) · ESLint 0 errors (4 pre-existing `no-command-import-outside` warnings on untouched `commandDb` imports) · jest 47/47.
**Unverified (runtime):** the Playwright spec was NOT run here — no CC credentials + no running app. Must be run locally (`.env.test` + app) to confirm the redirects fire, query-forwarding merges, and the voice error renders. Also still-unverified: authenticated visual pass across the six tabs.

### Deferred cleanup (documented, NOT done — separate concern, needs its own go-ahead)
- **~29 `revalidatePath("/command/content/<legacy>")` calls** across 11 action files (`brand-opportunities`, `brand-strategy`, `brand`, `content-inbox`, `content-schedule`, `content-settings`, `content-topics`, `draft-posts`, `ellis-thoughts`, `voice-learning`, **and `voice-samples` own 3 at lines 54/65/66**) still name legacy paths. All are **harmless no-ops** post-deletion: the canonical page is `force-dynamic` (no server cache to purge) and Next re-renders the current route after each action, so UI updates regardless. Repoint to `/command/content` in a future tidy. (Per founder scope, `voice-samples`' redirects were repointed but its `revalidatePath` calls were left with the rest.)
- **`components/command/TabNav.tsx`** — already orphaned (zero importers), unrelated to consolidation; delete as a separate decision.
- **Cron email link** `content-schedule-reminder` → `/command/content/calendar` left as-is (already-sent emails depend on the redirect; a reason the redirects must stay).
- **Shared push targets** (`InboxList`/`OpportunitiesList` → `…/create?item|opp=`, `DraftComposer` → `…/topics`) left to the redirects; optional single-hop repoint later.

### Phase 4B worklist (SUPERSEDED by §11 — retained for history)
- Retire the 11 legacy `/command/content/*` page files (and `TabNav`/other dead content chrome) once each tab is parity-verified.
- Promote the redirects 302 → 301 once proven.
- Remove the dead `if (href === "/command/content/create" && !aiOn) return null;` line at `components/command/CommandSidebar.tsx:285` (no longer a nav item → never matches; harmless until then).
- Decide: repoint the shared `InboxList`/`OpportunitiesList`/`DraftComposer` push targets and the two voice actions to canonical URLs (single-hop), or leave the redirect to carry them.
