# Internal Staff Surface — Discovery Audit

**Date:** 2026-05-18  
**Scope:** Read-only. No code changes. Five areas surveyed.

---

## The headline finding

**The internal staff surface is substantially built, not broken.** Nine separate functional routes exist under `/dashboard`, `/tasks`, `/todos`, `/completing`, `/analytics`, `/reports`, `/solicitors`, `/comms`, `/not-our-files`, plus a full transaction detail at `/transactions/[id]`. The surface is not a stub — it has real UI, real data, and real access control.

The problem is **data starvation**: several query functions hardcode `agencyId` and return empty results for internal staff (whose `agencyId` is null/empty string). Once those queries are fixed, the existing pages immediately start showing data. The UI exists; the pipes are blocked.

---

## Area 1 — What exists under /app/dashboard and /app/admin

### `/app/dashboard/`

| File | Route | Status | What it does |
|---|---|---|---|
| `page.tsx` | `/dashboard` | Functional | Main hub: hero stats, unassigned files alert, task summary, exchange forecast, attention flags, admin filter bar, transaction list |
| `loading.tsx` | `/dashboard` (skeleton) | Functional | Animated skeleton for streaming SSR |

### `/app/admin/`

| File | Route | Status | What it does |
|---|---|---|---|
| `page.tsx` | `/admin` | Functional (admin only) | Agent account management, fee structures, milestone definitions (read-only table), reminder rules (read-only table) |
| `audit/page.tsx` | `/admin/audit` | Functional (admin only) | Paginated audit trail: all activity events across the platform, filterable by user |

### Middleware access rules

- `/dashboard` — accessible to all authenticated non-agent users (admin, sales_progressor, superadmin, viewer); agents are redirected to `/agent/hub`
- `/admin` — requires `role === "admin"` only; others redirected to `/dashboard`
- `/command/*` — requires `role === "superadmin"` + IP allowlist + step-up auth cookie (30 min freshness, 8 h idle, 24 h hard cap)
- `/agent/*` — agents only; non-agents redirected to `/dashboard`

---

## Area 2 — Auth and role model

### Single login page

One login page at `/app/login/page.tsx` for all roles. Post-login redirect is role-determined:

| Role | Lands at |
|---|---|
| `superadmin` | `/command/overview` |
| `director`, `negotiator` | `/agent/hub` |
| `admin`, `sales_progressor`, `viewer` | `/dashboard` |

### Session object

```ts
session.user = {
  id: string,
  name: string,
  email: string,
  role: "superadmin" | "admin" | "sales_progressor" | "director" | "negotiator" | "viewer",
  agencyId: string,    // empty string "" for superadmin/admin; null→"" for sales_progressor
  firmName: string | null,
  needsSignupCompletion: boolean,
}
```

### One users table, all roles

Agents and internal staff share the single `User` table. Distinguished by `role` + `agencyId`:
- Internal staff (`admin`, `sales_progressor`, `superadmin`): `agencyId` is null → coerced to `""`
- Agency users (`director`, `negotiator`, `viewer`): `agencyId` is populated CUID

### Access scope (already built)

`lib/security/access-scope.ts` correctly handles all three cases:

```ts
type AccessScope =
  | { kind: "agency";    agencyIds: string[] }  // director, negotiator, viewer
  | { kind: "assigned";  userId: string }        // sales_progressor → own assigned files
  | { kind: "all" }                              // admin, superadmin → no filter
```

`getAccessScope(session)` derives the right scope from session. `scopeTransactionWhere(scope)` translates it to a Prisma where clause. **This infrastructure is correct and complete.**

---

## Area 3 — Data access gaps

### The core problem

Six query functions in `lib/services/transactions.ts` pass `agencyId` directly into a Prisma `where` clause. For internal staff, `agencyId = ""`. No transaction has `agencyId = ""`, so all six return empty.

| Broken function | File | What returns empty |
|---|---|---|
| `listTransactions()` | transactions.ts | Transaction lists |
| `getTransaction()` | transactions.ts | Single transaction lookup |
| `countTransactionsByStatus()` | transactions.ts | Status tab counts |
| `getExchangeForecast()` | transactions.ts | Exchange forecast strip on `/dashboard` |
| `getExchangedNotCompleting()` | transactions.ts | Post-exchange strip on `/dashboard` |
| `getCompletingFilesDetailed()` | transactions.ts | Completing page data |

**Already correctly scoped** (using `scopeTransactionWhere(scope)`):
- `listTransactionsByScope()` — used by `/dashboard` transaction list ✓
- `countTransactionsByScope()` — used by `/dashboard` tab counts ✓

So the `/dashboard` page's transaction list and tab counts already work. The forecast strip, post-exchange strip, and completing page do not.

### Mixed patterns in reminders.ts and milestones.ts

`getReminderLogsForTransaction()` and `getMilestonesForTransaction()` both use a falsy check: `agencyId ? { id, agencyId } : { id }`. When `agencyId = ""` (falsy), they fall back to `{ id }` only — which is accidentally correct for internal staff.

`getChaseTasksForTransaction()` hardcodes `{ id, agencyId }` — **broken** for internal staff.

### Privilege escalation risk (flag for attention)

`runReminderEngine()` in `lib/services/reminders.ts` runs: `agencyId ? { status: "active", agencyId } : { status: "active" }`. When called with `agencyId = ""` (falsy), it fetches **all active transactions across the entire platform**. This is a bug if it's ever called from an internal staff context without intent.

### The fix pattern (not implementing — noting for Package D)

The correct fix is to replace hardcoded `agencyId` parameters with `scopeTransactionWhere(scope)` from `lib/security/access-scope.ts`. The helper already exists. The work is threading it into the six broken functions.

### assignedUserId — the correct access key for sales_progressor

`PropertyTransaction.assignedUserId` (nullable String) links outsourced files to their assigned progressor. `serviceType` field (`self_managed` | `outsourced`) indicates which access model applies.

---

## Area 4 — Email and notification infrastructure

### Milestone confirmation email flow

When `confirmMilestoneAction()` runs (in `app/actions/milestones.ts`), it calls `sendAdminMilestoneNotificationToPortal()` (async, fire-and-forget). This dispatches emails to:
- Vendor and purchaser portal contacts (if they have email + portalToken)
- The agent user (for self_managed files, if not the confirmer)
- The assigned sales_progressor (for outsourced files, via `tx.assignedUser.email`)

**Sales_progressors CAN confirm milestones today.** The gate in `confirmMilestoneAction()` uses `scopeOwnershipWhere(scope, transactionId)`, which correctly resolves to `{ id, assignedUserId }` for sales_progressor. If `assignedUserId` is set to them, the action succeeds. There is no role-based UI block — it's purely data-driven.

### Where email routing lives

Email routing is not role-based. It follows user ID relationships: `assignedUserId` → progressor emails, `agentUserId` → agent emails, contact table → client emails. No hardcoded role checks in email dispatch.

### Exchange confirmation

VM19/PM26 confirmation triggers `sendExchangeCompletionPack()` — a multi-email sequence covering all parties (contacts, agent, progressor). This path is complete.

### One note on the cron reminder engine

`runReminderEngine()` has the privilege escalation bug noted in Area 3. It should never be called from an internal staff session context without the scope fix being applied first.

---

## Area 5 — Internal-facing routes beyond /dashboard

All 9 routes referenced in `AppShell.tsx` nav are fully implemented and functional.

| Route | File | Status | Notes |
|---|---|---|---|
| `/tasks` | `app/tasks/page.tsx` | **Functional** | Full work queue with chase tasks, snoozed items, empty state |
| `/todos` | `app/todos/page.tsx` | **Functional** | Manual task list with done/pending filter |
| `/completing` | `app/completing/page.tsx` | **Functional** | Post-exchange files grouped by urgency (overdue → no date); links to `/transactions/[id]` |
| `/analytics` | `app/analytics/page.tsx` | **Functional** | KPI strip, inline SVG bar chart (monthly activity), fee pipeline, progressor breakdown, referral tables |
| `/reports` | `app/reports/page.tsx` | **Functional** | Weekly snapshot: exchanged, new files, milestones completed (7d window) |
| `/solicitors` | `app/solicitors/page.tsx` | **Functional** | Solicitor directory with per-firm contacts and active file badges |
| `/comms` | `app/comms/page.tsx` | **Functional** | Global comms log (all active files, chrono order) with type/method badges |
| `/not-our-files` | `app/not-our-files/page.tsx` | **Functional** | Agent-progressed files grouped by agent; admin/director only (sales_progressor redirected) |
| `/transactions/[id]` | `app/transactions/[id]/page.tsx` | **Fully built** | See below |

### `/transactions/[id]` — this is the big finding

The internal staff transaction detail is a complete, production-grade page:
- Property hero (address, status, progress %, on-track indicator, exchange date)
- Contacts section (vendors, purchasers with portal view dates)
- Solicitor section (vendor + purchaser firms + referral firm)
- Next milestone widget
- Reminders + recent activity side by side
- Risk score + chain widgets
- Property intel card
- Documents section
- **5 tab panes: Overview / Milestones / Reminders / To-Do / Activity**
  - Milestones tab: full `MilestonePanel` (vendor + purchaser trees, confirm/undo/N-R)
  - Reminders tab: `RemindersSection` (active logs, chase tasks)
  - Activity tab: full email parse + comms + activity timeline
- Sidebar: fee breakdown, assigned user, agent user, progress, key dates

This is not a stub. It matches the agent `/agent/transactions/[id]` feature-for-feature. Access is gated via `getAccessScope()` — admins see all, progressors see assigned only.

### What is missing

- `/transactions` (list page) — does not exist. Internal staff use `/dashboard` for the list.
- `/transactions/new` — exists but redirects to `/agent/transactions/new-v2` (a leftover; internal staff don't create files via this route).

---

## Summary for strategy decision

**What this means:**

1. The internal surface is not a rebuild — it's a polish pass, the same treatment the agent app got. Most of the structure and functionality is already there.

2. The data gap (Package D, six broken queries) is the unlock. Fix those six functions and the `/dashboard` forecast, `/completing`, and other data-dependent views immediately start working.

3. The `/transactions/[id]` page already exists and is full-featured. No rebuild needed there — polish only.

4. Sales_progressors can confirm milestones now, as long as `assignedUserId` is set on the file. The action infrastructure is correct.

5. Email routing works correctly for outsourced files. No email infrastructure work needed.

**Open questions for Ellis:**

1. Should `/not-our-files` remain admin-only, or should sales_progressors also be able to see agent-progressed files? Currently it redirects them.
2. The `/completing` page links to `/transactions/[id]` — but `/completing` has its own Set date inline picker now. Should `/transactions/[id]` also get that, or is that already there via the sidebar?
3. After fixing the data gap, which page should get the first polish pass? (Suggested: `/dashboard` main hub, then `/completing`, then `/tasks`.)
4. Is there an intent to build a `/transactions` list page (separate from `/dashboard`), or should the dashboard always be the list entry point for internal staff?
