# Command Centre + Admin audit — 2026-08-13

**Purpose.** Ground the "redo the admin + control panel" work in facts, not memory. What actually exists today, what works, what's dead, where the jargon is, and which of the founder's wishlist items the data already supports.

**Method.** Three read-only investigations in parallel (no DB writes, no code changes): (1) every Command Centre screen, (2) the `/admin` area + the "Content" subsystem, (3) each wishlist item vs. the real data model. Findings below are conclusions with `file:line` evidence; the founder is pre-launch (~5 test users), so many analytics panels are *empty*, not *fake*.

---

## The three headline problems

1. **Jargon.** Almost every Command Centre screen is genuinely wired to live data — but the labels and content are written for a growth analyst / SRE, not a founder. "Activation", "Retention", "Friction", "Signal / detector / promote to experiment", "p50/p75/p90", raw event slugs and CUIDs on screen. The founder has said he doesn't know what half of it is.
2. **Dead + hollow surfaces.** Two screens are pure "coming soon" stubs (Friction, Automations). Several more are real in code but hollow in practice (Health monitors ~4% of crons; Experiments has no "create" form; Content's AI-image tab is inert without an API token; the whole Content pipeline was never run so its "smart" parts never had data).
3. **The admin area is thin and the operational visibility the founder actually wants isn't built** — even though most of the *data* for it already exists.

---

## Part 1 — Command Centre, screen by screen

17 screens under `/command/(protected)/`, gated to superadmin (hybrid-superadmin skips 2FA; true superadmin needs TOTP + step-up). Nav in `components/command/CommandSidebar.tsx`.

| # | Screen (nav label) | What it does | State | Jargon |
|---|---|---|---|---|
| 1 | Overview | 7-day platform health cards, activity pulse, stuck files, SP/PM split, signal health | **Works** (live) | High |
| 2 | Insights | Latest AI daily brief + weekly review, filterable "signal feed", acknowledge / promote-to-experiment | **Works** | **Very high** (most opaque page) |
| 3 | Growth | Activation funnel, weekly trend, agency leaderboard, acquisition sources, cohort retention | **Works** | High |
| 4 | Activation | Drop-off chain, time-to-first-transaction/milestone percentiles, first-action cohorts | **Works** (raw-SQL percentiles) | **Very high** (analyst tool) |
| 5 | Retention | Engagement cards, feature-usage heatmap, session-gap percentiles, churn "last action" | **Works** | **Very high** (raw event slugs) |
| 6 | Activity | Live 7-day event feed, hour×day heatmap, top users, 30s auto-refresh | **Works** | High (engineer console) |
| 7 | Outbound | Log of every message sent/queued, full-text search, AI cost/provenance, lifecycle | **Works** (most-wired ops page) | Medium |
| 8 | Health | Cron-job health, job runs, deployment history | **Partial** — only **1 of 26 crons** writes job rows; deploy history needs a webhook | **Very high** (SRE console) |
| 9 | Experiments | A/B experiment tracker; start / conclude / abandon | **Partial** — real engine, **no "create" form** (API/promote only) | High |
| 10 | Content | AI social-post pipeline (drafts, voice, topics, images, engagement) | **Works in code, dead in practice** (see Part 3) | Medium |
| 11 | Automations (soon) | — | **Stub** — "Automation Brain not yet built" | High |
| 12 | Providers | Surveyor-firm directory clients request quotes from; add/edit firms, logos, coverage | **Works** (end to end, real uploads) | Medium ("Kind", "outward code") |
| 13 | Quote inbox | Client quote requests; mark won/lost/expired, referral-fee tracking | **Works** | Low–medium |
| 14 | Audit | Log of every Command Centre admin action | **Works** | High (raw action codes, CUIDs) |
| 15 | Friction (nav: no badge) | — | **Stub** — "coming soon", blocked on PostHog DPA; **not** badged, so looks live | Very high |
| 16 | Revenue | Money dashboard: banked/pipeline MTD, forecast, per-agency table, risks; per-agency drill-down | **Works** (most substantial real feature; £0 today = empty, not fake) | Medium |
| 17 | Reset Demo | Tear down + reseed the demo agency on staging | **Works** (real, guarded, destructive) | Medium |

### Dead / hollow, ranked
1. **Friction** — pure stub, and the only stub *not* labelled "soon", so it looks live until clicked. Worst offender.
2. **Automations** — stub, at least honestly badged.
3. **Health** — looks like full monitoring, actually watches ~4% of crons.
4. **Experiments** — real engine, no blank-slate create path.
5. **Content → AI image** — coded but inert until `REPLICATE_API_TOKEN` is set (fails on click).
6. Everything else is genuinely wired; the caveat is **emptiness** (pre-launch), not fakeness.

### Jargon — worst labels → plainer names
- **Activation** → "Getting started" · **Retention** → "Sticking around" · **Outbound** → "Messages we've sent" · **Friction** → "Where users get stuck" · **Experiments** → "Growth tests"
- Runners-up: **Health** → "System status"; **Providers** → "Surveyor firms"; the **Insights signal feed** (detector/signal/promote/confidence) is the single most opaque content and needs a plain rewrite; the schema word **"Kind"** → "Type of firm".

---

## Part 2 — The `/admin` area

Thin. Four routes, only two of them real destinations:

| Route | What | State |
|---|---|---|
| `/admin` | Agency settings for the `admin` role — agent accounts, internal fee tiers, read-only milestone + reminder tables | Works |
| `/admin/audit` | Paginated event log across the agency's files | Works |
| `/admin/migrate` | One-off tool to hand-enter historical sales; no nav link, disposable | Works, throwaway |
| `/admin/sentry-test` | Deliberately throws errors to test Sentry; no nav link, disposable | Works, throwaway |

`AppShell` (the dark internal shell) now renders on only these + the internal `/transactions/[id]` file view. Its sidebar still lists a dozen links (`/dashboard`, `/tasks`, `/analytics`, `/comms`…) but they all **redirect into the `/agent/*` app**. So `AppShell` is a near-legacy shell, and "admin" today is effectively **two config pages**. This is the headroom for the founder's "put the admin stuff into a tab, we're missing so much".

---

## Part 3 — The "Content" subsystem

Fully built (real Claude calls, real crons, real models, real component states) — **not a stub**. But it only produces value if a human runs the manual loop at every stage: log in → generate → approve → **copy-paste to socials by hand** (the "never auto-publish" rule) → hand-log engagement 14 days later. If that loop was never run, there's no engagement data, so the "smart" parts (performance signal, activity-derived follow-up topics) never had anything to act on. That's why it feels dead.

**Removal blast radius (well-isolated):**
- **Hide (nav only): zero risk, one line** — `CommandSidebar.tsx:59`. Routes become unreachable; everything still compiles. *Recommended immediate move.* (Optionally also disable the two content crons in `vercel.json:51-58`.)
- **Full removal: safe but multi-file** — 4 pages, 2 API routes, 2 crons, 4 server actions, `lib/command/content/*`, `components/command/content/*`, and **6 DB models** (`DraftPost`, `ContentBatch`, `ContentEngagement`, `VoiceSample`, `ContentTopic`, `GeneratedImage` + `DraftChannel` enum) referenced nowhere outside content code. **One mandatory cross-edit**: `lib/services/signals/index.ts:18,32` (the `contentPerformance` detector registration) or the build breaks. Needs a Prisma migration (staging-first) and a DB count to confirm no real data before dropping tables.

---

## Part 4 — Wishlist vs. reality

| # | Wish | Verdict | Why | Effort |
|---|------|---------|-----|--------|
| 1 | Properties with no photo + "dismiss forever" | **Partial** | We store whether a file has a photo (`PropertyTransaction.photoStoragePath`), so the list is a trivial scoped query. "Dismiss forever" needs one new column + a mutation. | Small |
| 2 | Search a property → time the **agent** spent on it | **Exists** | `FileTimeSession` logs real *engaged* seconds (focus-based) per user per file, live and instrumented (`/api/file-time/*` + heartbeat). Already shown on the file sidebar. **Staff-only** (portal clients are `Contact`s, never `User`s). Just needs a founder search view. | Small |
| 3 | How frequently agents use the platform | **Exists** | Every login + key action writes an `Event` row (`user_logged_in` fires in `lib/auth.ts`), plus `FileTimeSession`. Group by user over a window. No `User.lastLoginAt` column, but it derives from `Event`. | Small |
| 4 | Real time **buyers/sellers** spend on the portal | **Missing** | `PortalVisit` records which *days* a client opened the portal — never minutes. No duration tracking for token/portal sessions anywhere. Needs a new `Contact`-keyed timing table + token-auth heartbeat routes + cron (the agent file-time algorithm ports cleanly). | Medium |
| 5 | Analytics plumbing to build on | **Exists** | Nightly `rollup-metrics` cron writes `DailyMetric` + `WeeklyCohort` (per-agency, per-day). A new founder view can read these directly. | Small |

**The one asymmetry to hold onto:** agent time-on-file is fully instrumented; the client equivalent doesn't exist at all. Four of five wishes are "surface what we already collect"; only client dwell-time is a genuine build.

---

## Part 5 — Proposed direction (for discussion, not decided)

The pattern across all three findings: the Command Centre was built as an **analyst/growth console**, but the founder wants an **operator's cockpit** — "who's using it, which files need upkeep, is the client engaged, where's the money" — with the jargon and dead weight gone. Most of the data for the operator's view already exists; it's just not surfaced, and it's buried under screens built for a different reader.

A strawman for the redesigned structure (to react to, not adopt):

1. **Today** — the Overview, de-jargoned (plain metric names, drop raw SP/PM, signal-health in plain words).
2. **Agencies & agents** *(new, mostly existing data)* — who's using the platform and how often; power vs. dormant agencies; search an agent → their activity. Built on `Event` + `FileTimeSession`.
3. **Files** *(new, mostly existing data)* — search a property → time the agent has spent on it, photo status, (later) client portal engagement. The **no-photo upkeep list + dismiss-forever** lives here.
4. **Money** — Revenue + Quotes + Providers (already strong; light rename/grouping).
5. **Messages** — the Outbound log, renamed.
6. **System** — Health + Audit + Activity + Reset Demo, tucked away and renamed "System status" (the engineer surfaces, kept but out of the main flow).
7. **Hide now:** Content (dead), Friction (blocked on PostHog), Automations (not built). Fold the deep analyst pages (Activation / Retention / detailed Growth) into a single optional "Growth" area or park them until there's traffic to justify them.

**Open decisions for the founder:**
- **A.** Redesign the information architecture (new tabs above), or just de-jargon + hide dead weight in place first?
- **B.** Client portal dwell-time (wish #4) is the only real build — do it now, or ship the four "surface existing data" wins first and add client timing after?
- **C.** Content — hide the nav now (zero risk) and decide on full removal later? (Recommended.)
- **D.** The deep analyst pages (Activation/Retention) — keep for later, or remove? They work, but nobody's reading them pre-launch.

---

*Evidence: three read-only sub-audits, 2026-08-13. Doc drift noted: CLAUDE.md references `lib/command/insights/` which doesn't exist — the brief/signal generators live under `lib/services/` (`metrics-rollup.ts`, `signals/`, `experiments/lifecycle.ts`).*
