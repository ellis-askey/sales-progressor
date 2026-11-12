# Outsourced Workflow Current-State Audit

**Date:** 2026-05-03  
**Scope:** Read-only. Maps every piece of the outsourced workflow — agent side, admin notification, assignment, and staff read path — with direct code quotes and status. No fixes proposed.

---

## 1. The "send to progressor" action from the agent side

### UI button — where and what

**File:** `components/transactions/NewTransactionForm.tsx` lines 1146–1174:

```tsx
{/* Who progresses? — agents only */}
{isAgent && (
  <div>
    <h2 className="glass-section-label text-slate-900/40 mb-3">Who will progress this file?</h2>
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => setProgressedBy("agent")}
        className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all text-left ${
          progressedBy === "agent"
            ? "border-emerald-400 bg-emerald-50/60 text-emerald-700"
            : "border-white/30 text-slate-900/50 hover:border-white/50"
        }`}
      >
        Self-progress
        <p className="text-xs font-normal text-slate-900/40 mt-0.5">You manage this file yourself</p>
      </button>
      <button
        type="button"
        onClick={() => setProgressedBy("progressor")}
        className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all text-left ${
          progressedBy === "progressor"
            ? "border-blue-400 bg-blue-50/60 text-blue-700"
            : "border-white/30 text-slate-900/50 hover:border-white/50"
        }`}
      >
        Send to progressor
        <p className="text-xs font-normal text-slate-900/40 mt-0.5">Hand off to the progression team</p>
      </button>
    </div>
  </div>
)}
```

`isAgent` is set at line 371:

```tsx
const isAgent = userRole === "negotiator" || userRole === "director";
```

Default state is `"agent"` (line 373):

```tsx
const [progressedBy, setProgressedBy] = useState<"progressor" | "agent">("agent");
```

This toggle is **only rendered for agents** (`{isAgent && ...}`). The `NewTransactionForm` is used at:
- `app/agent/transactions/new/page.tsx` — receives `userRole={session.user.role}` (negotiator or director)

Internal staff (`admin`, `sales_progressor`) do not see this toggle — when they create a transaction via `/transactions/new`, the server action forces `progressedBy: "progressor"` regardless (line 42 of `app/actions/transactions.ts`):

```typescript
const resolvedProgressedBy = isAgent ? input.progressedBy : "progressor";
```

### What the server action does on submit

**File:** `app/actions/transactions.ts` lines 40–48:

```typescript
const session = await requireSession();
const isAgent = session.user.role === "negotiator" || session.user.role === "director";
const resolvedProgressedBy = isAgent ? input.progressedBy : "progressor";

const tx = await createTransaction({
  propertyAddress: input.propertyAddress,
  agencyId: session.user.agencyId,
  assignedUserId: isAgent ? undefined : session.user.id,
  agentUserId: isAgent ? session.user.id : null,
  progressedBy: resolvedProgressedBy,
  ...
```

When an agent picks "Send to progressor":
- `resolvedProgressedBy` = `"progressor"`
- `assignedUserId` = `undefined` (explicitly left null — see commit `bf429e1`)
- `agentUserId` = agent's user id

**File:** `lib/services/transactions.ts` lines 440–441 (createTransaction):

```typescript
progressedBy: input.progressedBy ?? "progressor",
serviceType: (input.progressedBy ?? "progressor") === "agent" ? "self_managed" : "outsourced",
```

So `progressedBy: "progressor"` → `serviceType: "outsourced"` automatically. The agent does not set `serviceType` directly; it is derived at write time.

**Additional validation:** When `progressedBy === "progressor"`, vendor and purchaser contact details (phone or email) are required before submit. The form blocks submission without them (`contactMethodsValid` check, line 848).

### No notification triggered on file creation

Nothing in `createTransactionAction` (or the underlying `createTransaction` service) sends an email, push notification, or creates any in-app alert when `progressedBy === "progressor"`. There is no "ping the admin" code path at file creation.

---

## 2. The notification to admin / "popup"

### Search results

Searched for: `notification`, `AlertDialog`, `Modal`, `popup`, `banner`, `unassigned.*email`, `outsourc.*email`, `notify.*admin` across `app/`, `lib/`.

**No notification mechanism exists** for when a file is submitted as outsourced. Specific findings:

- `app/actions/transactions.ts` — `createTransactionAction` sends no email on outsourced file creation
- `lib/services/portal.ts` line 185: comment reads `// No email — the portal bell on the dashboard handles this notification` — this comment refers to portal milestone confirmations, not outsourced file creation
- `lib/emails/retention/index.ts` line 9: references a `send_to_us_drop_21d` retention email — this is a churn-prevention email for when an outsourced customer goes quiet (21 days), not an inbound assignment notification

The only UI element that responds to outsourced files needing assignment is the amber "unassigned files" banner on `/dashboard` (Section 3 below). That banner is reactive to the transaction list, not a pushed notification.

**Most likely explanation for the user's memory of "a popup":** The amber banner at the top of `/dashboard` would have been visible when the founder's admin account shared the Hartwell `agencyId` (as configured in the seed). In that configuration, the transaction list was not empty and the banner rendered as expected. As production evolved to internal staff with `agencyId = null`, the banner stopped rendering — but the banner itself is still built and functionally correct.

---

## 3. The unassigned-files widget on /dashboard

### Where it lives

**File:** `app/dashboard/page.tsx` lines 39–83.

### How the list is built

```typescript
const unassignedFiles = transactions.filter(
  (t) => t.serviceType === "outsourced" && t.assignedUser === null && t.status === "active"
);
```

This is client-side filtering of the already-fetched `transactions` array. The upstream fetch (line 26):

```typescript
listTransactions(session.user.agencyId),
```

For internal staff with `agencyId = ""`, this produces zero rows (confirmed by previous audit). `unassignedFiles` is therefore always `[]` for internal staff.

### What the widget renders when unassignedFiles is non-empty

```tsx
{unassignedFiles.length > 0 && (
  <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 px-5 py-4">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
      <p className="text-sm font-semibold text-amber-800">
        {unassignedFiles.length} file{unassignedFiles.length !== 1 ? "s" : ""} awaiting progressor assignment
      </p>
    </div>
    <div className="space-y-2">
      {unassignedFiles.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-4 bg-white/60 rounded-xl px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900/80 truncate">{t.propertyAddress}</p>
            <p className="text-xs text-slate-900/40 mt-0.5">
              {t.agentUser?.name ? `Submitted by ${t.agentUser.name}` : "Agent submission"}
            </p>
          </div>
          <Link
            href={`/transactions/${t.id}`}
            className="flex-shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors whitespace-nowrap"
          >
            Assign →
          </Link>
        </div>
      ))}
    </div>
  </div>
)}
```

The widget is **fully built**. It renders an amber alert strip listing unassigned outsourced files with an "Assign →" link to `/transactions/{id}`. It would work correctly if `transactions` were non-empty.

**Status: BUILT-BUT-BROKEN** — the widget code is correct but unreachable because the upstream `listTransactions("")` returns zero rows for internal staff.

---

## 4. The assignment action

### AssignControl UI component

**File:** `components/transaction/AssignControl.tsx` — full file, 78 lines.

It renders inline in the transaction detail page's "Assigned to" meta field. On click of "Assign" or "Change", it shows a `<select>` dropdown populated by fetching `/api/agency/users`:

```tsx
useEffect(() => {
  if (editing && users.length === 0) {
    fetch("/api/agency/users")
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {});
  }
}, [editing, users.length]);
```

When saved, it calls `assignUserAction`:

```tsx
function save() {
  setSaving(true);
  setEditing(false);
  startTransition(async () => {
    try {
      await assignUserAction(transactionId, selected || null);
    } finally {
      setSaving(false);
    }
  });
}
```

### Where AssignControl is rendered

**File:** `app/transactions/[id]/page.tsx` lines 258–263:

```tsx
<MetaField label="Assigned to">
  <AssignControl
    transactionId={transaction.id}
    currentAssigneeId={transaction.assignedUserId ?? null}
    currentAssigneeName={transaction.assignedUser?.name ?? null}
  />
</MetaField>
```

This is the **internal staff** transaction detail page (`AppShell`), not the agent page. It is always rendered — there is no `serviceType === "outsourced"` guard around it. Any transaction loaded on `/transactions/[id]` shows the AssignControl.

**The problem:** `app/transactions/[id]/page.tsx` line 49:

```typescript
getTransaction(id, session.user.agencyId),
```

`getTransaction` (lib/services/transactions.ts line 103):

```typescript
where: { id, agencyId },
```

For internal staff with `agencyId = ""`, this query returns null → `notFound()` → 404 page. Internal staff cannot reach the transaction detail page at all, so AssignControl is inaccessible to them.

### The `/api/agency/users` endpoint — broken for internal staff

**File:** `app/api/agency/users/route.ts`:

```typescript
const users = await prisma.user.findMany({
  where: {
    agencyId: session.user.agencyId,
    role: { in: ["sales_progressor", "admin"] },
  },
  select: { id: true, name: true, role: true },
  orderBy: { name: "asc" },
});
```

This queries `agencyId: session.user.agencyId`. For internal staff (`agencyId = ""`), the query becomes `WHERE agencyId = ''` — which matches no users (internal staff have `agencyId = null` in the DB, not `""`). The endpoint returns an empty array. Even if internal staff could reach the UI, the dropdown would be empty.

### The assignUserAction server action — broken for internal staff

**File:** `app/actions/transactions.ts` lines 297–321:

```typescript
export async function assignUserAction(transactionId: string, assignedUserId: string | null) {
  const session = await requireSession();
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { assignedUserId: assignedUserId || null },
  });

  const assignee = assignedUserId
    ? await prisma.user.findFirst({ where: { id: assignedUserId, agencyId: session.user.agencyId }, select: { name: true } })
    : null;
  await logActivity(
    transactionId,
    assignee
      ? `${session.user.name} assigned file to ${assignee.name}`
      : `${session.user.name} unassigned file`,
    session.user.id
  );

  revalidateTx(transactionId);
}
```

Two `agencyId: session.user.agencyId` checks:
1. Line 300: transaction ownership check — fails for internal staff (returns null → "Transaction not found")
2. Line 311: assignee verification — also fails (no user with `agencyId = ""`)

**The action also writes no `assignedAt` or `assignedByUserId` field** — only `assignedUserId` is written. There are no such fields on the schema.

---

## 5. The post-assignment view (the missing read path)

### What query would be needed

For a `sales_progressor` with `assignedUserId` set on transactions, the query would need to be:

```typescript
prisma.propertyTransaction.findMany({
  where: { assignedUserId: session.user.id },
})
```

Or for an admin seeing all internal files across all agencies:

```typescript
prisma.propertyTransaction.findMany({
  where: { progressedBy: "progressor" },  // no agencyId filter
})
```

### Confirmation: no such query exists

The only place `assignedUserId` appears in queries is as a **write** target (in `assignUserAction` and `createTransaction`). It is never used in a `findMany` or `findFirst` to build a list of files for an internal staff member.

### All queries that DO exist on `/dashboard`

**File:** `app/dashboard/page.tsx` lines 25–33:

```typescript
const [transactions, counts, taskCounts, forecastMonths, postExchangeGroups, todoCount, attentionFlags] = await Promise.all([
  listTransactions(session.user.agencyId),
  countTransactionsByStatus(session.user.agencyId),
  getWorkQueueCounts(session.user.agencyId, session.user.id).catch(() => null),
  getExchangeForecast(session.user.agencyId).catch(() => []),
  getExchangedNotCompleting(session.user.agencyId).catch(() => []),
  countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  getActiveFlags(session.user.agencyId).catch(() => []),
]);
```

Every single query passes `session.user.agencyId`. For internal staff this is `""`. Every query returns zero/empty for internal staff.

**File:** `lib/services/transactions.ts` lines 6–21 — the `listTransactions` where-clause for the no-opts, no-agentUserId path:

```typescript
whereClause = { agencyId, progressedBy: "progressor" };
```

No branch that checks for `agencyId === ""` and falls back to a cross-agency query. None exists.

---

## 6. Comms and milestones from internal staff

### Comms actions

**File:** `app/actions/comms.ts`:

`addNoteAction`:
```typescript
await createCommunicationRecord({
  transactionId,
  type: "internal_note",
  contactIds: [],
  content,
  createdById: session.user.id,
  agencyId: session.user.agencyId,  // line 21 — passes ""
});
```

`logCommAction`:
```typescript
await createCommunicationRecord({
  ...
  agencyId: session.user.agencyId,  // line 49 — passes ""
});
```

`createCommunicationRecord` (`lib/services/comms.ts` lines 46–49):
```typescript
where: { id: transactionId, agencyId },
```

This lookup uses `agencyId: ""` — the transaction's real agencyId won't match, so the guard fails. **Internal staff cannot add notes or log comms.**

`deleteCommunicationRecord` (`lib/services/comms.ts` line 223–225):
```typescript
export async function deleteCommunicationRecord(id: string, agencyId: string) {
  ...
  where: { id, transaction: { agencyId } },
```

Same issue — delete also checks `agencyId`.

### Milestone confirmation

**File:** `app/actions/milestones.ts` line 50:

```typescript
const tx = await prisma.propertyTransaction.findFirst({
  where: { id: input.transactionId, agencyId: session.user.agencyId },
  select: { id: true, propertyAddress: true },
});
if (!tx) throw new Error("Transaction not found");
```

Seven occurrences of this guard in `app/actions/milestones.ts` (lines 50, 245, 274, 300, 314, 348, 404). All throw `"Transaction not found"` for internal staff. **Internal staff cannot confirm, reverse, or update any milestone.**

### Summary of blocks

Every action that modifies transaction data checks `agencyId: session.user.agencyId` in its ownership lookup. Since internal staff have `agencyId = ""`, every such check fails. This is not a partial block — it is a complete block on all write operations for internal staff on any transaction belonging to a real agency.

---

## 7. Historical clue hunt

### Commits mentioning the outsourced workflow (chronological, most relevant):

| Hash | Date | Message |
|---|---|---|
| `e06a63c` | 2026-04-25 | **Add service type toggle to Quick Add; require contact method when outsourcing** — added "Who progresses?" toggle; `saveDraftAction` and `promoteDraftAction` now accept `progressedBy`; serviceType derived from it |
| `177d055` | 2026-04-25 | **Move service type to PropertyHero pills, add referral checkbox to new transaction form** — badges moved; service type visible on file view |
| `47a94a8` | 2026-04-25 | **Add service type badges and negotiator filter to agent dashboard** — visual indication of serviceType on agent side |
| `f60174a` | 2026-04-26 | **Remove Quick Add, rename nav, fix new-file loading delay** — removed QuickAddForm (which also had the `progressedBy` toggle); now all creation goes through the full form |
| `bf429e1` | 2026-04-27 | **Fix FK constraint on transaction create — agents must not set assignedUserId** — changed `assignedUserId` for agents from a broken expression to explicit `null` |
| `0223586` | 2026-04-29 | **Self-progressed fee, assigned-to fix, dismissible banners** — fixed "Assigned to" display label for self_managed files; threaded `serviceType` into `TransactionSidebar` from both page routes |

### Key observation from git history

There is **no commit that removes a notification or popup for the admin side**. The unassigned-files amber banner has been present since it was first added, but there was never a separate push notification or modal built for when an outsourced file arrives. The workflow was always: agent submits → banner appears on `/dashboard` if admin can see that agency's files.

The "popup" the user recalls was the **amber banner on `/dashboard`**, which would have been visible when the founder's admin account had the Hartwell `agencyId` (matching the seed). It rendered correctly in that configuration. When production moved to `agencyId = null` for internal staff, the banner's upstream data source (`listTransactions("")`) returned empty, so the banner silently stopped appearing.

There was also a `QuickAddForm` component (removed in `f60174a`) that had the `progressedBy` toggle — this is the "Quick Add" the user may remember as the "send to us" flow from the agent side. It was removed on 2026-04-26 in favour of the full form.

---

## 8. Summary table

| Piece | Status | Evidence |
|---|---|---|
| UI to mark file as outsourced (agent side) | **BUILT** | `components/transactions/NewTransactionForm.tsx` lines 1146–1174; `{isAgent && ...}` guard; "Send to progressor" button |
| `serviceType = "outsourced"` written on submit | **BUILT** | `lib/services/transactions.ts` line 441: `serviceType: progressedBy === "agent" ? "self_managed" : "outsourced"` |
| `assignedUserId = null` at creation | **BUILT** | `app/actions/transactions.ts` line 47: `assignedUserId: isAgent ? undefined : session.user.id` (for agents: undefined → null) |
| Notification to admin when file needs assignment | **NOT BUILT** | No email, toast, push, or modal fires on outsourced file creation. Searched entire `app/` and `lib/`. |
| Unassigned-files amber banner on `/dashboard` | **BUILT-BUT-BROKEN** | `app/dashboard/page.tsx` lines 39–83; widget code is correct; unreachable because `listTransactions("")` returns empty for internal staff |
| "Assign →" link in banner → `/transactions/{id}` | **BUILT-BUT-BROKEN** | `app/dashboard/page.tsx` line 74; link is correct; destination page 404s for internal staff because `getTransaction(id, "")` returns null |
| Assignment UI (AssignControl dropdown) | **BUILT-BUT-BROKEN** | `components/transaction/AssignControl.tsx` full file; only rendered on `app/transactions/[id]/page.tsx` which is inaccessible to internal staff (404) |
| `/api/agency/users` — lists staff for dropdown | **BUILT-BUT-BROKEN** | `app/api/agency/users/route.ts`; queries `agencyId: session.user.agencyId`; returns empty array for internal staff (agencyId = "") |
| `assignUserAction` — writes assignedUserId | **BUILT-BUT-BROKEN** | `app/actions/transactions.ts` lines 297–321; ownership check `where: { id, agencyId: session.user.agencyId }` fails for internal staff; throws "Transaction not found" |
| Read query: "show me my assigned files" | **NOT BUILT** | No `findMany({ where: { assignedUserId: session.user.id } })` exists anywhere in the codebase |
| Read query: "show admin all internal files" | **NOT BUILT** | `listTransactions` always requires `agencyId` in where clause; no cross-agency path exists |
| Internal staff can access `/transactions/{id}` | **BROKEN** | `app/transactions/[id]/page.tsx` line 49: `getTransaction(id, session.user.agencyId)`; returns null → `notFound()` → 404 |
| Internal staff can add comms on a file | **BROKEN** | `app/actions/comms.ts` lines 21, 49; `createCommunicationRecord` checks `where: { id: transactionId, agencyId: "" }` → fails |
| Internal staff can confirm milestones | **BROKEN** | `app/actions/milestones.ts` lines 50, 245, 274, 300, 314, 348, 404; all check `agencyId: session.user.agencyId` → throws "Transaction not found" |

### Root cause of all BROKEN items

A single root cause: `session.user.agencyId === ""` for internal staff (null in DB → coerced to `""` in JWT). Every ownership check uses `agencyId: session.user.agencyId` in its Prisma `where` clause. Transactions belong to real agencies with CUID `agencyId` values. `"" !== realAgencyId` → all lookups fail.

### What IS working end-to-end

The agent-side creation flow is fully functional:
1. Agent picks "Send to progressor" on the new transaction form
2. `serviceType = "outsourced"`, `progressedBy = "progressor"`, `assignedUserId = null` are correctly persisted
3. Agent can see the service type badge on their dashboard and file view
4. `assignedUser` shows "Unassigned" on the agent's file view

The rest of the workflow — admin receives notification, admin assigns staff member, staff member sees their files — is entirely on the internal staff side and is completely non-functional due to the `agencyId = ""` problem.
