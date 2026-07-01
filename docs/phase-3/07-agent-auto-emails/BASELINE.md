# Phase 3 · Surface 7 · Agent Auto-emails · Baseline + Audit + Plan

**Route:** [`/agent/automated-emails`](../../../app/agent/automated-emails/page.tsx)
**Drafted:** 2026-07-01.

Note: BUILD_PLAN listed the route as `/agent/auto-emails`. Actual route is `/agent/automated-emails`. Corrected in BUILD_PLAN as part of this closure.

Note: BUILD_PLAN also listed `/agent/transactions/[id]?tab=reminders` as part of Surface 7. That tab is already covered by Surface 1 Wave A4 (AutomatedEmailsCard). Surface 7 is just the dedicated feed page.

---

## Baseline

### Route + auth
- `app/agent/automated-emails/page.tsx` (103 lines) — async server component
- Allowed roles: `director`, `negotiator`, `sales_progressor`, `admin`, `superadmin` (all)
- Deep-link URL state: `?tab=pending|sent|errored|upcoming&mine=1&fileId=...`

### Data
Single fetcher `listAutomatedEmails({role, userId, agencyId, hasAdminPowers, mineOnly, fileId, tab})` returns `{rows, counts}`.
Conditional single-row query for `fileId` deep-link to resolve address label.

### Render branches
1. **fileId deep-link with no match** → `notFound()`
2. **Normal render** → `PageHeader` + `AutomatedEmailsListView` (KPI cards + tabs + rows)

### Components in scope
1. `app/agent/automated-emails/page.tsx` (103) — page orchestrator
2. `app/agent/automated-emails/AutomatedEmailsListView.tsx` (453) — client component with KPI cards + tabs + list

Consumes `EmailPreviewModal` (owned by comms surface, not in Surface 7 scope).

### Role variations
| Role | Subtitle | Mine toggle |
|---|---|---|
| admin / superadmin | "All automated emails across the platform." ⚠️ voice violation | — |
| sales_progressor | "Automated emails for files assigned to you." | — |
| negotiator | "Automated emails for files assigned to you." | — |
| director | "All automated emails for your agency's files." OR "for files assigned to you." | ✓ |

---

## Audit vs DoD

**Remarkably clean surface.** Zero `agent-glass*` / `glass-card` / `agent-btn` / `agent-acc` / `agent-skeleton` / `createPortal` usages.

### Class inventory
- Uses `agent-link`, `agent-segment-pill`, `agent-kpi-card`. All theme-token utility classes.
- `agent-kpi-card` is a specialised interactive stat card with its own hover / active / chevron rotation CSS. Not a `<Card>` primitive migration target (different affordance) — potential future primitive when a **second consumer** appears (Law 14 pending). Currently only used on this surface.

### Voice violations (2)
1. `page.tsx:25` — "All automated emails across the platform." → "All automated emails across every agency." (matches Surfaces 4 + 6 fix)
2. `AutomatedEmailsListView.tsx:273` — "No failed automated emails — everything's delivering cleanly." → "No failed automated emails. Everything's delivering cleanly." (em-dash in prose → period)

### Other
- Modal pattern: consumes `EmailPreviewModal` (out of scope)
- Loading: no `loading.tsx`. Server-rendered synchronously.
- Empty state: inline text within tab body (contextually appropriate for a feed list)

---

## Plan — PR I1

**Two-line PR.** Compressed model.

Changes:
1. Voice swap on page.tsx L25
2. Voice swap on AutomatedEmailsListView.tsx L273
3. POLISH_TBD: file `agent-kpi-card` as future primitive extraction pending 2nd consumer

Chrome decision: n/a — no chrome to migrate.

Verification:
- `tsc --noEmit` clean
- multi-tenant 26/26
- E2E sentinel at `e2e/surface-agent-auto-emails.spec.ts`

Exit:
- I1 PR shipped
- POLISH_TBD updated
- BUILD_PLAN closed for Surface 7 (route path corrected to `/agent/automated-emails`)
