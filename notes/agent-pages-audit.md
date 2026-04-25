# Agent Pages Audit — Phase 0

**Date:** 2026-04-25  
**Scope:** Three new agent-facing pages — Work Queue, To-Do, Solicitors  
**Status:** Audit only. No code changes made.

---

## 1. Source Page Inventory (Admin Side)

### 1a. Work Queue → `/tasks`

**Purpose:** Chase reminders — automated prompts for progressors to chase solicitors, lenders, search providers, etc.

**Data models:**
- `ChaseTask` — one reminder per transaction milestone step. Fields: `id`, `transactionId`, `progressorId`, `ruleId`, `type` (phone/email/portal), `notes`, `dueAt`, `completedAt`, `snoozedUntil`, `wakeNote`.
- `ReminderRule` — configures when a task is due relative to a milestone date. Fields: `id`, `milestoneId`, `offsetDays`, `type`, `template`.
- `ReminderLog` — audit log of chase attempts. Fields: `id`, `taskId`, `completedAt`, `note`, `by`.

**Page features (`/tasks`):**
- 5 filter tabs: All, Due Today, Overdue, Upcoming, Snoozed
- Task card: property address, milestone, chase type (phone/email/portal), due date, notes
- Actions per card: Mark complete (with optional note), Snooze (set snoozedUntil date + wake note)
- Scoped to `progressedBy = 'progressor'` — only outsourced files generate chase tasks

**Agent-side equivalent:** None. Chase tasks are created and owned by progressors only.

**Key decision for agent Work Queue:** Rather than replicating the chase task system, the agent Work Queue should surface *what needs the agent's attention on their own files* — overdue milestones, missing contacts, stale files. This is a read-only status view, not a task management system.

---

### 1b. To-Do → `/todos`

**Purpose:** Manual tasks assigned to or from progressors and agents.

**Data model:**
- `ManualTask` — Fields: `id`, `transactionId`, `createdBy`, `assignedTo`, `title`, `description`, `dueAt`, `completedAt`, `isAgentRequest` (boolean).
- `isAgentRequest = true` means the progressor is requesting something from the agent (e.g. "please chase the vendor for documents"). From the agent's perspective this is an inbound to-do.

**Page features (`/todos`):**
- `ManualTaskList` component with a `perspective` prop (`'progressor'` or `'agent'`)
- Grouped by service type
- Mark complete, add notes, assign/reassign
- `AgentRequestsPanel` on the agent dashboard already shows `isAgentRequest` tasks for the logged-in agent

**Agent-side current state:**
- `AgentRequestsPanel` on `/agent/dashboard` shows agent-directed requests — partial exposure
- No dedicated `/agent/to-do` page exists
- Agents cannot create their own to-dos (only respond to progressor requests)

**Key decision for agent To-Do:** Build `/agent/to-do` as a consolidated inbox for agent-directed tasks. Group by transaction. Allow mark-complete. No task creation needed (agents respond, not initiate). Reuse `ManualTaskList perspective="agent"` or replicate its read pattern directly.

---

### 1c. Solicitors → `/solicitors`

**Purpose:** Central directory of all solicitor firms and their case handlers, with live file counts and performance intel.

**Data models:**

`SolicitorFirm`:
- `id`, `agencyId`, `name`, `createdAt`, `updatedAt`
- Relations: `handlers` (SolicitorContact[]), `vendorForTransactions`, `purchaserForTransactions`, `referredForTransactions`
- Unique constraint: `agencyId + name`

`SolicitorContact`:
- `id`, `firmId`, `name`, `phone?`, `email?`, `createdAt`, `updatedAt`
- Relation: `firm`

`PropertyTransaction` solicitor links (4 FK fields):
- `vendorSolicitorFirmId` → SolicitorFirm
- `vendorSolicitorContactId` → SolicitorContact
- `purchaserSolicitorFirmId` → SolicitorFirm
- `purchaserSolicitorContactId` → SolicitorContact
- `referredFirmId` → SolicitorFirm (referral tracking, separate concern)

**Page features (`/solicitors`):**
- Header stats: total firms count, total contacts count
- Searchable list of all firms in the agency
- Per firm: name, active file badge count
- Per contact: name, email (mailto), phone (tel), list of active files they handle (with vendor/purchaser role dot), links to each transaction
- Read-only directory — editing happens on individual transaction pages

**Actions available (not on directory page — on transaction pages):**
- `saveSolicitorsAction` — assign vendor/purchaser solicitor firm + contact to a transaction
- `saveReferralAction` — record referral firm and fee
- `POST /api/solicitor-firms` — create new firm (+ optional first handler)
- `POST /api/solicitor-firms/[id]/handlers` — add handler to existing firm
- `GET /api/solicitor-intel` — performance data (avg weeks to exchange, search turnaround, rating)

**Agent-side current state:**
- `SolicitorSection` component is already used on `/agent/transactions/[id]` — agents can view and edit solicitor assignments on their own transactions
- `SolicitorPicker` + `AddFirmModal` already work agent-side
- No `/agent/solicitors` directory exists

**Key decision for agent Solicitors:** Build `/agent/solicitors` as a read-only view of firms relevant to the agent's transactions. Agents see firms and contacts that appear on their files only (director sees all). Display phone/email for quick contact. Reuse `getSolicitorDirectory()` service with agent-scoped filtering.

---

## 2. Agent Side — Current State Summary

| Feature | Admin page | Agent equivalent | Gap |
|---------|-----------|-----------------|-----|
| Work queue / chases | `/tasks` (full) | None | Agent needs a simpler "what needs attention" view scoped to their files |
| To-do / manual tasks | `/todos` (full) | `AgentRequestsPanel` on dashboard (partial) | Needs a dedicated `/agent/to-do` page |
| Solicitor directory | `/solicitors` (full) | Solicitor section on transaction detail (partial) | Needs `/agent/solicitors` directory |

---

## 3. Existing Agent Components to Reuse

| Component | Location | Reuse opportunity |
|-----------|----------|-------------------|
| `AgentRequestsPanel` | `components/dashboard/` | Basis for to-do page — already filters `isAgentRequest` tasks |
| `SolicitorSection` | `components/solicitors/SolicitorSection.tsx` | Already on agent transaction detail |
| `SolicitorPicker` | `components/solicitors/SolicitorPicker.tsx` | Already agent-accessible |
| `AddFirmModal` | `components/solicitors/AddFirmModal.tsx` | Already agent-accessible |
| `ManualTaskList` | (admin) | May be reusable with `perspective="agent"` prop |
| `getSolicitorDirectory()` | `lib/services/solicitors.ts` | Add agent-scoped filtering |
| `getSolicitorIntel()` | `lib/services/solicitor-intel.ts` | Reuse as-is |

---

## 4. Recommended Approach

### Phase 1: Work Queue — `/agent/work-queue`

**Not** a mirror of `/tasks`. The admin chase system is progressor-only.

Instead: a **file health dashboard** scoped to the agent's own transactions (self-managed only for negotiators; all files for directors). Shows:
- Files with no activity in N days
- Overdue milestones (past expected date with no completion)
- Missing key contacts (no vendor/purchaser solicitor assigned)
- Transactions stuck at a milestone for too long

Sorted by urgency. Each row links to the transaction. No task management — read-only prompts.

**Implementation:** New server component page + service function querying `getAgentTransactions` data and computing staleness. No new models needed.

---

### Phase 2: To-Do — `/agent/to-do`

A dedicated page for agent-directed manual tasks (`isAgentRequest = true`, assigned to current user).

Features:
- List all open tasks assigned to the agent, grouped by transaction
- Mark complete (existing server action or new thin one)
- Show task title, description, due date, which progressor assigned it
- Completed tasks collapsible below

**Implementation:** New page + query `ManualTask` where `assignedTo = session.user.id AND isAgentRequest = true`. Reuse or adapt `AgentRequestsPanel` layout. Single server action for mark-complete.

---

### Phase 3: Solicitors — `/agent/solicitors`

A read-only directory of solicitor firms and contacts visible on the agent's transactions.

Features:
- List firms that appear as vendor or purchaser solicitor on any of the agent's transactions
- Per firm: name, contacts with phone/email, list of the agent's files they're on
- Intel badge (avg exchange weeks, rating) — reuse `getSolicitorIntel()`
- Click-to-call and click-to-email links
- Directors: see all agency firms. Negotiators: see only firms on their own files.

**Implementation:** New page + `getSolicitorDirectoryForAgent(agencyId, userId, isDirector)` service function. Filter transactions using `txWhere(vis)` then collect unique firm IDs.

---

### Phase 4: Verification

After all three pages built:
1. Director sees work queue for all files; negotiator sees only their own
2. To-do page shows only tasks assigned to logged-in agent; mark-complete works
3. Solicitor directory scoped correctly per role
4. All pages mobile-responsive
5. Navigation added to agent sidebar
6. `npx tsc --noEmit` clean
