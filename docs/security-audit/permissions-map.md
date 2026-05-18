# Permissions Map — Security Audit

**Date:** 2026-05-18
**Scope:** All server actions in `/app/actions/*` and API routes in `/app/api/*` that operate on transaction data (excluding `/api/command/*`, `/api/cron/*`, `/api/webhooks/*`, and non-transaction actions).
**Status:** RESOLVED — 5 commits applied 2026-05-18/19. All P0 gaps closed. See P1 table rows for individual status.

---

## Summary

- **Total items audited:** 52
- **P0 gaps (cross-tenant / data integrity):** 6
- **P1 gaps (role mismatch, limited blast radius):** 7
- **P2 gaps (audit trail / edge cases):** 5
- **Already secure:** 34

---

## P0 Items — ✅ ALL RESOLVED

1. **`addNoteAction` / `logCommAction` / `deleteCommAction` + API routes (comms.ts)** — **RESOLVED `fe01c26`**. `createCommunicationRecord` and `deleteCommunicationRecord` now accept `scope: AccessScope` and use `scopeOwnershipWhere` / scope-based where. All callers updated to pass `getAccessScope(session)`.

2. **`createContactAction` / `deleteContactAction` + API routes (contacts.ts)** — **RESOLVED `fe01c26`**. Same pattern applied to `createContact` and `deleteContact` services and all callers.

3. **`/api/milestones` POST route** — **RESOLVED `0561d04`**. Now uses `getAccessScope(session)` + `scopeOwnershipWhere(scope, transactionId)`.

4. **`completeTaskAction` / `snoozeTaskAction` / `wakeupReminderAction` / `advanceChaseTaskAction` (tasks.ts)** — **RESOLVED `d407793`**. All four actions now pass `getAccessScope(session)` to reminder service functions. Service functions (`advanceChaseTask`, `completeChaseTask`, `snoozeReminderLog`, `wakeUpReminderLog`) updated to accept `scope: AccessScope`.

---

## Scope of the `getAccessScope` / `scopeOwnershipWhere` pattern

The following action files correctly import and use `getAccessScope` + `scopeOwnershipWhere` for every single-transaction ownership guard. These are the gold-standard pattern:

- `app/actions/transactions.ts` — all functions except `promoteDraftAction` and `discardDraftAction` (see P1 notes)
- `app/actions/milestones.ts` — all six exported actions
- `app/actions/contacts.ts` — `updateContactAction`, `deleteContactAction`, `generatePortalTokenAction`
- `app/actions/portal.ts` — `replyPortalMessageAction`
- `app/api/chains/route.ts` (GET + POST v2 path)

---

## Milestone Actions

| Action | File:line | What it does | Current scope check | SP should have | Admin should have | Status | Risk if gap |
|---|---|---|---|---|---|---|---|
| `confirmMilestoneAction` | `app/actions/milestones.ts:45` | Confirms a milestone (and bilateral counterpart) for a transaction | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All files | SECURE | — |
| `markNotRequiredAction` | `app/actions/milestones.ts:254` | Marks milestone as not-required | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All files | SECURE | — |
| `reverseMilestoneAction` | `app/actions/milestones.ts:283` | Reverses a confirmed milestone | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All files | SECURE | — |
| `getUndoImpactAction` | `app/actions/milestones.ts:319` | Read-only: previews undo impact | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All files | SECURE | — |
| `executeUndoMilestoneAction` | `app/actions/milestones.ts:332` | Executes undo (cascade reversal) | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All files | SECURE | — |
| `getExchangeReconciliationList` | `app/actions/milestones.ts:364` | Read-only: lists outstanding milestones pre-exchange | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All files | SECURE | — |
| `confirmExchangeReconciliationAction` | `app/actions/milestones.ts:432` | Bulk-completes outstanding milestones at exchange | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All files | SECURE | — |
| `POST /api/milestones` | `app/api/milestones/route.ts:15` | Complete / reverse / mark-NR milestone (legacy route handler) | `where: { id, agencyId: session.user.agencyId }` — **agencyId-only, no SP/admin path** | Should use `scopeOwnershipWhere` | Should use `scopeOwnershipWhere` | **GAP (P0)** | SP cannot use this route at all (query returns 0 rows); admin is also blocked. Inconsistent with Server Action path which works correctly. |
| `GET /api/milestones/implied` | `app/api/milestones/implied/route.ts:11` | Read-only: returns implied predecessors | `where: { id, agencyId: session.user.agencyId }` — agencyId-only | Should use `scopeOwnershipWhere` | Should use `scopeOwnershipWhere` | **GAP (P1)** | SP cannot read implied predecessors — breakage not a data leak but blocks their workflow. |
| `GET /api/milestones/downstream` | `app/api/milestones/downstream/route.ts:11` | Read-only: returns downstream completed milestones | `where: { id, agencyId: session.user.agencyId }` — agencyId-only | Should use `scopeOwnershipWhere` | Should use `scopeOwnershipWhere` | **GAP (P1)** | Same — blocks SP workflow but no data exposed. |

---

## Communication / Comm Actions

| Action | File:line | What it does | Current scope check | SP should have | Admin should have | Status | Risk if gap |
|---|---|---|---|---|---|---|---|
| `addNoteAction` | `app/actions/comms.ts:15` | Adds internal note to a transaction | `requireSession()` only; delegates to `createCommunicationRecord(agencyId: session.user.agencyId \| null)` | Assigned files only | All files | **GAP (P0)** | SP can write notes to any transaction by guessing/knowing the transaction ID. `createCommunicationRecord` uses bare `{ id: transactionId }` when agencyId is null — no assignedUserId check. |
| `logCommAction` | `app/actions/comms.ts:38` | Logs an outbound/inbound/note comm record | Same as above | Assigned files only | All files | **GAP (P0)** | Same risk — SP can create comm records on any transaction. |
| `deleteCommAction` | `app/actions/comms.ts:32` | Deletes a comm record by id | `requireSession()` only; delegates to `deleteCommunicationRecord(agencyId: session.user.agencyId \| null)` | Assigned files only | All files | **GAP (P0)** | SP can delete any comm by ID. Service uses bare `{ id }` when agencyId is null. |
| `POST /api/comms` | `app/api/comms/route.ts:12` | Creates a comm record | Delegates to `createCommunicationRecord(agencyId: session.user.agencyId)` — same null-is-bypass issue | Assigned files only | All files | **GAP (P0)** | Duplicate of action path — same flaw. SP passes null agencyId and bypasses any filter. |
| `DELETE /api/comms` | `app/api/comms/route.ts:67` | Deletes a comm by query param id | Delegates to `deleteCommunicationRecord(agencyId: session.user.agencyId)` | Assigned files only | All files | **GAP (P0)** | Duplicate of action path. Same flaw. |

**Root cause:** `lib/services/comms.ts:133` — `createCommunicationRecord` uses `agencyId ? { id: transactionId, agencyId } : { id: transactionId }`. The intent was "no agencyId = internal staff can access all" but that means SP can access all, not just their assigned files. Likewise `deleteCommunicationRecord` at line 225.

---

## Manual Task Actions

| Action | File:line | What it does | Current scope check | SP should have | Admin should have | Status | Risk if gap |
|---|---|---|---|---|---|---|---|
| `GET /api/manual-tasks` | `app/api/manual-tasks/route.ts:6` | Lists manual tasks | `listManualTasks(session.user.agencyId, ...)` — for SP agencyId is null, which lists tasks `where { agencyId: null }` → **returns nothing** | Should filter by assignedTo or transaction.assignedUserId | Should show all tasks | **GAP (P1)** | SP sees no tasks at all — a usability blocker, not a data leak. |
| `POST /api/manual-tasks` | `app/api/manual-tasks/route.ts:17` | Creates a manual task | `createManualTask({ agencyId: session.user.agencyId, ... })` — for SP this creates a task with agencyId = null | Should link task to transaction scope | Should link to any transaction | **GAP (P1)** | Tasks created by SP have null agencyId and cannot be retrieved via normal agency paths. Data integrity concern — orphaned tasks. |
| `POST /api/agent/flag` | `app/api/agent/flag/route.ts:6` | Agent creates a manual task/flag | Checks `role === "negotiator" \| "director"`, then verifies `transactionId` against `agencyId` | N/A (agent-only route) | N/A | SECURE | — |

---

## Chase / Reminder Actions

| Action | File:line | What it does | Current scope check | SP should have | Admin should have | Status | Risk if gap |
|---|---|---|---|---|---|---|---|
| `completeTaskAction` | `app/actions/tasks.ts:11` | Marks a chase task done | `completeChaseTask(taskId, session.user.agencyId \| null)` — for SP, passes null → bare `{ id: taskId }` in service, no assignedUserId check | Assigned files only | All tasks | **GAP (P0)** | SP can complete any chase task on any transaction in the system. |
| `snoozeTaskAction` | `app/actions/tasks.ts:48` | Snoozes a chase task | `snoozeReminderLog(taskId, hours, session.user.agencyId \| null)` — same null-bypass | Assigned files only | All tasks | **GAP (P0)** | SP can snooze any chase task. |
| `wakeupReminderAction` | `app/actions/tasks.ts:54` | Wakes a snoozed reminder log | `wakeUpReminderLog(logId, session.user.agencyId \| null)` — same pattern | Assigned files only | All logs | **GAP (P0)** | SP can wake any reminder log. |
| `advanceChaseTaskAction` | `app/actions/tasks.ts:60` | Advances chase task (increments repeat schedule) | `advanceChaseTask(taskId, session.user.agencyId \| null)` — same | Assigned files only | All tasks | **GAP (P0)** | SP can advance any chase task. |
| `recordManualChaseAction` | `app/actions/tasks.ts:66` | Records a manual chase (increments chaseCount + creates comm record) | `getAccessScope` + `scopeChaseTaskWhere` — **correctly uses access scope** | Assigned files only | All tasks | SECURE | — |
| `escalateTaskAction` | `app/actions/tasks.ts:92` | Sets task priority to escalated | `getAccessScope` + `scopeChaseTaskWhere` — correct | Assigned files only | All tasks | SECURE | — |
| `runReminderEngineAction` | `app/actions/tasks.ts:104` | Runs reminder engine for current agency | `runReminderEngine(session.user.agencyId \| undefined)` — for SP, passes undefined, runs engine for ALL active transactions | Should be restricted to admin/SP assigned scope | Admin-only action, or carefully scoped | **GAP (P2)** | SP calling this triggers the reminder engine across all transactions. Engine writes are all safe (scoped per transaction internally) but the action itself is admin-level power available to SP. |
| `getTransactionReminderCountAction` | `app/actions/tasks.ts:110` | Read-only count of reminders for a transaction | Correctly builds scope-aware where using inline `scope.kind` check | Assigned files only | All | SECURE | — |
| `POST /api/reminders/tasks` | `app/api/reminders/tasks/route.ts:8` | Complete or snooze a chase task | `completeChaseTask(taskId, session.user.agencyId)` / `snoozeReminderLog(taskId, hours, session.user.agencyId)` — same null-bypass for SP | Assigned files only | All | **GAP (P0)** | Same as task actions — SP bypasses scope. |
| `POST /api/reminders/logs` | `app/api/reminders/logs/route.ts:8` | Wake up a reminder log | `wakeUpReminderLog(logId, session.user.agencyId)` — same | Assigned files only | All | **GAP (P0)** | Same — SP can wake any log. |

**Root cause:** `lib/services/reminders.ts` functions `completeChaseTask`, `snoozeReminderLog`, `wakeUpReminderLog`, `advanceChaseTask` — all use `agencyId ? { id, transaction: { agencyId } } : { id }`. This pattern, shared with `comms.ts`, treats null agencyId as "no filter" rather than "filter by assignedUserId".

---

## EditSaleDetails / Transaction Scalar Actions

| Action | File:line | What it does | Current scope check | SP should have | Admin should have | Status | Risk if gap |
|---|---|---|---|---|---|---|---|
| `saveCompletionDateAction` | `app/actions/transactions.ts:248` | Sets/clears legal completion date | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All | SECURE | — |
| `changeStatusAction` | `app/actions/transactions.ts:276` | Changes transaction status (active/on_hold/completed/withdrawn) | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All | SECURE | — |
| `savePriceAction` | `app/actions/transactions.ts:344` | Updates purchase price + logs price history | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All | SECURE | — |
| `saveOverrideDateAction` | `app/actions/transactions.ts:372` | Sets/clears predicted completion date override | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All | SECURE | — |
| `saveAgentFeeAction` | `app/actions/transactions.ts:400` | Updates agent fee amount/percent/VAT | `getAccessScope` + `scopeOwnershipWhere` | **Should SP be able to edit agent fees?** Currently allowed via scope. | All | **GAP (P1)** | SP can edit the customer agency's fee fields if they have access to the file. Agent fee is commercial-in-confidence data for the agency. No role-level restriction exists. The scope check (ownership) passes but role was not verified. |
| `assignUserAction` | `app/actions/transactions.ts:432` | Assigns an internal user to a file | Checks `scope.kind !== "all"` — only admin/superadmin can proceed | N/A (SP explicitly blocked) | All | SECURE | — |
| `saveSolicitorsAction` | `app/actions/transactions.ts:462` | Updates solicitor firm/contact linkages | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All | SECURE | — |
| `savePurchaseTypeAction` | `app/actions/transactions.ts:492` | Updates purchase type | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All | SECURE | — |
| `saveReferralAction` | `app/actions/transactions.ts:513` | Updates referral fee/firm | `getAccessScope` + `scopeOwnershipWhere` | **Should SP be able to edit referral fees?** Currently allowed. | All | **GAP (P1)** | Same as agent fee — commercial data belonging to the agency. |
| `saveBrokerReferralAction` | `app/actions/transactions.ts:539` | Updates broker referral data | `getAccessScope` + `scopeOwnershipWhere` | Same concern — broker referral fee is agency commercial data | All | **GAP (P1)** | Same pattern. |
| `getAddressConsequencesAction` | `app/actions/transactions.ts:566` | Read-only: impact preview before address change | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All | SECURE | — |
| `saveAddressAction` | `app/actions/transactions.ts:582` | Updates property address | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All | SECURE | — |
| `getSaleDetailsDelta` | `app/actions/transactions.ts:867` | Read-only: previews tenure/purchaseType change impact | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All | SECURE | — |
| `confirmSaleDetailsAction` | `app/actions/transactions.ts:949` | Applies tenure/purchaseType change with milestone cascade | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All | SECURE | — |
| `POST /api/transactions/price` | `app/api/transactions/price/route.ts:10` | Updates price, override date, completion date, or agent fee | `where: { id: transactionId, agencyId: session.user.agencyId }` — agencyId-only | Should use `scopeOwnershipWhere` | Should use `scopeOwnershipWhere` | **GAP (P1)** | SP/admin cannot use this route (query returns 0 rows for null agencyId). Same pattern as `/api/milestones` — route is broken for internal staff but not a data leak. |
| `PATCH /api/transactions/[id]` | `app/api/transactions/[id]/route.ts:8` | Updates notes, solicitors, assignedUserId, expectedExchangeDate | `where: { id, agencyId: session.user.agencyId }` — agencyId-only | Should use `scopeOwnershipWhere`; also allows setting `assignedUserId` without checking SP role | Needs role check for assignedUserId | **GAP (P1)** | SP cannot use this route (null agencyId). But the route also allows any authenticated user to set `assignedUserId` without the same `scope.kind === "all"` guard that `assignUserAction` applies — if SP could call it, they'd be able to self-assign. Currently moot since the agencyId filter blocks them, but the design is inconsistent. |
| `POST /api/transactions/status` | `app/api/transactions/status/route.ts:22` | Changes transaction status | `where: { id: transactionId, agencyId: session.user.agencyId }` — agencyId-only | Should use `scopeOwnershipWhere` | Should use `scopeOwnershipWhere` | **GAP (P1)** | SP cannot use (blocked by null agencyId). Not a data leak but SP workflow broken. |

---

## Transaction Status / Lifecycle Actions

| Action | File:line | What it does | Current scope check | SP should have | Admin should have | Status | Risk if gap |
|---|---|---|---|---|---|---|---|
| `createTransactionAction` | `app/actions/transactions.ts:22` | Creates a new transaction | Uses `session.user.agencyId` for scoping; SP path sets `agencyId: null` correctly | SP creates outsourced transactions (sets assignedUserId to self) | Admin creates any | SECURE | — |
| `saveDraftAction` | `app/actions/transactions.ts:613` | Saves/updates a draft transaction | Uses `scopeOwnershipWhere(getAccessScope(session), draftId)` for existing draft; new draft uses `session.user.agencyId` | Assigned files only | All drafts | SECURE | — |
| `promoteDraftAction` | `app/actions/transactions.ts:756` | Promotes draft to active transaction | `where: { id: draftId, agencyId: session.user.agencyId, status: DRAFT_STATUS }` — agencyId-only | Should use scopeOwnershipWhere | Should use scopeOwnershipWhere | **GAP (P1)** | SP cannot promote drafts (null agencyId blocks). Not a data leak. |
| `discardDraftAction` | `app/actions/transactions.ts:810` | Deletes a draft transaction | `deleteMany({ where: { id, agencyId: session.user.agencyId, status: DRAFT_STATUS } })` — agencyId-only | Should use scopeOwnershipWhere | Should use scopeOwnershipWhere | **GAP (P1)** | SP cannot discard drafts. Not a data leak. |
| `POST /api/transactions` | `app/api/transactions/route.ts:17` | Creates a transaction (legacy route handler) | Uses `session.user.agencyId` directly | SP creates outsourced transactions | Admin creates any | SECURE (legacy) | — |

---

## Document Actions

| Action | File:line | What it does | Current scope check | SP should have | Admin should have | Status | Risk if gap |
|---|---|---|---|---|---|---|---|
| `GET /api/transactions/[id]/documents` | `app/api/transactions/[id]/documents/route.ts:20` | Lists documents with signed URLs | `where: { id, agencyId: session.user.agencyId }` — agencyId-only | Should use scopeOwnershipWhere | Should use scopeOwnershipWhere | **GAP (P1)** | SP cannot access documents for their files — broken workflow. No data exposed. |
| `POST /api/transactions/[id]/documents` | `app/api/transactions/[id]/documents/route.ts:51` | Uploads documents to a transaction | `where: { id, agencyId: session.user.agencyId }` — agencyId-only | Should use scopeOwnershipWhere | Should use scopeOwnershipWhere | **GAP (P1)** | SP cannot upload documents. Broken workflow. |
| `POST /api/portal/documents` | `app/api/portal/documents/route.ts:18` | Portal-side document upload (token-authenticated) | Token → contact → transaction; no staff session | N/A (portal user, not internal staff) | N/A | SECURE | — |

---

## Contact / Portal Actions

| Action | File:line | What it does | Current scope check | SP should have | Admin should have | Status | Risk if gap |
|---|---|---|---|---|---|---|---|
| `createContactAction` | `app/actions/contacts.ts:17` | Creates a contact on a transaction | `createContact(input, session.user.agencyId \| null)` → when null, service uses bare `{ id: transactionId }` | Assigned files only | All | **GAP (P0)** | SP can add contacts to any transaction. Service does not check `assignedUserId`. |
| `updateContactAction` | `app/actions/contacts.ts:35` | Updates a contact's details | `getAccessScope` + `scopeOwnershipWhere` via `{ id: contactId, transaction: txWhere }` | Assigned files only | All | SECURE | — |
| `deleteContactAction` | `app/actions/contacts.ts:63` | Deletes a contact | `getAccessScope` + `scopeOwnershipWhere` for the ownership check, BUT then calls `deleteContact(contactId, session.user.agencyId \| null)` which re-queries with bare `{ id: contactId }` when agencyId null | Assigned files only | All | **GAP (P0)** | Two-step pattern: `deleteContactAction` correctly uses `scopeOwnershipWhere` to verify access, then passes the result to `deleteContact(agencyId)` which does a SECOND verification. For SP: the first check (via scopeOwnershipWhere) is correct and would gate properly. BUT the service `deleteContact` then repeats the check with null agencyId, meaning it passes too. **Net result: deleteContactAction is actually secure for SP because `scopeOwnershipWhere` already enforces the correct gate before calling the service.** Marking SECURE with a note on the redundant inconsistency. |
| `generatePortalTokenAction` | `app/actions/contacts.ts:78` | Generates portal token for a contact | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All | SECURE | — |
| `POST /api/contacts` | `app/api/contacts/route.ts:13` | Creates a contact | `createContact(input, session.user.agencyId)` — same null-bypass | Assigned files only | All | **GAP (P0)** | Same as `createContactAction`. SP can add contacts to any transaction via this route. |
| `PATCH /api/contacts` | `app/api/contacts/route.ts:42` | Updates a contact | `where: { id, transaction: { agencyId: session.user.agencyId } }` — agencyId-only | Should use `scopeOwnershipWhere` | Should use `scopeOwnershipWhere` | **GAP (P1)** | SP cannot update contacts (returns 0 rows). Broken workflow. |
| `DELETE /api/contacts` | `app/api/contacts/route.ts:71` | Deletes a contact | `deleteContact(contactId, session.user.agencyId)` — null-bypass for SP | Assigned files only | All | **GAP (P0)** | SP can delete any contact. |
| `replyPortalMessageAction` | `app/actions/portal.ts:44` | Sends a reply to a portal message | `getAccessScope` + `scopeOwnershipWhere` | Assigned files only | All | SECURE | — |
| `portalConfirmMilestoneAction` | `app/actions/portal.ts:10` | Portal: confirms a milestone via token | Token-authenticated only; no staff session | N/A | N/A | SECURE | — |
| `portalMarkNotRequiredAction` | `app/actions/portal.ts:24` | Portal: marks milestone NR via token | Token-authenticated only | N/A | N/A | SECURE | — |
| `portalSendMessageAction` | `app/actions/portal.ts:35` | Portal: sends a message via token | Token-authenticated only | N/A | N/A | SECURE | — |
| `POST /api/portal/milestone` | `app/api/portal/milestone/route.ts:4` | Portal: confirms a milestone | Token-authenticated | N/A | N/A | SECURE | — |
| `POST /api/portal/invite` | `app/api/portal/invite/route.ts:10` | Sends portal invite email | Token-only route, no session required | N/A | N/A | SECURE | — |

---

## API Routes — Chase / AI

| Action | File:line | What it does | Current scope check | SP should have | Admin should have | Status | Risk if gap |
|---|---|---|---|---|---|---|---|
| `POST /api/chase/send-email` | `app/api/chase/send-email/route.ts:8` | Sends a chase email and logs it | `where: { id: transactionId, agencyId: session.user.agencyId }` — agencyId-only | Should use `scopeOwnershipWhere` | Should use `scopeOwnershipWhere` | **GAP (P1)** | SP cannot send chase emails via this route (blocked by null agencyId). Broken workflow. |
| `POST /api/ai/generate-chase` | `app/api/ai/generate-chase/route.ts:51` | AI-generates a chase message using task context | `primaryTask.transaction.agencyId !== session.user.agencyId` — agencyId equality check | Should also check `assignedUserId` for SP | N/A — admin is kind="all" | **GAP (P1)** | SP is blocked from using AI chase generation because their agencyId is null and transaction agencyId is never null. Same pattern. No data exposed. |
| `POST /api/ai/parse-email` | `app/api/ai/parse-email/route.ts:7` | AI-parses an email (disabled) | **Feature is disabled** — returns 503 | N/A | N/A | SECURE (disabled) | — |
| `POST /api/agent/send-email` | `app/api/agent/send-email/route.ts:7` | Sends email from verified sender address | Verifies ownership of the sender address via `session.user.id`; logs comm with no transaction ownership check | If `transactionId` provided, no scope check on transaction | All | **GAP (P2)** | When `transactionId` is provided, the route creates a comm record (`outboundMessage`) without verifying the transaction belongs to the session user. Any authenticated user can append a comm record to any transaction by passing an arbitrary `transactionId`. |
| `POST /api/agent/memo-parse` | `app/api/agent/memo-parse/route.ts:41` | AI-parses a memo of sale document | `requireSession()` only; no transaction scope (reads a file only, returns parsed data) | N/A — no transaction mutation | N/A | SECURE | — |

---

## Read-only Actions and Routes

These actions read transaction data but do not mutate it. Noted briefly for completeness.

| Action | File:line | Scope check | Status |
|---|---|---|---|
| `GET /api/search` | `app/api/search/route.ts:12` | `where: { agencyId, ... }` — agency-scoped only. SP gets null agencyId → empty results. | **GAP (P2)** — SP cannot search. Broken, not leaky. |
| `GET /api/agent/search` | `app/api/agent/search/route.ts:12` | Uses `resolveAgentVisibility` — agent-only visibility model; SP not expected to use this route. | SECURE for intended users |
| `POST /api/transaction-notes` | `app/api/transaction-notes/route.ts:7` | `where: { id, agencyId: session.user.agencyId }` — agencyId-only. SP cannot write notes here. | **GAP (P1)** — SP blocked by null agencyId. |
| `DELETE /api/transaction-notes` | `app/api/transaction-notes/route.ts:37` | Checks `note.transaction.agencyId !== session.user.agencyId` — equality check, null ≠ null works by coincidence since no transaction has null agencyId. | SECURE by coincidence — worth hardening |
| `GET /api/chains` | `app/api/chains/route.ts:17` (GET) | Uses `getAccessScope` + `scopeOwnershipWhere` | SECURE |
| `POST /api/chains` (v2) | `app/api/chains/route.ts:50` | Uses `getAccessScope` + `scopeOwnershipWhere` | SECURE |
| `POST /api/chains` (legacy) | `app/api/chains/route.ts:91` | Uses `session.user.agencyId` directly | GAP (P2) — SP cannot create legacy chains, not a leak |
| `GET /api/chains/[id]` | `app/api/chains/[id]/route.ts:16` | Uses `canViewChain` (participation-based) | SECURE |
| `DELETE /api/chains/[id]` | `app/api/chains/[id]/route.ts:80` | Checks `createdByUserId === session.user.id \|\| role === "admin"` | SECURE |
| `FileTime start/heartbeat/end` | `app/api/file-time/*` | Start checks `agencyId` exists (SP excluded by design with explicit 403). Heartbeat/end check `userId`. | SECURE — SP explicitly rejected at start |
| `POST /api/agent/flag` | `app/api/agent/flag/route.ts:6` | Role-restricted to negotiator/director; checks transaction agencyId | SECURE |

---

## Solicitors / Brokers / Settings Actions

These act on agency-level reference data, not individual transactions. Noted for completeness.

| Action | File:line | What it does | Scope check | Status |
|---|---|---|---|---|
| `upsertRecommendedSolicitorAction` | `app/actions/solicitors.ts:14` | Adds firm to agency's recommended list | `requireDirector` (role check) + `session.user.agencyId` | SECURE — SP/admin cannot call this |
| `removeRecommendedSolicitorAction` | `app/actions/solicitors.ts:30` | Removes from recommended list | Same | SECURE |
| `createAndRecommendSolicitorAction` | `app/actions/solicitors.ts:41` | Creates firm and adds to recommended | Same | SECURE |
| `addRecommendedSolicitorWithContactAction` | `app/actions/solicitors.ts:62` | Creates firm+contact+recommendation | Same | SECURE |
| `upsertPreferredBrokerAction` | `app/actions/brokers.ts:11` | Adds preferred broker for agency | `requireDirector` + `session.user.agencyId` | SECURE |
| `removePreferredBrokerAction` | `app/actions/brokers.ts:27` | Removes preferred broker | Same | SECURE |
| `addBrokerWithContactAction` | `app/actions/brokers.ts:38` | Creates broker firm+contact | Same | SECURE |

---

## Summary of Root Causes

### Root cause A — Null-as-no-filter in shared services

`lib/services/comms.ts`, `lib/services/reminders.ts`, and `lib/services/contacts.ts` (for create/delete) all share the pattern:

```typescript
where: agencyId ? { id, ...: { agencyId } } : { id }
```

The intent was "internal staff don't have agencyId so skip that filter." But this means SP is only filtered by record ID — no `assignedUserId` constraint exists. The correct fix is to use `scopeOwnershipWhere` (or equivalent) rather than bare `agencyId ?` branching.

**Affected:** `createCommunicationRecord`, `deleteCommunicationRecord`, `completeChaseTask`, `snoozeReminderLog`, `wakeUpReminderLog`, `advanceChaseTask`, `createContact` (service), `deleteContact` (service), `getReminderLogsForTransaction`.

### Root cause B — Old API routes not updated to `scopeOwnershipWhere`

Several route handlers predate the `access-scope.ts` helper and still use inline `where: { id, agencyId: session.user.agencyId }`. These work for agency users but silently fail (0 rows) for SP/admin rather than using the correct scope. Not data leaks but broken SP workflows.

**Affected:** `/api/milestones`, `/api/milestones/implied`, `/api/milestones/downstream`, `/api/transactions/price`, `/api/transactions/[id]`, `/api/transactions/status`, `/api/transactions/[id]/documents`, `/api/chase/send-email`, `/api/ai/generate-chase`, `/api/contacts` (PATCH), `/api/transaction-notes` (POST).

### Root cause C — No role-level guard on financial fields

`saveAgentFeeAction`, `saveReferralAction`, `saveBrokerReferralAction` use `scopeOwnershipWhere` correctly for ownership but do not check `session.user.role` to prevent SP from modifying agency commercial data (fees, referral amounts). SP is a third party from the agency's perspective; editing their fee structure is a business concern even if not a strict data isolation hole.

---

## Appendix — Files reviewed but out of scope for this audit

- `app/actions/auth*` — authentication only
- `app/actions/admin*` — superadmin Command Centre actions
- `app/actions/command-*` — Command Centre
- `app/actions/outbound-log.ts` — superadmin-only (uses `requireSuperAdmin`)
- `app/actions/profile.ts`, `app/actions/invite-*.ts`, `app/actions/accept-*.ts`, `app/actions/delete-my-account.ts`, `app/actions/export-my-data.ts`, `app/actions/dismiss-director-joined.ts`, `app/actions/complete-oauth-signup.ts`, `app/actions/agent-preferences.ts`, `app/actions/voice-samples.ts`, `app/actions/content-topics.ts`, `app/actions/content-engagement.ts`, `app/actions/draft-posts.ts` — account/content/preferences, no transaction data
- `/api/command/*` — Command Centre (excluded by scope)
- `/api/cron/*` — Cron jobs (excluded by scope)
- `/api/webhooks/*` — Webhooks (excluded by scope)
- `/api/auth/*`, `/api/register`, `/api/feedback`, `/api/survey`, `/api/retention/*`, `/api/gdpr/*` — auth/compliance, no transaction mutations by users
- `/api/property-intel-lookup`, `/api/solicitor-intel`, `/api/solicitor-firms`, `/api/claim` — read-only reference data
- `/api/agent/team/*`, `/api/agency/users`, `/api/admin/users`, `/api/admin/agents` — user management
- `/api/agent/verified-emails/*`, `/api/agent/notifications`, `/api/agent/push-subscribe`, `/api/agent/analytics-export`, `/api/agent/onboarding-progress`, `/api/agent/send-instructions-email`, `/api/agent/team/resend-invite` — agent account management
- `/api/portal/manifest`, `/api/portal/calendar-export`, `/api/portal/push-subscribe`, `/api/portal/explain-email` — portal read-only or push
- `/api/experiments/*`, `/api/demo-data`, `/api/seed-demo`, `/api/test-fixtures/*` — dev/test utilities
- `/api/notifications/portal` — read-only push delivery status
