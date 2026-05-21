# Role Visibility Audit

**Date:** 2026-05-03  
**Scope:** Three specific questions about internal staff transaction visibility, /dashboard, and outsourced file routing. Read-only — no code changes. Direct quotes throughout.

---

## 1. How internal staff (admin, sales_progressor) see transactions today

### The query

Every call path that lists transactions for the `/dashboard` page goes through this single function:

**File:** `lib/services/transactions.ts` lines 6–21:

```typescript
export async function listTransactions(
  agencyId: string,
  agentUserId?: string,
  opts?: { allAgentFiles?: boolean; firmName?: string | null }
) {
  const now = new Date();
  let whereClause: Record<string, unknown>;
  if (opts?.allAgentFiles) {
    whereClause = opts.firmName
      ? { agencyId, agentUser: { firmName: opts.firmName } }
      : { agencyId, agentUserId: { not: null } };
  } else if (agentUserId) {
    whereClause = { agencyId, agentUserId };
  } else {
    whereClause = { agencyId, progressedBy: "progressor" };
  }
  const transactions = await prisma.propertyTransaction.findMany({
    where: whereClause,
    ...
  });
```

The `/dashboard` page calls it at line 26:

**File:** `app/dashboard/page.tsx` line 26:

```typescript
listTransactions(session.user.agencyId),
```

No other arguments — no `agentUserId`, no `opts`. The branch taken is the final `else`:

```typescript
whereClause = { agencyId, progressedBy: "progressor" };
```

### What `agencyId` is for internal staff

**File:** `lib/auth.ts` JWT callback:

```typescript
token.agencyId = (user as { agencyId: string | null }).agencyId ?? "";
```

Internal staff (`admin`, `sales_progressor`) have `agencyId = null` in the database (confirmed by live DB query in `ROLE_AUDIT_RAW.md`). `null ?? ""` resolves to `""`. So `session.user.agencyId` is the empty string `""` for internal staff.

### The resulting query

The Prisma query becomes:

```typescript
prisma.propertyTransaction.findMany({
  where: { agencyId: "", progressedBy: "progressor" },
})
```

No `PropertyTransaction` row has `agencyId = ""`. All transactions belong to real agencies with CUID values. This query returns **zero rows**.

### Is there any bypass?

`listTransactions` has no conditional that checks whether `agencyId` is empty and falls back to a cross-agency query. There is no `if (!agencyId) { return prisma.propertyTransaction.findMany({ where: { progressedBy: "progressor" } }) }` branch. The `agencyId` parameter is always passed directly to the `where` clause.

No other function is called from `/dashboard` that might show transactions to internal staff through a different path.

**Conclusion: Internal staff (admin, sales_progressor) with `agencyId = null` currently see zero transactions on the dashboard. This is not a partial implementation — the code path produces an empty result by construction. No cross-agency visibility mechanism exists.**

### Is there an "assignedStaffId" or similar field on PropertyTransaction?

**File:** `prisma/schema.prisma` lines 130–165:

```prisma
model PropertyTransaction {
  id                           String            @id @default(cuid())
  propertyAddress              String
  status                       TransactionStatus @default(active)
  agencyId                     String
  assignedUserId               String?           // <-- this field
  agentUserId                  String?
  progressedBy                 ProgressedBy      @default(progressor)
  serviceType                  ServiceType       @default(self_managed)
  ...

  assignedUser               User?   @relation("AssignedUser", fields: [assignedUserId], references: [id])
  agentUser                  User?   @relation("AgentFiles",   fields: [agentUserId],   references: [id])
  ...
}
```

`assignedUserId String?` exists and is the field intended to link a transaction to a specific internal staff member. The relation is named `"AssignedUser"`.

**However**, `assignedUserId` is not used in any query that would allow internal staff to find transactions assigned to them. `listTransactions` does not filter by `assignedUserId` at all — it uses `agencyId` and `progressedBy` only. The field stores a value but no query reads it to show that internal user a list of their assigned files.

---

## 2. The /dashboard route for internal staff

### Route existence

**File:** `app/dashboard/page.tsx` — exists. There is no `app/dashboard/layout.tsx`.

### Auth check

Line 21:

```typescript
const session = await requireSession();
```

`requireSession` (`lib/session.ts` lines 10–14):

```typescript
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session;
}
```

**No role check on this route.** Any authenticated user who reaches it gets the page. Middleware prevents `negotiator` and `director` from reaching it (they are redirected to `/agent/hub`). `admin`, `sales_progressor`, `viewer`, and `superadmin` all reach `/dashboard`.

### Layout component

**File:** `components/layout/AppShell.tsx` — used by `/dashboard` at line 44:

```typescript
<AppShell session={session} activePath="/dashboard" taskCount={...} todoCount={...}>
```

`AppShell` is distinct from the agent shell (`AgentShell`). It is not used anywhere in `/agent/*`. The agent routes use `AgentShell` (`components/layout/AgentShell.tsx`).

### Brand and visual treatment

**File:** `components/layout/AppShell.tsx` lines 54–60:

```typescript
{/* Fixed photo backdrop — viewport-level so backdrop-filter on glass cards can sample it */}
<div className="fixed inset-0 -z-10" style={{
  background: "linear-gradient(rgba(8,12,25,0.52), rgba(6,10,22,0.58)), url('/hero-bg.jpg') center center / cover no-repeat",
}} />

<aside className="glass-sidebar w-56 flex-shrink-0 flex flex-col border-r border-white/10 fixed top-0 left-0 h-screen overflow-y-auto"
       style={{ boxShadow: "var(--shadow-sidebar)", zIndex: 10 }}>
```

Dark photo backdrop (`hero-bg.jpg`) with a near-black gradient overlay (`rgba(8,12,25,0.52)` to `rgba(6,10,22,0.58)`). Glass sidebar using `glass-sidebar` utility class. This is a separate visual system from the agent shell.

### Nav items for each role (from AppShell lines 36–49)

```typescript
const isAdmin = session.user.role === "admin";
const isSuperAdmin = session.user.role === "superadmin";

const navItems = [
  { href: "/dashboard",        label: "Dashboard"       },
  { href: "/tasks",            label: "Work Queue"      },
  { href: "/todos",            label: "To-Do"           },
  { href: "/completing",       label: "Completing"      },
  { href: "/analytics",        label: "Analytics"       },
  { href: "/reports",          label: "Reports"         },
  { href: "/solicitors",       label: "Solicitors"      },
  { href: "/comms",            label: "Comms"           },
  // "Not Our Files" omitted for sales_progressor:
  ...(session.user.role !== "sales_progressor" ? [{ href: "/not-our-files", label: "Not Our Files" }] : []),
  { href: "/transactions/new", label: "New Transaction" },
  // "Admin" only for admin:
  ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  // "Command" only for superadmin:
  ...(isSuperAdmin ? [{ href: "/command/overview", label: "Command" }] : []),
];
```

Differences by role visible in the nav:
- `sales_progressor`: no "Not Our Files", no "Admin"
- `admin`: has "Admin", has "Not Our Files"
- `superadmin`: has "Command", has "Not Our Files", no "Admin"
- `viewer`: has "Not Our Files", no "Admin", no "Command"

---

## 3. Outsourced file routing

### serviceType field — confirmed values

**File:** `prisma/schema.prisma` lines 120–123 and 138:

```prisma
enum ServiceType {
  self_managed
  outsourced
}

model PropertyTransaction {
  ...
  serviceType  ServiceType  @default(self_managed)
  ...
}
```

Two values: `self_managed` and `outsourced`. Default is `self_managed`.

### What changes when serviceType = "outsourced"

**Nothing changes about who can access the transaction at the query level.**

`listTransactions` does not branch on `serviceType`. A transaction with `serviceType = "outsourced"` is returned by exactly the same `{ agencyId, progressedBy: "progressor" }` query as a `self_managed` one.

The only place `serviceType` affects displayed content is the unassigned-files widget on `/dashboard` (`app/dashboard/page.tsx` lines 39–41):

```typescript
const unassignedFiles = transactions.filter(
  (t) => t.serviceType === "outsourced" && t.assignedUser === null && t.status === "active"
);
```

This is client-side filtering of the already-fetched `transactions` array. It highlights outsourced files with no `assignedUserId` yet. Since `transactions` is empty for internal staff (see section 1), this widget also produces nothing for them.

`serviceType` is also used in `lib/command/scope.ts` (lines 24–35) for analytics/metrics scoping in the Command Centre, and in `lib/services/agent.ts` for counting purposes. Neither of those paths grants access to transaction rows.

### Does any field link a transaction to a specific sales_progressor?

**Yes: `assignedUserId String?` on PropertyTransaction** (schema line 135, quoted in full in section 1).

The relation:
```prisma
assignedUser  User?  @relation("AssignedUser", fields: [assignedUserId], references: [id])
```

This field is intended to record which internal staff member is handling an outsourced file. It is populated by the assignment UI on the unassigned-files widget.

**However**, no query uses `assignedUserId` to build a list of files for an internal staff member. There is no function equivalent to `listTransactions` that does:

```typescript
prisma.propertyTransaction.findMany({
  where: { assignedUserId: session.user.id },
})
```

The field is written (when a file is assigned) but never read to scope a staff member's dashboard view.

### Summary of what is and is not built

| Capability | Status |
|---|---|
| `serviceType` field on schema | **Built** |
| `assignedUserId` field on schema | **Built** |
| UI to assign an outsourced file to a staff member | **Built** (unassigned-files widget on /dashboard) |
| Query that shows an internal staff member their assigned files | **Not built** |
| Cross-agency transaction list for internal staff | **Not built** |
| Any agencyId bypass for internal staff in listTransactions | **Not built** |

**The fields exist. The assignment UI exists. The read path — the query that shows an internal staff member the files assigned to them — does not exist.**
