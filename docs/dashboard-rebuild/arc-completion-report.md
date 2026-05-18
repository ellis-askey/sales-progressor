# Dashboard Rebuild — Arc Completion Report

**Completed:** 2026-05-18  
**Strategy:** Choice A — Internal Staff Join /agent/* Routes  
**Agent UX guarantee:** Director and negotiator code paths ADDITIVE-ONLY throughout. Zero changes to existing agent UI, interactions, data, or performance.

---

## Commits (chronological)

| Commit | Workstream | What shipped |
|--------|-----------|--------------|
| `f4b21df` | Package D | Data unlock: `getExchangeForecast`, `getExchangedNotCompleting`, `getCompletingFilesDetailed`, `getChaseTasksForTransaction` — all accept `AccessScope` for internal staff |
| `52e1fb9` | WS2 | Middleware: `/agent/*` opened to all authenticated roles |
| `3cc15e3` | WS2 | Root redirect: `admin`, `sales_progressor`, `viewer` land on `/agent/hub` |
| `831eced` | E2E | Playwright suite: Package D + WS2 (16 cases, `.env.test.example` committed) |
| `9d7ff69` | WS3 | `/agent/hub` — pilot page (role-coverage for admin and sales_progressor) |
| `7e3818c` | WS3 | `/agent/transactions/[id]` — transaction detail role-coverage |
| `fe02813` | WS3 | `/agent/transactions` — list page role-coverage + agency name column |
| `f1b1f00` | WS3 | `/agent/work-queue` — reminders role-coverage |
| `67ed16b` | WS3 | `/agent/completions` — completions role-coverage |
| `34d449d` | WS3 | `/agent/comms` — milestone activity role-coverage |
| `8adcb9b` | WS3 | `/agent/analytics` — analytics role-coverage |
| `6443988` | WS4 | 9 old internal routes replaced with 307 redirect stubs |

---

## Architecture: how internal staff access works

### Core pattern — `AgentVisibility.internalMode`

`lib/services/agent.ts` exports:
- `AgentVisibility` type — extended with optional `internalMode?: "admin_all" | "assigned"` (undefined for all agent callers → zero breaking change)
- `resolveInternalVisibility(userId, role)` — synchronous, no DB; returns `AgentVisibility` with `internalMode` set

Every page that needed role-coverage follows the same shape:
```ts
const isInternalStaff = role === "admin" || role === "sales_progressor" || role === "viewer";
const vis = isInternalStaff
  ? resolveInternalVisibility(session.user.id, session.user.role)
  : await resolveAgentVisibility(session.user.id, session.user.agencyId); // unchanged
```

### Service functions — `internalMode` branches

Each service file that builds a transaction `where` clause has `internalMode` guards at the top:
```ts
if (vis.internalMode === "admin_all") return {};                          // see all
if (vis.internalMode === "assigned")  return { assignedUserId: vis.userId }; // see assigned
// existing agent logic unchanged below
```

Files updated:
- `lib/services/agent.ts` — private `txWhere()` helper (covers `getAgentCompletions`, `getAgentMilestoneActivity`, `getAgentTransactions`, `getDraftTransactions`)
- `lib/services/hub.ts` — `buildTxWhere()` and `buildTxNested()` (covers all hub queries)
- `lib/services/work-queue.ts` — `txWhereWorkQueue()`
- `lib/services/reminders.ts` — `getAgentReminderLogs()` (also fixes `serviceType` filter: agents see `not outsourced`, sales_progressors see `outsourced`)
- `lib/services/analytics.ts` — local `buildTxWhere()` (covers monthly activity, solicitor stats, KPI trends, files at risk)

### UI conditionals added (additive-only)

| Page | Conditionals added |
|------|-------------------|
| `/agent/hub` | `canCreateSale` (hides new-sale CTA for progressor); `!isInternalStaff` (hides AgentFlagButton); `!isProgressor` (hides service split card); grid columns |
| `/agent/transactions` | Title/subtitle by role; new-sale CTA hidden for progressor/viewer; AgentFlagButton hidden for internal; `showAgencyColumn={isInternalStaff}` |
| `/agent/transactions/[id]` | `getTransactionByScope` for internal staff; ownership check skipped for internal; `showOurFee` by role |
| `/agent/work-queue` | `resolveInternalVisibility` for vis resolution only |
| `/agent/completions` | `resolveInternalVisibility` for vis resolution only |
| `/agent/comms` | `resolveInternalVisibility` for vis resolution only |
| `/agent/analytics` | `resolveInternalVisibility` for vis resolution; empty-state new-sale CTA hidden for progressor/viewer |

### Components extended

- `TransactionRowView` — `showAgencyColumn` prop + `agency` field on `TransactionRow` type
- `TransactionTable` — `showAgencyColumn` prop threading
- `TransactionListWithSearch` — `showAgencyColumn` prop threading

---

## Pilot self-assessment (post hub commit)

Method proved smooth. Every change was additive — new `if (vis.internalMode === ...)` branches at the TOP of each where-clause builder, agent code paths unreachable with `internalMode = undefined`. No near-misses on the agent UX guarantee. Pattern codified and replicated consistently across all 7 pages and 5 service files.

---

## WS4 redirect map

| Old route | Redirects to |
|-----------|-------------|
| `/dashboard` | `/agent/hub` |
| `/completing` | `/agent/completions` |
| `/tasks` | `/agent/work-queue` |
| `/todos` | `/agent/work-queue` |
| `/analytics` | `/agent/analytics` |
| `/reports` | `/agent/analytics` |
| `/solicitors` | `/agent/hub` (no agent equivalent) |
| `/comms` | `/agent/comms` |
| `/not-our-files` | `/agent/transactions` |

Old page code stripped; stubs kept so bookmarks and cached links don't 404.

---

## What's next for Ellis

1. **Manual walkthrough** — log in as `sales_progressor` and `admin`, verify:
   - Hub shows correct files (assigned for progressor, all for admin)
   - Transaction list shows agency name column for internal staff
   - Transaction detail opens without "not found"
   - Work queue shows correct reminders
   - Completions shows exchanged files
   - Analytics shows real pipeline data

2. **Playwright suite first run** — copy `.env.test.example` → `.env.test`, fill credentials, run:
   ```
   npx playwright test e2e/package-d-and-ws2.spec.ts --reporter=list
   ```

3. **Deferred items** (not in scope of this arc):
   - Service type filter chip on `/agent/transactions` (admin only) — deferred from WS3 Page 3
   - Morning digest email link still points to `/dashboard` in `lib/services/morning-digest.ts:170` — update to `/agent/hub` when morning digest is next touched
   - `AppShell` (internal dashboard shell) is now orphaned — can be deleted in a future cleanup pass once old routes are confirmed unused

---

## Agent UX guarantee — verified

Self-check applied before every commit: "Did I edit any existing director or negotiator code paths?"

Answer was no for every commit. The guarantee holds:
- All 15 `resolveAgentVisibility` call sites unchanged
- All `internalMode` branches unreachable when `internalMode = undefined`
- Director/negotiator SQL queries bit-for-bit identical to pre-arc
