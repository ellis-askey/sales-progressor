# Package D — Option A Migration Walkthrough

**Scope:** Fix the 4 broken query functions so internal staff (`admin`, `sales_progressor`) get real data from the existing internal routes. Agent call sites are untouched.

**Files changed:** 4  
**Atomic changes:** 6

Review each change below. Reply approval / change request per item before code lands.

---

## The infrastructure being used

`lib/security/access-scope.ts` (already built, no changes needed):

```ts
// Returns the right scope from session:
// admin/superadmin → { kind: "all" }         → no filter
// sales_progressor → { kind: "assigned", userId }  → assignedUserId = self
// director/negotiator/viewer → { kind: "agency", agencyIds: [agencyId] }  → agencyId filter (unchanged for agents)

getAccessScope(session): AccessScope
scopeTransactionWhere(scope): Prisma.PropertyTransactionWhereInput
scopeOwnershipWhere(scope, transactionId): Prisma.PropertyTransactionWhereInput
```

---

## Change 1 — `getExchangeForecast` signature + where clause

**File:** `lib/services/transactions.ts` (line 328)

**Why it's broken:** Dashboard calls `getExchangeForecast(session.user.agencyId)` with `agencyId = ""` for internal staff → zero results.

**Before (signature):**
```ts
export async function getExchangeForecast(
  agencyId: string,
  agentUserId?: string,
  opts?: { allAgentFiles?: boolean; firmName?: string | null }
): Promise<ForecastMonth[]>
```

**After (signature — add optional 4th param):**
```ts
export async function getExchangeForecast(
  agencyId: string,
  agentUserId?: string,
  opts?: { allAgentFiles?: boolean; firmName?: string | null },
  scope?: AccessScope
): Promise<ForecastMonth[]>
```

**Before (inside the function, lines 329–337):**
```ts
  let agentFilter: Record<string, unknown>;
  if (opts?.allAgentFiles) agentFilter = opts.firmName ? { agentUser: { firmName: opts.firmName } } : { agentUserId: { not: null } };
  else if (agentUserId) agentFilter = { agentUserId };
  else agentFilter = { progressedBy: "progressor" };
  const transactions = await prisma.propertyTransaction.findMany({
    where: {
      agencyId,
      status: "active",
      ...agentFilter,
```

**After (add one line; replace two lines in where):**
```ts
  let agentFilter: Record<string, unknown>;
  if (opts?.allAgentFiles) agentFilter = opts.firmName ? { agentUser: { firmName: opts.firmName } } : { agentUserId: { not: null } };
  else if (agentUserId) agentFilter = { agentUserId };
  else agentFilter = { progressedBy: "progressor" };
  const baseWhere = scope ? scopeTransactionWhere(scope) : { agencyId, ...agentFilter };
  const transactions = await prisma.propertyTransaction.findMany({
    where: {
      ...baseWhere,
      status: "active",
```

**Safety:** Agent callers pass no `scope` → `baseWhere = { agencyId, ...agentFilter }` → existing behaviour exactly preserved. Internal dashboard passes `scope` → `baseWhere = scopeTransactionWhere(scope)` → correct for admin and sales_progressor. The `agentFilter` computation still runs when scope is present but is ignored; harmless.

**New import needed at top of file:**
```ts
import { AccessScope, scopeTransactionWhere } from "@/lib/security/access-scope";
```

---

## Change 2 — `getExchangedNotCompleting` signature + where clause

**File:** `lib/services/transactions.ts` (line 414)

**Why it's broken:** Same pattern — dashboard calls with `agencyId = ""`.

**Before (signature):**
```ts
export async function getExchangedNotCompleting(
  agencyId: string,
  agentUserId?: string,
  opts?: { allAgentFiles?: boolean; firmName?: string | null }
): Promise<PostExchangeGroup[]>
```

**After (signature — add optional 4th param):**
```ts
export async function getExchangedNotCompleting(
  agencyId: string,
  agentUserId?: string,
  opts?: { allAgentFiles?: boolean; firmName?: string | null },
  scope?: AccessScope
): Promise<PostExchangeGroup[]>
```

**Before (lines 423–432):**
```ts
  let agentFilter: Record<string, unknown>;
  if (opts?.allAgentFiles) agentFilter = opts.firmName ? { agentUser: { firmName: opts.firmName } } : { agentUserId: { not: null } };
  else if (agentUserId) agentFilter = { agentUserId };
  else agentFilter = { progressedBy: "progressor" };

  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      agencyId,
      status: "active",
      ...agentFilter,
```

**After:**
```ts
  let agentFilter: Record<string, unknown>;
  if (opts?.allAgentFiles) agentFilter = opts.firmName ? { agentUser: { firmName: opts.firmName } } : { agentUserId: { not: null } };
  else if (agentUserId) agentFilter = { agentUserId };
  else agentFilter = { progressedBy: "progressor" };
  const baseWhere = scope ? scopeTransactionWhere(scope) : { agencyId, ...agentFilter };

  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      ...baseWhere,
      status: "active",
```

**Safety:** Identical pattern to Change 1. Agent callers pass no `scope` → unchanged. (Import already added by Change 1.)

---

## Change 3 — `getCompletingFilesDetailed` signature + where clause

**File:** `lib/services/transactions.ts` (line 510)

**Why it's broken:** `/completing` page calls with `agencyId = ""`. Unlike Changes 1–2, there are no agent callers — this function is internal-only — so we can replace the `agencyId` param entirely.

**Before (signature):**
```ts
export async function getCompletingFilesDetailed(agencyId: string): Promise<PostExchangeGroupDetailed[]>
```

**After (signature):**
```ts
export async function getCompletingFilesDetailed(scope: AccessScope): Promise<PostExchangeGroupDetailed[]>
```

**Before (where clause, line 520–527):**
```ts
  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      agencyId,
      status: "active",
      progressedBy: "progressor",
      milestoneCompletions: {
        some: { state: "complete", milestoneDefinitionId: { in: exchangeDefIds } },
      },
    },
```

**After:**
```ts
  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      ...scopeTransactionWhere(scope),
      status: "active",
      progressedBy: "progressor",
      milestoneCompletions: {
        some: { state: "complete", milestoneDefinitionId: { in: exchangeDefIds } },
      },
    },
```

**Note on `progressedBy: "progressor"`:** Kept intentionally. The completing page is for outsourced files (those Sales Progressor is handling), so `progressedBy: "progressor"` is the correct semantic filter for all internal staff roles. Admin sees all outsourced post-exchange files; sales_progressor sees only their assigned ones (enforced by `scopeTransactionWhere` returning `{ assignedUserId: userId }`). Self-managed files don't appear here regardless of role.

**Safety:** No agent callers exist for this function, confirmed by codebase search. Breaking change to the signature is safe. (Import already added by Change 1.)

---

## Change 4 — `getChaseTasksForTransaction` ownership guard

**File:** `lib/services/reminders.ts` (line 153)

**Why it's broken:** Ownership guard uses `{ id, agencyId }` — fails for internal staff. No current callers exist in the codebase, but this function will be wired up in Workstream 3 when the internal transaction detail is polished.

**Before (signature + guard):**
```ts
export async function getChaseTasksForTransaction(transactionId: string, agencyId: string) {
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId },
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");
```

**After:**
```ts
export async function getChaseTasksForTransaction(transactionId: string, scope: AccessScope) {
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");
```

**What `scopeOwnershipWhere` returns:**
- admin: `{ id: transactionId }` — can read any transaction
- sales_progressor: `{ id: transactionId, assignedUserId: userId }` — only if assigned
- agent: `{ id: transactionId, agencyId: agencyId }` — same as the existing pattern

**New import needed at top of reminders.ts:**
```ts
import { AccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
```

---

## Change 5 — `app/dashboard/page.tsx` call sites

**File:** `app/dashboard/page.tsx` (lines 34–35)

`getAccessScope` is already imported on line 4 and `scope` is already computed on line 28. Only the two broken call sites need updating.

**Before:**
```ts
    getExchangeForecast(session.user.agencyId).catch(() => []),
    getExchangedNotCompleting(session.user.agencyId).catch(() => []),
```

**After:**
```ts
    getExchangeForecast(session.user.agencyId, undefined, undefined, scope).catch(() => []),
    getExchangedNotCompleting(session.user.agencyId, undefined, undefined, scope).catch(() => []),
```

**Note:** `agencyId` is passed as the first arg to preserve the existing TypeScript call shape (the param is still in the signature). The `undefined` placeholders for `agentUserId` and `opts` are explicit so `scope` lands in the correct 4th position. For internal staff, `agencyId` is `""` but the `scope` 4th arg overrides it — `""` is never used in the query. For agents (if this function were called from the dashboard for an agent — which it isn't today), `scope` would be `undefined` and `agencyId` would apply as before.

---

## Change 6 — `app/completing/page.tsx` call site

**File:** `app/completing/page.tsx` (line 3 and lines 100–102)

**Before (imports):**
```ts
import { requireSession } from "@/lib/session";
import { getCompletingFilesDetailed } from "@/lib/services/transactions";
```

**After (imports — add getAccessScope):**
```ts
import { requireSession } from "@/lib/session";
import { getCompletingFilesDetailed } from "@/lib/services/transactions";
import { getAccessScope } from "@/lib/security/access-scope";
```

**Before (data fetching, lines 99–105):**
```ts
export default async function CompletingPage() {
  const session = await requireSession();
  const [groups, taskCounts, todoCount] = await Promise.all([
    getCompletingFilesDetailed(session.user.agencyId),
    getWorkQueueCounts(session.user.agencyId, session.user.id).catch(() => null),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);
```

**After:**
```ts
export default async function CompletingPage() {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const [groups, taskCounts, todoCount] = await Promise.all([
    getCompletingFilesDetailed(scope),
    getWorkQueueCounts(session.user.agencyId, session.user.id).catch(() => null),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);
```

**Note on the two non-Package-D calls:** `getWorkQueueCounts` and `countManualTasksDueToday` still use `session.user.agencyId` — they're likely broken for admin too but are outside Package D scope. They'll show empty for admin until fixed separately. The completing page's primary data (`groups`) will work immediately after this change.

---

## Verification plan

After all 6 changes land:

1. `npx tsc --noEmit` — zero errors
2. **Admin login → `/dashboard`** — forecast strip (exchange forecast) and post-exchange strip show real data (were empty before)
3. **Admin login → `/completing`** — all outsourced post-exchange files visible, grouped by urgency
4. **sales_progressor login (with assigned files) → `/dashboard`** — forecast and post-exchange strips show only their assigned files
5. **sales_progressor login → `/completing`** — only their assigned post-exchange files visible
6. **Agent login (director/negotiator) → `/agent/transactions`** — unchanged, forecast works as before
7. **Agent login → `/agent/transactions/[id]`** — unchanged, all tabs work as before

---

## What this does NOT fix (out of scope, noted for later)

- `getWorkQueueCounts(agencyId, userId)` — likely empty for admin on `/completing` and `/tasks`
- `countManualTasksDueToday(agencyId)` — likely zero for admin
- `getActiveFlags(agencyId)` — empty for admin on `/dashboard`
- `runReminderEngine()` privilege escalation — Workstream 3 (separate commit)
- Internal transaction detail (`/transactions/[id]`) data fetching — Workstream 3
