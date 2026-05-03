# Package D — Outsourced Workflow Fix

**Status:** Spec — pre-build
**Owner:** Founder
**Authored:** 2026-05-03
**Source of truth:** This document. CC must reference this file before any in-scope decision. Anything not in this document is OUT OF SCOPE.

**Prerequisite reading:** `docs/OUTSOURCED_WORKFLOW_AUDIT.md` (the full current-state audit) and `docs/ROLE_VISIBILITY_AUDIT.md`.

---

## 1. Goal

Fix the broken outsourced workflow so that:

- Internal sales progressors (`sales_progressor` role) see the files assigned to them
- The founder admin (`admin` role) sees every transaction across the platform, filterable by service type and assigned progressor
- The amber banner on `/dashboard` correctly surfaces unassigned outsourced files for admin attention
- The founder receives an email when a new outsourced file is created that needs assignment
- All comms / milestones / chase actions work correctly when an internal staff member is the actor on a customer agency's transaction

This is a fix, not a rebuild. Most of the workflow is built; one ownership assumption breaks it.

---

## 2. Hard scope boundaries — what is OUT

To prevent scope drift:

- **No new UI components for the agent side.** The "Send to progressor" toggle works.
- **No changes to the assignment dropdown UI** (`AssignControl.tsx`) — it's correct, it just needs to be reachable
- **No new schema beyond what's strictly required** for the notification idempotency. No new tables, no new enums.
- **No bulk reassignment UI.** Admin can reassign one at a time; bulk is future.
- **No internal-staff-side workflow changes** beyond visibility. Internal staff don't get new buttons or new actions — they get to see and use existing buttons.
- **No reporting changes for the Command Centre.** This is about the operating workflow, not analytics.
- **No team management UI** (adding/removing sales_progressor users, role changes). Manual via DB or future package.
- **No SMS, push, or in-app notifications for the new-file alert.** Email only.

If during the build CC identifies something that "would be useful to add" — file in `docs/PACKAGE_D_FOLLOWUPS.md`.

---

## 3. Root cause and fix shape

### Root cause (per audit)

`session.user.agencyId` is `""` for internal staff (because `null ?? ""` in the JWT callback), and every ownership check across the codebase does `where: { agencyId: session.user.agencyId }`. For internal staff this becomes `where: { agencyId: "" }`, which matches no rows.

### Fix shape

Introduce a helper that returns the set of agency IDs accessible to the current session, plus a sentinel for "all agencies." Refactor every ownership check to use this helper.

```typescript
// lib/security/access-scope.ts (new)

type AccessScope =
  | { kind: "agency"; agencyIds: string[] }      // director, negotiator
  | { kind: "assigned"; userId: string }          // sales_progressor
  | { kind: "all" }                                // admin, superadmin

export function getAccessScope(session: Session): AccessScope { ... }
```

Most queries that currently filter by `agencyId` become a function of the access scope:

- `kind: "agency"` — `where: { agencyId: { in: scope.agencyIds } }`
- `kind: "assigned"` — `where: { assignedUserId: scope.userId }`
- `kind: "all"` — no agencyId filter (read-anything for admin)

Helper functions wrap the common patterns so route handlers don't reimplement the logic.

---

## 4. Access model — by role and action

### Read access (who can see what)

| Role | What they see in /agent/* | What they see in /dashboard |
|---|---|---|
| `director` | All transactions of their agency | (redirected to /agent/hub by middleware) |
| `negotiator` | All transactions of their agency | (redirected to /agent/hub by middleware) |
| `sales_progressor` | (no access — no /agent/* surface for them) | Only transactions where `assignedUserId = own` |
| `admin` | (admin can navigate to /agent on behalf of agencies if needed; out of scope for this fix) | All transactions, filterable by service type and assigned progressor |
| `superadmin` | (same as admin for /dashboard purposes) | Same as admin |

### Write access (who can change what)

For any transaction the user can see (per read access table):

| Role | Confirm milestone | Send chase | Add note | Assign progressor | Reassign progressor | Mark service type |
|---|---|---|---|---|---|---|
| `director` | Yes (own agency) | Yes (own agency) | Yes (own agency) | No | No | At creation only |
| `negotiator` | Yes (own agency) | Yes (own agency) | Yes (own agency) | No | No | At creation only |
| `sales_progressor` | Yes (assigned files) | Yes (assigned files) | Yes (assigned files) | No | No | No |
| `admin` | Yes (any) | Yes (any) | Yes (any) | Yes (any) | Yes (any) | Yes (any) |
| `superadmin` | Same as admin | Same as admin | Same as admin | Yes | Yes | Yes |

### Sentinel: scope.kind === "all" means "no agencyId filter"

This is a real privilege escalation, only granted to `admin` and `superadmin`. Routes that use `getAccessScope()` must handle the `"all"` case explicitly — no implicit assumption that an agencyId filter always applies.

---

## 5. Data model — schema additions

### `OutsourcedAssignmentNotification` (new table)

For idempotency on the email notification. Without this, edits to a file could re-fire the notification.

```prisma
model OutsourcedAssignmentNotification {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  transactionId   String   @unique
  sentAt          DateTime
  recipientEmail  String

  transaction     PropertyTransaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  @@index([sentAt])
}
```

One row per transaction, ever. If a row exists, the notification has already fired. Re-fire only if explicitly re-triggered (e.g. transaction was reassigned to unassigned again, future case).

### Optional `assignedAt` field on `PropertyTransaction`

Audit shows `assignedUserId` exists but the audit didn't confirm `assignedAt`. If `assignedAt` doesn't exist, add it. If it does, leave it. Verify in PR 71 (the schema PR).

### No other schema changes

The fix is mostly behavioural. No new enums, no new relations beyond the notification table.

---

## 6. Build sequence — six PRs

### PR 71 (Package D) — Access scope helper + schema

- Verify `assignedAt` field state on PropertyTransaction (add if missing)
- Add `OutsourcedAssignmentNotification` model
- Create `lib/security/access-scope.ts` with `getAccessScope()` helper
- Migration applied to staging only
- No callers refactored yet — just the foundation
- tsc clean

### PR 72 (Package D) — /dashboard queries

- Refactor `listTransactions()` in `lib/services/transactions.ts` to take an `AccessScope` instead of `agencyId: string`
- Update `/dashboard/page.tsx` to pass the access scope
- For `sales_progressor`: shows only assigned files
- For `admin` and `superadmin`: shows all transactions
- The amber banner now correctly renders for admin when unassigned outsourced files exist
- Verify on staging: log in as admin, see all files; log in as sales_progressor (manually assign one transaction first), see that one file

### PR 73 (Package D) — Admin filters

- Verify whether the per-service-type and per-progressor filters already exist on `/dashboard`. If they do, confirm they work with the new query model
- If they don't, build them as a horizontal filter bar at the top of the dashboard:
  - Service type: All / Self-managed / Outsourced (default: All)
  - Assigned to: All / Unassigned / [specific progressor user] (default: All)
- Filters reflected in URL (`?service=outsourced&progressor=xyz`) for shareable / bookmarkable views
- For `sales_progressor` users (who only see their own files), don't show the filter bar — it's irrelevant
- For `admin` users, the filters are visible and functional

### PR 74 (Package D) — Single-transaction access

- Refactor `getTransaction()` in the relevant service to use `AccessScope`
- Update `/transactions/[id]/page.tsx` server-side guard
- For `sales_progressor`: 404 unless `assignedUserId === self`
- For `admin`/`superadmin`: 200, can view any transaction
- For `director`/`negotiator`: 404 unless `agencyId === own`
- AssignControl now reachable when the role permits

### PR 75 (Package D) — Action ownership checks (cross-cutting)

This is the big one. Refactor every server action and API route that currently uses `agencyId: session.user.agencyId` ownership pattern. The audit enumerated the sites; CC must update each:

- `assignUserAction`
- `confirmMilestoneAction`
- `markNotRequiredAction`
- `reverseMilestoneAction`
- `confirmExchangeReconciliationAction`
- `confirmSaleDetailsAction`
- `createCommunicationRecord`
- `/api/agency/users` (special case: returns the list of `sales_progressor` users for admin's assignment dropdown)
- Any other site found during PR — exhaustive search required

Each becomes scope-aware. Test matrix at end of PR:

| Action | director (own agency) | director (other agency) | sales_progressor (assigned) | sales_progressor (not assigned) | admin |
|---|---|---|---|---|---|
| Confirm milestone | ✓ | 403 | ✓ | 403 | ✓ |
| Send chase | ✓ | 403 | ✓ | 403 | ✓ |
| Assign user | 403 (not their role) | 403 | 403 | 403 | ✓ |
| Reassign | 403 | 403 | 403 | 403 | ✓ |

Run this matrix manually on staging before the PR is approved for prod.

### PR 76 (Package D) — Email notification

- New cron job is NOT needed — this is event-driven
- Hook into the transaction creation path: if `serviceType === "outsourced"` AND `assignedUserId === null`, fire the notification
- Use existing `lib/email.ts` SendGrid wrapper
- Recipient: a config constant in `lib/command/config.ts` (`OUTSOURCED_NOTIFICATION_EMAIL`), confirmed with founder in checkpoint
- Subject: `"New outsourced file ready for assignment — [property address]"`
- Body: plain English: who created it (agency name, user name), property address, link to `/dashboard` (where the amber banner lists it)
- Idempotency: write `OutsourcedAssignmentNotification` row before sending; check for existing row first; if exists, skip
- Test: create an outsourced transaction on staging, verify email arrives; create another, verify email arrives; touch the first transaction (e.g. update its status), verify NO duplicate email

---

## 7. Edge cases — pre-decided

### 7a. Transaction reassigned to unassigned

If admin removes the assignment (`assignedUserId` set back to null), the amber banner re-shows it. The notification does NOT re-fire (one notification per transaction lifetime). Admin saw the original; the amber banner is the ongoing surface.

### 7b. Sales_progressor user is deleted/anonymised

Per existing data retention model (PR 54): `User.role` is preserved on anonymisation, name/email redacted. Transactions assigned to a redacted user become orphaned but functional — admin sees the broken assignment in the filter, can reassign. Add to the admin filter: "Assigned to redacted user" as a filter option for cleanup.

### 7c. Service type changed from self-managed to outsourced after creation

If a director/negotiator changes a self-managed file to outsourced after creation:
- `assignedUserId` should become null
- Notification fires (this is a new outsourced file from the system's perspective)
- Amber banner picks it up

If a director/negotiator changes outsourced to self-managed:
- `assignedUserId` cleared
- The previously-assigned sales_progressor loses access
- No notification fires
- The transaction returns to the agency's full control

### 7d. Admin assigns a transaction to themselves

Allowed but unusual. Admin doesn't normally progress files. If they do, they see it both in their "all transactions" view and as an assigned file. No special handling.

### 7e. Two admins (future)

Currently you're the only admin. If a second admin user is added later, both receive the notification email. The notification recipient list is read from a config constant for now (single email); future package handles multi-recipient.

### 7f. Notification email arrives but admin doesn't act

The amber banner is the persistent surface. Admin has unassigned files in their dashboard until they assign them. No reminder cron, no escalation. Add to TODO if it becomes a real problem.

---

## 8. Verification before each ship

### After PR 72

Manual test on staging:
- Log in as admin — see all transactions
- Log in as sales_progressor (after assigning one to them via DB or admin UI) — see only that one
- Log in as director — see only their agency's transactions

### After PR 75

Run the test matrix in §6 PR 75 manually on staging. Document results in the PR description.

### After PR 76

- Create a fresh outsourced transaction on staging
- Confirm email arrives
- Confirm only one email per transaction even after edits
- Confirm idempotency record in `OutsourcedAssignmentNotification`

---

## 9. Manual tasks for founder

These appear in the manual-task appendix at end of build:

- [ ] Confirm `OUTSOURCED_NOTIFICATION_EMAIL` constant value (default suggestion: `inbox@thesalesprogressor.co.uk` — same inbox as content batch)
- [ ] Test the full outsourced flow on staging:
  - Create transaction as director (Whitfield & Hunt, send to progressor)
  - Confirm email arrives at the configured address
  - Log in as admin, confirm amber banner shows the file
  - Assign to a sales_progressor account
  - Log in as that sales_progressor, confirm file appears
  - Confirm a milestone, send a chase, add a note from the sales_progressor account — confirm all work
  - Log back in as director, confirm they can still see the file and any logged comms

---

## 10. Anti-drift rules for CC

1. Re-read this scope document and `docs/OUTSOURCED_WORKFLOW_AUDIT.md` before each PR
2. If something in the codebase looks like it would benefit from a change not in this document — list in `docs/PACKAGE_D_FOLLOWUPS.md`, do not implement
3. PR 75 is cross-cutting and may surface code sites the audit didn't enumerate. Each new site found gets the same scope-aware treatment. Surface the list in the PR description so I can verify nothing was missed
4. Do NOT touch the AgentShell, AppShell, or CommandShell. Visual layout stays as-is
5. Do NOT modify the AssignControl component — it's correct
6. Do NOT change the agent-side "send to progressor" toggle — it's correct
7. The notification email is plain prose, not HTML-heavy template. Match the daily content batch email style for consistency
8. No new env vars unless absolutely required (the audit identified none)

---

## 11. Definition of done

Package D is complete when all of the following are true:

- [ ] An admin (founder) account at `/dashboard` sees every transaction with filters working
- [ ] A `sales_progressor` account at `/dashboard` sees only files assigned to them
- [ ] The amber banner correctly displays unassigned outsourced files
- [ ] Admin can assign and reassign a sales_progressor to any outsourced file
- [ ] An assigned `sales_progressor` can confirm milestones, send chases, add notes on their files
- [ ] A `sales_progressor` cannot access files not assigned to them (404)
- [ ] When a director marks a file as outsourced, the founder receives a notification email
- [ ] The notification email fires once per transaction (idempotent)
- [ ] All migrations applied to staging then prod
- [ ] All tsc checks passing
- [ ] PR 75 test matrix passes manually on staging
- [ ] All edge cases from section 7 handled correctly
- [ ] CC has surfaced any code sites the audit missed and treated them with the same pattern

---

*End of document. Anything claimed to be "in Package D" but not described here is out of scope.*
