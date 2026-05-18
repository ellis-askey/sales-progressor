# Role-Coverage Inventory: /agent/work-queue

**Date:** 2026-05-18  
**Status:** Stage 1 — Pending implementation  
**Files:** `app/agent/work-queue/page.tsx`, `components/reminders/AgentRemindersList.tsx`, `lib/services/reminders.ts`, `lib/services/work-queue.ts`, `app/api/chase/send-email/route.ts`, `app/api/ai/generate-chase/route.ts`

---

## Section 0: Data layer

**Mostly correct. One backend gap for SP (Chase API routes fail).**

### List queries — correct

`getAgentReminderLogs(vis: AgentVisibility)` in `lib/services/reminders.ts`:
- `vis.internalMode === "admin_all"` → `txWhere = { status: { in: ["active","on_hold"] } }` → all platform reminder logs ✓
- `vis.internalMode === "assigned"` → `txWhere = { assignedUserId: vis.userId, status: ..., serviceType: "outsourced" }` → SP's assigned outsourced files ✓
- Agent paths: unchanged ✓

`getWorkQueueItems(vis)` / `txWhereWorkQueue(vis)` in `lib/services/work-queue.ts`:
- `admin_all` → `{}` → all active/on_hold transactions ✓
- `assigned` → `{ assignedUserId: vis.userId }` → SP's assigned files ✓
- Agent paths: unchanged ✓

`activeFileCount` query: uses `txWhereWorkQueue(vis)` ✓

### Server actions — correct (agencyId || null bypass)

`completeTaskAction`, `snoozeTaskAction`, `wakeupReminderAction`, `advanceChaseTaskAction` all call underlying service functions with `session.user.agencyId || null`. When `null`, the service queries by task ID only (no agencyId filter). **Done and Snooze work correctly for SP.** ✓

### API routes — BROKEN for SP and admin

**`/api/chase/send-email` (route.ts line 24):**
```ts
where: { id: transactionId, agencyId: session.user.agencyId }
```
SP/admin: `agencyId = null/""` → `findFirst` returns `null` → **404 "Transaction not found"**.

**`/api/ai/generate-chase` (route.ts lines 114, 147):**
```ts
if (primaryTask.transaction.agencyId !== session.user.agencyId) { 403 }
```
SP/admin: `customerAgencyId !== null` → always **403 Forbidden**.

**Effect:** SP opening the Chase drawer gets 403 on "Generate" and 404 on "Send". The drawer renders but both primary actions fail.

### `runReminderEngineAction` — scoping fragility

Called on page mount in `AgentRemindersList`. Passes `session.user.agencyId || undefined`. For SP: `undefined` → `runReminderEngine` queries **all active transactions** platform-wide, not just SP's assigned files. Harmless correctness-wise, but wasteful. Logged as FU-18.

---

## Section 1: Current state per role

### Director — current state

Data: agency-scoped reminder logs.

| Section | What renders | Correct? |
|---|---|---|
| Page title | "Reminders" | ✓ |
| Subtitle | "What needs chasing, today and ahead." | ✓ |
| StatPills | Overdue / Due today / Coming up counts | ✓ |
| FileAlertsStrip | Agency-scoped file alerts | ✓ |
| Search + All/Seller/Buyer chips | All relevant | ✓ |
| Snoozed toggle | Relevant | ✓ |
| Urgency groups | Escalated / Overdue / Due today / Coming up | ✓ |
| Chase CTA | Opens ChaseDrawer → email send works | ✓ |
| Done / Snooze | Work | ✓ |
| Full empty state | "Your reminders will appear here" + ghost skeleton | ✓ |
| Inner empty state | "All caught up" | ✓ |

No adaptation needed.

---

### Negotiator — current state

Identical to director in work-queue terms. Data scoped to own files. All sections correct. ✓

---

### sales_progressor — current state

Data: `assigned` scope → reminder logs on SP's assigned outsourced files only.

| Section | What renders | Correct? |
|---|---|---|
| Page title | "Reminders" | ✓ |
| Subtitle | "What needs chasing, today and ahead." | **WRONG** — agent-framing |
| StatPills | Assigned-file counts | ✓ |
| FileAlertsStrip | Assigned-file alerts | ✓ |
| Search + All/Seller/Buyer chips | All relevant for SP | ✓ |
| Snoozed toggle | Relevant | ✓ |
| Urgency groups | Escalated / Overdue / Due today / Coming up | ✓ |
| Done button | Works (server action) | ✓ |
| Snooze button | Works (server action) | ✓ |
| **Chase CTA** | Drawer opens → AI Generate **403** → Send email **404** | **BROKEN** |
| Full empty state | "Your reminders will appear here" — agent-framed | **WRONG** |
| Inner empty state | "All caught up" | ✓ |

**Three problems:** Chase is broken; subtitle and full empty state are agent-framed.

---

### admin — current state

Data: `admin_all` → all reminder logs platform-wide.

| Section | What renders | Correct? |
|---|---|---|
| Page title | "Reminders" | ✓ |
| Subtitle | "What needs chasing, today and ahead." | **WRONG** — admin doesn't chase |
| StatPills | Platform-wide counts — overwhelming at scale | Wrong |
| FileAlertsStrip | Platform-wide alerts — overwhelming | Wrong |
| **Chase CTA** | Same broken path as SP (403/404) | **BROKEN** |
| Nav entry | "Reminders" shown in sidebar | **WRONG** — admin doesn't action reminders |

Admin's job is oversight, not actioning individual chases. Same pattern as To-Do (removed from admin nav).

---

## Section 2: Target state per role

### Director / Negotiator — no change

Zero adaptation required.

### sales_progressor — target

| Problem | Current | Target |
|---|---|---|
| Chase CTA | Broken (403/404) | **Hidden** — interim until API routes support internal staff |
| Subtitle | "What needs chasing, today and ahead." | "What needs chasing across your assigned files." |
| Full empty state | "Your reminders will appear here" | "Reminders for your assigned files will appear here." |

### admin — target

| Problem | Current | Target |
|---|---|---|
| Nav entry | Shown | **Hidden** — same pattern as To-Do |

Route stays accessible by URL (additive discipline). If admin navigates directly they see the broken page; that's acceptable.

---

## Section 3: Adaptation plan

| # | Item | Category | Role(s) | File |
|---|---|---|---|---|
| 1 | Hide Chase CTA for SP | A — Hide/show | SP | `AgentRemindersList.tsx` — `SideColumn` |
| 2 | Subtitle copy for SP | B — Copy | SP | `app/agent/work-queue/page.tsx` |
| 3 | Full empty state copy for SP | B — Copy | SP | `app/agent/work-queue/page.tsx` |
| 4 | Remove work-queue from admin nav | D — Remove | Admin | `components/layout/AgentShell.tsx` |

**Total: 4 items (possibly 5 if escalate button exists and fails for SP). No Category C.**

---

## Section 4: Open questions (answered)

**OQ-1 — Admin nav removal:** Confirmed remove. Same pattern as To-Do. Admin oversight via hub "Needs your attention."

**OQ-2 — Chase CTA for SP:** Confirmed Option A — hide entirely. Done and Snooze remain functional. WhatsApp endpoint also likely broken (same agencyId pattern); Option B (partial disable) would require separate verification and adds complexity.

---

## Section 5: Implementation order

1. Audit `escalateTaskAction` — is the Escalate button user-visible in the work-queue? If yes and it fails for SP, add hiding it as item 5.
2. `app/agent/work-queue/page.tsx`: `isProgressor` const, subtitle ternary, empty state ternary, `hideChase={isInternalStaff}` prop on `AgentRemindersList`
3. `components/reminders/AgentRemindersList.tsx`: `hideChase?: boolean` prop, thread to `SideColumn`, gate Chase footer
4. `components/layout/AgentShell.tsx`: add `role !== "admin"` guard on Reminders nav entry
5. `docs/role-coverage/follow-ups.md`: add FU-17, FU-18, FU-19
6. `docs/role-coverage/internal-staff-permissions-audit.md`: add FU-17 Chase API detail
7. `tsc --noEmit`, commit

---

## Section 6: Bugs found → follow-ups

**FU-17 — `/api/chase/send-email` and `/api/ai/generate-chase` fail for SP/admin**

`send-email` line 24: `where: { id: transactionId, agencyId: session.user.agencyId }` — SP agencyId null → 404.  
`generate-chase` lines 114/147: strict `transaction.agencyId !== session.user.agencyId` → 403.  
Fix: apply `agencyId ? { id, agencyId } : { id }` bypass. → `internal-staff-permissions-audit.md`

**FU-18 — `runReminderEngineAction` for SP runs platform-wide**

`app/actions/tasks.ts` line 106: `runReminderEngine(session.user.agencyId || undefined)` → for SP: `undefined` → full platform scan.  
Fix: pass SP's assigned transaction IDs or use a scoped reminder engine call. Low severity (harmless but wasteful). → `follow-ups.md`

**FU-19 — `escalateTaskAction` agencyId access not audited**

Needs verification during this pass (see Section 5 step 1). → `internal-staff-permissions-audit.md` if gap confirmed.
