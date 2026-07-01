# Phase 3 · Surface 9 · Other Agent Admin · Baseline + Audit + Plan

**Routes:** [`/agent/analytics`](../../../app/agent/analytics/page.tsx) + [`/agent/partners`](../../../app/agent/partners/page.tsx) + [`/agent/admin`](../../../app/agent/admin/page.tsx)
**Drafted:** 2026-07-01.

BUILD_PLAN scoped Surface 9 as a bundle of five routes: `/agent/account/*`, `/agent/admin`, `/agent/analytics`, `/agent/partners`, `/agent/my-files`.

Two of those don't exist:
- `/agent/account/*` — no directory
- `/agent/my-files` — no directory

Real scope reduces to **three routes** (analytics, partners, admin) totalling 726 lines. Small enough to bundle into one PR (J1) — same pattern as Wave A bundling for Surface 1.

---

## Baseline

### `/agent/analytics` (212 lines)
- Role: agent staff (director / negotiator) — has an empty-state variant
- `PageHeader` + optional empty-state card + streaming stat cards
- Delegates to a client shell (`AgentAnalyticsClient`) for period state
- Data: `getAgencyKpis(session.user.agencyId)`

### `/agent/partners` (269 lines)
- Role: agent staff — director-only settings visible
- `PageHeader` + director-only settings (preferred broker + recommended solicitors) + solicitor directory
- Uses `PreferredBrokerSettings` + `RecommendedSolicitorsSettings` client components
- Data: `getSolicitorDirectoryForAgent(vis)` + broker/solicitor rows

### `/agent/admin` (245 lines)
- Role: **founder-only** (single email allowlist: `ellis@thesalesprogressor.co.uk`) — page 404s for anyone else
- Three cards: agency fee management + milestone definitions + reminder rules
- Data: `agency.findMany`, `milestoneDefinition.findMany`, `reminderRule.findMany`

---

## Audit vs DoD

### Class inventory across all 3 files

**Clean `glass-card` → `<Card>` swaps (8 total):**
| File | Line | Card purpose |
|---|---|---|
| analytics/page.tsx | 99 | Empty-state card |
| partners/page.tsx | 80 | Preferred broker settings card |
| partners/page.tsx | 93 | Recommended solicitors settings card |
| partners/page.tsx | 121 | Empty directory card |
| partners/page.tsx | 151 | Solicitor directory list card |
| admin/page.tsx | 123 | Milestone definitions card |
| admin/page.tsx | 136 | Nested vendor-side / purchaser-side sub-cards (× 2, via .map) |
| admin/page.tsx | 168 | Reminder rules card |
| admin/page.tsx | 186 | Nested rule-group sub-cards (via .map) |

Actually the `.map()` renders 2 nested cards per parent — so line counts are for the JSX pattern, not per-instance. Total instances that need swapping: 8 unique JSX blocks.

**`agent-btn` → `<Button>` (1):**
- analytics/page.tsx:114 — "Add first sale" or similar CTA in empty state

**`agent-glass` chrome grandfathers (2):**
- analytics/page.tsx:129 + L144 — stat cards. Same grandfather as Surfaces 2-6.

**Voice violations (1):**
- admin/page.tsx:127 — "...vendor and purchaser sides. Read-only — the engine is the source of truth." → em-dash in prose. Fix: replace with period or colon.

**Em-dash placeholder cells (grandfather, no action):**
- analytics/page.tsx:134 (`—` in stat card when no value)
- admin/page.tsx:155, 216, 244 (`—` in tables for null values)

Same exception pattern as Surface 4 grandfather.

---

## Plan — PR J1

Single PR covering all 3 routes.

Changes:
1. **8 `glass-card` → `<Card>` swaps** across the 3 files
2. **1 `agent-btn` → `<Button>` swap** (analytics L114)
3. **1 voice swap** (admin L127 em-dash → period)
4. **POLISH_TBD** — extend Surface 2-6 chrome entry to include analytics/page.tsx `agent-glass` cards

Chrome decision inherited (Option B).

Verification:
- tsc clean
- multi-tenant 26/26
- E2E sentinels at `e2e/surface-agent-admin-bundle.spec.ts`

Exit:
- J1 PR shipped
- POLISH_TBD updated
- BUILD_PLAN closed for Surface 9 with route corrections (phantom removed)
