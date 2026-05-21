# Role Audit — Raw Evidence

**Date:** 2026-05-03  
**Method:** Direct file reads, grep, and live production DB query. No interpretation.  
**Note on previous audit:** The previous `ROLE_ARCHITECTURE_AUDIT.md` claimed "In dev/seed, internal staff have agencyId. Production model for internal SP staff is not yet implemented." The live DB query below contradicts this — see section 3.

---

## 1. Prisma schema: User.role field

**File:** `prisma/schema.prisma`

Exact field declaration (line 56):
```prisma
role            UserRole   @default(viewer)
```

Enum definition (lines 106–113):
```prisma
enum UserRole {
  superadmin
  admin
  sales_progressor
  director
  negotiator
  viewer
}
```

Full User model (lines 49–93):
```prisma
model User {
  id              String     @id @default(cuid())
  name            String
  email           String     @unique
  password        String?
  totpSecret      String?
  totpActivatedAt DateTime?
  role            UserRole   @default(viewer)
  agencyId        String?
  firmName        String?
  progressorId    String?
  clientType      ClientType @default(standard)
  legacyFee       Int?
  phone                String?
  canViewAllFiles      Boolean    @default(false)
  hasSeenAgentWelcome  Boolean    @default(false)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  agency               Agency?               @relation(fields: [agencyId], references: [id])
  progressor           User?                 @relation("ProgressorAgents", fields: [progressorId], references: [id])
  managedAgents        User[]                @relation("ProgressorAgents")
  assignedTransactions PropertyTransaction[] @relation("AssignedUser")
  agentFiles           PropertyTransaction[] @relation("AgentFiles")
  milestoneCompletions MilestoneCompletion[] @relation("CompletedBy")
  chaseTasks           ChaseTask[]
  communications       OutboundMessage[] @relation("CommCreatedBy")
  sentPortalMessages   PortalMessage[]       @relation("PortalMessagesSentBy")

  retentionEmailOptOut    Boolean   @default(false)

  emailVerified        DateTime?
  image                String?
  accounts             Account[]
  sessions             Session[]
  transactionNotes     TransactionNote[]
  createdManualTasks   ManualTask[]       @relation("ManualTaskCreator")
  assignedManualTasks  ManualTask[]       @relation("ManualTaskAssignee")
  createdDomains       VerifiedDomain[]   @relation("DomainCreatedBy")
  verifiedEmails       UserVerifiedEmail[]
  feedbackSubmissions  FeedbackSubmission[]
  agentPushSubscriptions AgentPushSubscription[]
  retentionEmailLogs   RetentionEmailLog[]
  commandPreferences   Json?
}
```

`agencyId String?` — nullable (line 57).

---

## 2. Role checks — grep output

Grep pattern: `role\s*===|role\s*!==|role\s*:.*"|UserRole\.`  
Files: all `.ts` and `.tsx` in the project (excluding `.claude/worktrees/`).

### `superadmin`

```
middleware.ts:40:      if (role !== "superadmin") {
app/command/layout.tsx:16:  if (!session?.user || session.user.role !== "superadmin") {
app/command/(protected)/layout.tsx:28:  if (!session?.user || session.user.role !== "superadmin") {
app/command/setup-2fa/page.tsx:16:  if (!session?.user || session.user.role !== "superadmin") redirect("/dashboard");
app/login/page.tsx:29:    if (session.user.role === "superadmin") redirect("/command/overview");
app/actions/command-centre.ts:12:  if (!session?.user || session.user.role !== "superadmin") redirect("/dashboard");
app/actions/command-preferences.ts:11:  if (!session?.user || session.user.role !== "superadmin") redirect("/dashboard");
app/actions/outbound-log.ts:11:  if (!session?.user || session.user.role !== "superadmin") redirect("/dashboard");
app/actions/draft-posts.ts:11:  if (!session?.user || session.user.role !== "superadmin") {
app/actions/content-topics.ts:10:  if (!session?.user || session.user.role !== "superadmin") {
app/actions/content-engagement.ts:10:  if (!session?.user || session.user.role !== "superadmin") {
app/actions/voice-samples.ts:12:  if (!session?.user || session.user.role !== "superadmin") {
```

### `admin`

```
middleware.ts:160:    if (!isAgentUser && role !== "admin" && pathname.startsWith("/agent")) {
app/admin/page.tsx:16:  if (session.user.role !== "admin") redirect("/dashboard");
app/admin/audit/page.tsx:32:  if (session.user.role !== "admin") redirect("/dashboard");
app/actions/admin.ts:10:  if (session.user.role !== "admin") throw new Error("Admin only");
app/actions/admin.ts:25:  if (session.user.role !== "admin") throw new Error("Admin only");
app/actions/solicitors.ts:11:  if (role !== "director" && role !== "admin") throw new Error("Unauthorised");
components/layout/AppShell.tsx:33:  const isAdmin = session.user.role === "admin";
components/layout/AppShell.tsx:34:  const isSuperAdmin = session.user.role === "superadmin";
```

The middleware line 160 context:
```typescript
// middleware.ts:145–162
const isAgentUser = role === "negotiator" || role === "director";

// Redirect agent users from internal SP transaction pages into the agent shell
if (isAgentUser && pathname.match(/^\/transactions\/[^/]+/)) {
  const id = pathname.split("/")[2];
  return NextResponse.redirect(new URL(`/agent/transactions/${id}`, req.url));
}

// Agent users can only access the agent area, APIs, and portal — nowhere else
const agentAllowed = ["/agent", "/api", "/portal"];
if (isAgentUser && !agentAllowed.some((p) => pathname.startsWith(p))) {
  return NextResponse.redirect(new URL("/agent/hub", req.url));
}

// Non-agent, non-admin users trying to access the agent area → send to SP dashboard
if (!isAgentUser && role !== "admin" && pathname.startsWith("/agent")) {
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
```

The `admin` page queries at lines 19–33:
```typescript
// app/admin/page.tsx
prisma.user.findMany({
  where: { agencyId: session.user.agencyId, role: { not: "negotiator" } },
  ...
}),
prisma.user.findMany({
  where: { agencyId: session.user.agencyId, role: "negotiator" },
  ...
}),
prisma.user.findMany({
  where: { agencyId: session.user.agencyId, role: "sales_progressor" },
  ...
}),
```

### `sales_progressor`

```
prisma/seed.ts:59:    data: { name: "James Okafor", email: "james@hartwellpartners.co.uk", role: UserRole.sales_progressor, agencyId: agency.id, ... }
components/layout/AppShell.tsx:45:    ...(session.user.role !== "sales_progressor" ? [{ href: "/not-our-files", ... }] : []),
app/not-our-files/page.tsx:12:  if (session.user.role === "sales_progressor") {
app/not-our-files/page.tsx:13:    const { redirect } = await import("next/navigation");
app/not-our-files/page.tsx:14:    redirect("/dashboard");
app/admin/page.tsx:30:      where: { agencyId: session.user.agencyId, role: "sales_progressor" },
lib/session.ts:16:  // Use in routes that require an agency-scoped user (admin/sales_progressor have no agencyId)
```

### `director`

```
app/agent/layout.tsx:12:  if (session.user.role !== "negotiator" && session.user.role !== "director") {
middleware.ts:145:    const isAgentUser = role === "negotiator" || role === "director";
app/login/page.tsx:30:    if (session.user.role === "negotiator" || session.user.role === "director") redirect("/agent/hub");
app/agent/dashboard/page.tsx:38:  const isDirector = session.user.role === "director";
app/agent/analytics\page.tsx:125:  const isDirector = session.user.role === "director";
app/agent/analytics-preview\page.tsx:71:  const isDirector = session.user.role === "director";
app/agent/solicitors/page.tsx:12:  const isDirector = session.user.role === "director";
app/agent/settings/page.tsx:14:  const isDirector = session.user.role === "director";
app/agent/transactions/[id]/page.tsx:57:  const isDirectorRole = session.user.role === "director";
app/agent/transactions/[id]/page.tsx:227:  showOurFee={session.user.role === "director"}
app/actions/solicitors.ts:11:  if (role !== "director" && role !== "admin") throw new Error("Unauthorised");
lib/services/agent.ts:23:  const seeAll = user?.role === "director" || user?.canViewAllFiles === true;
components/layout/AgentShell.tsx:27:      { href: "/agent/dashboard", label: role === "director" ? "All Files" : "My Files", Icon: FolderOpen },
components/layout/AgentShell.tsx:40:  const isDirector = role === "director";
components/agent/TeamManagement.tsx:77:  const directors = team.filter((m) => m.role === "director");
components/agent/AnalyticsFilterClient.tsx:46:  {m.name}{m.role === "director" ? " (Director)" : ""}
```

### `negotiator`

```
app/agent/layout.tsx:12:  if (session.user.role !== "negotiator" && session.user.role !== "director") {
middleware.ts:145:    const isAgentUser = role === "negotiator" || role === "director";
app/login/page.tsx:30:    if (session.user.role === "negotiator" || session.user.role === "director") redirect("/agent/hub");
app/api/transactions/route.ts:39:  const isAgent = session.user.role === "negotiator" || session.user.role === "director";
app/actions/transactions.ts:41:  const isAgent = session.user.role === "negotiator" || session.user.role === "director";
components/agent/TeamManagement.tsx:76:  const negotiators = team.filter((m) => m.role === "negotiator");
app/admin/page.tsx:25:      where: { agencyId: session.user.agencyId, role: "negotiator" },
```

### `viewer`

```
middleware.ts:134–143:
    if (
      role === "viewer" &&
      pathname.startsWith("/api/") &&
      MUTATION_METHODS.has(req.method)
    ) {
      return new NextResponse(
        JSON.stringify({ error: "Viewers cannot make changes" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

lib/session.ts:37:  if (session.user.role === "viewer") {
components/admin/AgentFeeManager.tsx:49:  const agents = users.filter((u) => u.role !== "viewer");
```

---

## 3. Live production database records

Query run against `DIRECT_URL` (Supabase, eu-west-1):

```sql
SELECT id, email, name, role, agencyId FROM "User" ORDER BY createdAt LIMIT 10
```

```json
[
  { "id": "cmokcvjr1...", "email": "user_1@example.com", "name": "Ellis Askey",       "role": "admin",           "agencyId": null },
  { "id": "cmokcvjv4...", "email": "user_2@example.com", "name": "Ellis Askey",       "role": "sales_progressor","agencyId": null },
  { "id": "cmokcvk1j...", "email": "user_3@example.com", "name": "Rachel Whitfield",  "role": "director",        "agencyId": "cmokcvjz8..." },
  { "id": "cmokcvk3t...", "email": "user_4@example.com", "name": "Tom Harding",       "role": "negotiator",      "agencyId": "cmokcvjz8..." },
  { "id": "cmokcvkr0...", "email": "user_5@example.com", "name": "James Marlow",      "role": "director",        "agencyId": "cmokcvkol..." },
  { "id": "cmokcvkta...", "email": "user_6@example.com", "name": "Claire Sutton",     "role": "negotiator",      "agencyId": "cmokcvkol..." },
  { "id": "cmolscp4u...", "email": "user_7@example.com", "name": "Danny Bailey",      "role": "director",        "agencyId": "cmokcvjz8..." },
  { "id": "cmom458te...", "email": "user_8@example.com", "name": "Barry Jones",       "role": "director",        "agencyId": "cmokcvjz8..." },
  { "id": "2a83063a-...", "email": "user_9@example.com", "name": "Ellis Askey",       "role": "superadmin",      "agencyId": null }
]
```

Agencies found in the result:

```json
[
  { "id": "cmokcvjz80002g9efnl2ony2n", "name": "Whitfield & Hunt Property" },
  { "id": "cmokcvkol000ng9efe4uex5qy", "name": "Marlow Estates" }
]
```

**Observations from raw data (no interpretation):**

- `admin` → `agencyId: null`
- `sales_progressor` → `agencyId: null`
- `superadmin` → `agencyId: null`
- `director` → `agencyId: <agency-specific id>`
- `negotiator` → `agencyId: <agency-specific id>`
- The production DB contains agencies named "Whitfield & Hunt Property" and "Marlow Estates". The seed file's "Hartwell & Partners" agency is **not present in production**.
- The first 9 production users include no `viewer` records.
- There are 3 users named "Ellis Askey" across `admin`, `sales_progressor`, and `superadmin` roles, each with `agencyId: null`.

---

## 4. /dashboard auth check

**File:** `app/dashboard/page.tsx`

Auth check (lines 21):
```typescript
const session = await requireSession();
```

`requireSession` definition (`lib/session.ts` lines 10–14):
```typescript
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session;
}
```

**No role check.** Any authenticated user who reaches this route gets the page rendered. The middleware (see section 2, middleware lines 154–157) prevents `negotiator` and `director` from reaching it — they are redirected to `/agent/hub`. All other roles (`admin`, `sales_progressor`, `viewer`, `superadmin`) can reach `/dashboard`.

---

## 5. /agent auth check

**File:** `app/agent/layout.tsx`

Full file:
```typescript
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AgentShell } from "@/components/layout/AgentShell";
import { AgentToaster } from "@/components/agent/AgentToaster";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { AgentInstallPrompt } from "@/components/agent/AgentInstallPrompt";
import "./styles/agent-system.css";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.user.role !== "negotiator" && session.user.role !== "director") {
    redirect("/dashboard");
  }
  // ...
}
```

**Gate:** `role !== "negotiator" && session.user.role !== "director"` → redirect to `/dashboard`.  
Only `negotiator` and `director` can pass.

Also enforced in middleware (`middleware.ts` lines 153–157):
```typescript
const agentAllowed = ["/agent", "/api", "/portal"];
if (isAgentUser && !agentAllowed.some((p) => pathname.startsWith(p))) {
  return NextResponse.redirect(new URL("/agent/hub", req.url));
}
```
Where `isAgentUser = role === "negotiator" || role === "director"` (line 145).

Login redirect (`app/login/page.tsx` line 30):
```typescript
if (session.user.role === "negotiator" || session.user.role === "director") redirect("/agent/hub");
```

---

## 6. /command auth check

**File:** `app/command/layout.tsx` (outer layout — wraps all `/command` routes including setup-2fa):
```typescript
export const dynamic = "force-dynamic";

export default async function CommandOuterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
```

**Gate:** `role !== "superadmin"` → redirect to `/dashboard`.

**File:** `app/command/(protected)/layout.tsx` (inner layout — wraps all protected command routes, adds TOTP check):
```typescript
if (!session?.user || session.user.role !== "superadmin") {
  redirect("/dashboard");  // line 28
}
```

Additional TOTP step-up cookie check in this inner layout.

Also enforced in middleware (`middleware.ts` line 40):
```typescript
if (role !== "superadmin") {
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
```

Login redirect (`app/login/page.tsx` line 29):
```typescript
if (session.user.role === "superadmin") redirect("/command/overview");
```

---

## 7. Seed file — every User.create call

**File:** `prisma/seed.ts`

All user creation calls (lines 49–66):
```typescript
const agency = await prisma.agency.create({ data: { name: "Hartwell & Partners" } });

await prisma.user.create({
  data: { name: "Sarah Hartwell", email: "sarah@hartwellpartners.co.uk", role: UserRole.admin, agencyId: agency.id, password: TEST_PASSWORD },
});
await prisma.user.create({
  data: { name: "Ellis Askey", email: "ellisaskey@googlemail.com", role: UserRole.admin, agencyId: agency.id, password: TEST_PASSWORD },
});
await prisma.user.create({
  data: { name: "Ellis Askey", email: "ellis@thesalesprogressor.co.uk", role: UserRole.admin, agencyId: agency.id, password: TEST_PASSWORD },
});
await prisma.user.create({
  data: { name: "James Okafor", email: "james@hartwellpartners.co.uk", role: UserRole.sales_progressor, agencyId: agency.id, password: TEST_PASSWORD },
});
await prisma.user.create({
  data: { name: "Emily Chen", email: "emily@hartwellpartners.co.uk", role: UserRole.negotiator, agencyId: agency.id, password: TEST_PASSWORD, firmName: "Hartwell & Partners" },
});
await prisma.user.create({
  data: { name: "Alex Morgan", email: "alex@hartwellpartners.co.uk", role: UserRole.director, agencyId: agency.id, password: TEST_PASSWORD, firmName: "Hartwell & Partners" },
});
```

Roles seeded and their agencyId values:

| Role | agencyId in seed |
|---|---|
| `admin` (Sarah Hartwell) | `agency.id` (Hartwell's ID) |
| `admin` (Ellis via googlemail) | `agency.id` (Hartwell's ID) |
| `admin` (Ellis via salesprogressor.co.uk) | `agency.id` (Hartwell's ID) |
| `sales_progressor` (James) | `agency.id` (Hartwell's ID) |
| `negotiator` (Emily) | `agency.id` (Hartwell's ID) |
| `director` (Alex) | `agency.id` (Hartwell's ID) |

**The seed assigns every role, including `admin` and `sales_progressor`, to the same `agencyId`.  
The production database (section 3) shows `admin` and `sales_progressor` with `agencyId: null`.  
The seed does not reflect the production state.**

No `viewer` or `superadmin` accounts are created by the seed.

---

## Supplementary: additional checks found in grep not covered above

**`app/not-our-files/page.tsx` line 12** — `sales_progressor` explicitly excluded:
```typescript
if (session.user.role === "sales_progressor") {
  const { redirect } = await import("next/navigation");
  redirect("/dashboard");
}
```

**`components/layout/AppShell.tsx` line 45** — `sales_progressor` excluded from "Not Our Files" nav link:
```typescript
...(session.user.role !== "sales_progressor" ? [{ href: "/not-our-files", label: "Not Our Files", icon: NotOurFilesIcon, badge: null }] : []),
```

**`app/actions/solicitors.ts` line 11** — solicitor management requires `director` OR `admin`:
```typescript
if (role !== "director" && role !== "admin") throw new Error("Unauthorised");
```

**`lib/services/agent.ts` line 23** — file visibility logic:
```typescript
const seeAll = user?.role === "director" || user?.canViewAllFiles === true;
```

**`app/agent/transactions/[id]/page.tsx` line 227** — fee field shown only to director:
```typescript
showOurFee={session.user.role === "director"}
```

**`lib/session.ts` line 16** — comment in `requireAgencySession`:
```typescript
// Use in routes that require an agency-scoped user (admin/sales_progressor have no agencyId)
export async function requireAgencySession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (!session.user.agencyId) redirect("/login");
  return session;
}
```
