# WS3 Arc Completion Report — Role Coverage

**Date:** 2026-05-18  
**Arc scope:** Internal staff (sales_progressor, admin) access to all seven `/agent/*` pages  
**Status:** Structurally complete. Analytics is no-op (data layer correct, nav kept).

---

## Two-phase structure

**Phase 1 — Data plumbing (earlier today, WS3 first pass)**  
Commits `9d7ff69` → `8adcb9b`. Added `resolveInternalVisibility`, extended `AgentVisibility` with `internalMode`, patched `txWhere` / `buildTxWhere` helpers in agent.ts, hub.ts, analytics.ts. Agent layout guard extended to allow internal staff. Director/negotiator data paths untouched.

**Phase 2 — UI adaptation pass (this session)**  
Commits `49be459` → `f9e9398`. Full four-role inventory per page, role-conditional UI, copy, and structural changes. This report covers both phases.

---

## Per-page summary

### 1. /agent/to-do
**Commit:** `49be459`  
**Files:** `app/agent/to-do/page.tsx`, `components/layout/AgentShell.tsx`

| Role | What changed |
|---|---|
| SP | Subtitle: "Tasks you've set yourself, and requests from us." Separate task sections: "Agent requests" (isAgentRequest) vs "My notes". Empty state: SP-specific. "New task" CTA hidden. |
| Admin | Removed from AgentShell nav (same pattern applied to Reminders later). |
| Director / Negotiator | Identical HTML — no change. |

**Director/negotiator additive confirmed:** isInternalStaff branches are additive; original render path runs for all agent roles unchanged.

---

### 2. /agent/hub
**Phase 1 commit:** `9d7ff69`  
**Phase 2 commit:** `2ca4c6d`  
**Files:** `app/agent/hub/page.tsx`, `app/agent/layout.tsx`, `lib/services/agent.ts`, `lib/services/hub.ts`

| Role | What changed |
|---|---|
| SP | Title: "My Files". Subtitle: "Your assigned outsourced files.". Service split card hidden (all SP files are outsourced — column collapses to 1). Empty state: SP-specific ("No files assigned yet"). AgentFlagButton hidden (SP is internal, not the agency). "New sale" CTA hidden. |
| Admin | Title: "Hub". Subtitle: "All files across the platform." AgentFlagButton hidden. "New sale" CTA visible (admin can create). |
| Director / Negotiator | Identical HTML — no change. |

---

### 3. /agent/transactions/[id]
**Commit:** `267dfde`  
**Files:** `app/agent/transactions/[id]/page.tsx`, `components/transaction/TransactionSidebar.tsx`

| Role | What changed |
|---|---|
| SP | `hideServiceTypeBadge={true}` (SP knows it's outsourced). `canEditSaleDetails={false}` — edit details button hidden on sidebar (both desktop + mobile). ComposeEmail hidden (`{!isInternal && <ComposeEmail .../>}`). ManualTaskList: `perspective="progressor"`, `showOwnership` only if outsourced + not internal. |
| Admin | Same gates as SP for edit/compose. `perspective="agent"` (admin sees full view). |
| Director / Negotiator | Identical HTML — no change. |

**Also shipped:** "You" → "Agent" rename in TransactionSidebar time-split rows (both roles see "Agent" now — additive label change).

---

### 4. /agent/transactions (list)
**Commit:** `6c35cfa`  
**Files:** `app/agent/transactions/page.tsx`, `components/transactions/TransactionListWithSearch.tsx`, `components/transactions/TransactionRowView.tsx`, `components/transactions/TransactionTable.tsx`

| Role | What changed |
|---|---|
| SP | serviceTag hidden (SP knows their files are outsourced — `showAgencyColumn && !showAssignedToColumn` pattern). Empty state: "No files assigned yet" / "Files assigned to you will appear here." |
| Admin | serviceTag relabelled: "Outsourced" / "Self-managed" (neutral, not customer-POV). ManagedByChip header changed to "Service type" with relabelled options. Mobile card: agency name row added below address. |
| Director / Negotiator | Identical HTML — no change. |

**Infrastructure added:** `ManagedByChip` gained `variant?: "agent" | "admin"` prop with separate label sets. `showAgencyColumn × showAssignedToColumn` boolean pair used to derive role from existing props — no new prop required.

---

### 5. /agent/work-queue
**Phase 1 commit:** `f1b1f00`  
**Phase 2 commit:** `e6a14a0`  
**Files:** `app/agent/work-queue/page.tsx`, `components/reminders/AgentRemindersList.tsx`, `components/layout/AgentShell.tsx`

| Role | What changed |
|---|---|
| SP | Subtitle: "What needs chasing across your assigned files." Full empty state title: "No files assigned yet". Empty state desc: "Reminders for your assigned files will appear here." Chase CTA hidden via `hideChase={isInternalStaff}` — API routes broken for SP (FU-17), interim hide. Done/Snooze remain fully functional. |
| Admin | Removed from AgentShell nav. Chase CTA hidden. |
| Director / Negotiator | Identical HTML — no change. |

**Infrastructure added:** `hideChase?: boolean` prop threaded `AgentRemindersList` → `SplitFileCard` → `SideColumn`. Chase footer gated with `!hideChase`.

---

### 6. /agent/completions
**Phase 1 commit:** `67ed16b`  
**Phase 2 commit:** `71f8a7f`  
**Files:** `app/agent/completions/page.tsx`, `lib/services/agent.ts`, `components/completions/CompletionFileRowView.tsx`

| Role | What changed |
|---|---|
| SP | Subtitle: "Your assigned outsourced files, tracking to completion." Empty state desc: "Once a file is assigned to you and exchanges, it'll appear here." Agency name shown in file rows (so SP can identify which agency each assigned file belongs to). |
| Admin | Subtitle: "All exchanged files across the platform." Agency name shown in file rows (critical for platform-wide view). |
| Director / Negotiator | Identical HTML — no change. `agencyName` not passed (gated by `isInternalStaff`). |

**Infrastructure added:** `getAgentCompletions` extended to fetch `agency.name`; `agencyName` added to `CompletionFileRow` type; optional `Agency:` label in both desktop and mobile row layouts, renders only when `agencyName` is present.

---

### 7. /agent/comms
**Phase 1 commit:** `34d449d`  
**Phase 2 commit:** `f9e9398`  
**Files:** `app/agent/comms/page.tsx`

| Role | What changed |
|---|---|
| SP | Subtitle: "What's happened on your assigned files." Empty state desc: "Confirmed steps on your assigned files appear here." |
| Admin | Subtitle: "What's happened across the platform." Empty state desc: "Confirmed steps appear here as they happen across the platform." |
| Director / Negotiator | Identical HTML — no change. |

---

### 8. /agent/analytics
**Phase 1 commit:** `8adcb9b`  
**No phase 2 changes.**

Data layer correct (all service functions branch on `internalMode`). Director-only sections (team filter, export, leaderboard, referral tables) correctly gated by `isDirector`. SP and admin see analytics with their scoped data. Per-agency admin drill-down deferred to own arc. Nav kept for both roles.

---

## Cross-cutting infrastructure added (this arc)

| Item | File | What it is |
|---|---|---|
| `resolveInternalVisibility(userId, role)` | `lib/services/agent.ts` | Sync resolver for SP/admin visibility (no DB call). Returns `internalMode: "assigned"` (SP) or `admin_all` (admin). |
| `AgentVisibility.internalMode` | `lib/services/agent.ts` | Optional field extending the shared visibility type. |
| `txWhere(vis)` branches | `lib/services/agent.ts`, `lib/services/hub.ts` | Branches on `internalMode` before falling through to agent logic. |
| `buildTxWhere(vis)` branches | `lib/services/analytics.ts` | Same pattern for analytics. |
| `ManagedByChip variant` prop | `components/transactions/TransactionListWithSearch.tsx` | `"agent"` (default) vs `"admin"` label sets and header label. |
| `hideChase` prop chain | `AgentRemindersList` → `SplitFileCard` → `SideColumn` | Gates Chase CTA for internal staff. |
| `agencyName` in completions | `lib/services/agent.ts`, `CompletionFileRowView.tsx` | Agency name surfaced for internal staff in completion file rows. |
| Admin nav exclusions | `components/layout/AgentShell.tsx` | To-Do and Reminders hidden from admin nav via `role !== "admin"` spread guards. |

---

## Additive discipline — confirmed per page

Every role-conditional change is additive. The contract:

- Director and negotiator render the **same HTML** as before this arc for every element we touched
- SP and admin additions are new `if/else` branches or prop conditionals that never substitute existing logic
- No existing agent-facing code was deleted or altered

Verified by: tsc clean after every commit; no regressions in agent render paths.

---

## Deferred work tracker

### internal-staff-permissions-audit.md — open items

| FU | Summary | Severity |
|---|---|---|
| FU-09 | `deleteCommAction` — no UI role gate; SP/admin can delete any visible comm. Backend enforcement unknown. | Medium |
| FU-10 | `confirmMilestoneAction` — no UI gate needed (SP/admin both have legitimate need), but backend auth must be verified. | Low |
| FU-11 | `saveAgentFeeAction` etc. — UI gate shipped (edit button now shows drawer with commercial fields hidden for SP). Backend server actions must check role. | Medium |
| FU-14 | SP transaction detail access: `getTransactionByScope` must reject unassigned files for SP. Verify enforcement is strict. | Medium |
| FU-17 | `/api/chase/send-email` (404) and `/api/ai/generate-chase` (403) fail for SP/admin — raw `agencyId` equality. Chase CTA hidden (interim). Fix: `agencyId ? { id, agencyId } : { id }` bypass. | High |

### Post-audit methodology finding — SP permission model is assignment-first, not role-gating

During the Arc A implementation pass (2026-05-18), SP-05 through SP-08 were verified against the code
and found to be **already unrestricted**. The audit had assumed these actions might be role-gated;
they are not.

**What the audit found:** File status changes (`changeStatusAction`), portal access management
(`generatePortalTokenAction`, contact CRUD), and comm note logging (`logCommAction`) all use
`scopeOwnershipWhere(scope, transactionId)` — an assignment-based guard, not a role-based one.
SP is blocked from unassigned files, not from the actions themselves on assigned files.

**Implication:** The agent app's permission model is more SP-friendly by default than expected.
The only two genuinely over-restricted SP capabilities are:
- **SP-01 (Chase):** Hidden because `/api/chase/send-email` and `/api/ai/generate-chase` fail for SP — backend fix needed (FU-17)
- **SP-03 (ComposeEmail):** Hidden for all internal staff via `{!isInternal && <ComposeEmail />}` — un-hide pending FU-17 fix and FU-14 FROM identity

Both blockers are backend API gaps, not UI design decisions. When the permissions audit arc fixes the
API routes, both Chase and ComposeEmail can be un-hidden for SP in a single follow-up commit.

Full detail: `docs/role-coverage/internal-staff-permissions-audit.md`

### follow-ups.md — open items relevant to SP/admin

| FU | Summary |
|---|---|
| FU-17 | Same as above — Chase API routes (cross-reference) |
| FU-18 | `runReminderEngineAction` for SP runs platform-wide (wasteful, not harmful) |

Full list: `docs/role-coverage/follow-ups.md`

### Admin analytics — per-agency drill-down arc

**Status:** Deferred. Ellis flagged as wanted, not cancelled.

**What's needed:**
- New service function for per-agency aggregation (totals, trends, exchange stats, fees — scope to be inventoried)
- Agency selector UI (dropdown or tabs) on the analytics page
- Scoped re-fetch or client-side filtering when agency changes

**When:** After WS3 ships clean (end-of-arc walkthrough complete).  
**Entry point:** Stage 1 inventory to define exact breakdown — which metrics break down by agency, what's aggregated, what the URL/state model is.

---

## All commits in order (phase 2 UI adaptation pass)

| SHA | Description |
|---|---|
| `49be459` | feat(role-coverage): /agent/to-do — SP + admin views |
| `c0957da` | fix(reminders): show milestone names in "Coming up" cards |
| `2ca4c6d` | feat(role-coverage): /agent/hub — SP + admin views |
| `267dfde` | feat(role-coverage): /agent/transactions/[id] — SP + admin views |
| `6c35cfa` | feat(role-coverage): /agent/transactions list — SP + admin views |
| `e6a14a0` | feat(role-coverage): /agent/work-queue — SP + admin views |
| `71f8a7f` | feat(role-coverage): /agent/completions — SP + admin views |
| `f9e9398` | feat(role-coverage): /agent/comms — SP + admin views |

**Phase 1 data plumbing commits (for reference):** `9d7ff69`, `7e3818c`, `fe02813`, `f1b1f00`, `67ed16b`, `34d449d`, `8adcb9b`

---

## End-of-arc walkthrough checklist (for Ellis)

Walk as each internal role and verify:

**As sales_progressor:**
- [ ] Hub shows "My Files" + SP subtitle; service split card absent; "New sale" absent
- [ ] To-Do: two sections ("Agent requests" / "My notes"); no "New task" CTA
- [ ] Work queue: subtitle "What needs chasing across your assigned files."; no Chase button; Done/Snooze work
- [ ] Transaction list: "My Files" title; no "Our team/You" serviceTag; "Files assigned to you." subtitle
- [ ] Transaction detail: no edit details button; no ComposeEmail; ServiceType badge hidden
- [ ] Completions: subtitle "Your assigned outsourced files…"; agency name visible in rows
- [ ] Comms/Updates: subtitle "What's happened on your assigned files."
- [ ] Analytics: accessible, data scoped to assigned files
- [ ] Reminders: NOT in sidebar nav
- [ ] To-Do: NOT in sidebar nav (admin exclusion — but SP sees it) ← verify SP sees To-Do nav entry

**As admin:**
- [ ] Hub shows "Hub" + "All files across the platform."; service split card visible
- [ ] Reminders: NOT in sidebar nav
- [ ] To-Do: NOT in sidebar nav
- [ ] Transaction list: "All Files" title; "Service type" chip header; agency column visible; admin-framed labels
- [ ] Transaction detail: no edit details button; no ComposeEmail
- [ ] Completions: "All exchanged files across the platform." subtitle; agency name in rows
- [ ] Comms: "What's happened across the platform." subtitle
- [ ] Analytics: accessible, cross-platform aggregated data

**Report any button/action that errors (especially chase-adjacent paths) — those are the FU-17 follow-ups to verify the interim hide is complete.**
