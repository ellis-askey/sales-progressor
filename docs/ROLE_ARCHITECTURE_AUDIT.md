# Role Architecture Audit

**Date:** 2026-05-03  
**Scope:** Read-only investigation of actual implementation. All findings reference live code.

---

## 1. Role Values

### Enum definition

`prisma/schema.prisma` lines 106–113:

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

Default (schema line ~60): `role UserRole @default(viewer)`

### Per-role gating summary

#### `superadmin`
- **Middleware** (`middleware.ts` line 40): `if (role !== "superadmin")` → redirect `/dashboard`
- **Layout** (`app/command/layout.tsx`): `if (session.user.role !== "superadmin") redirect("/dashboard")`
- **Step-up cookie** required on every `/command/*` request (middleware lines 68–104). Cookie checked for HMAC validity, `issuedAt` within 24 h hard cap, `lastSeenAt` within 8 h idle window, `stepUpAt` within 30 min.
- **API routes**: all `/api/command/*`, `/api/gdpr/export`, `/api/gdpr/delete` check `role !== "superadmin"` explicitly.

#### `admin`
- **No positive route gate in middleware** — admin is the catch-all for the internal SP dashboard.
- **Middleware line 160**: `if (!isAgentUser && role !== "admin" && pathname.startsWith("/agent"))` — this *exempts* admin from the non-agent `/agent` block. However, `app/agent/layout.tsx` then redirects admin back to `/dashboard` at the server level, so admin cannot reach agent pages in practice.
- **API routes gated to admin**: `app/api/admin/users/route.ts` and `app/api/admin/agents/route.ts` both check `role !== "admin"` → 401/403.

#### `sales_progressor`
- No dedicated middleware gate. Reaches `/dashboard` via `requireSession()` (no role check, just session presence).
- Listed in `lib/session.ts` comment (line 16) as one of the roles that "have no agencyId" — meaning `requireAgencySession()` would reject them.
- `app/api/agency/users/route.ts` line ~17 includes `sales_progressor` in the progressor-list query: `role: { in: ["sales_progressor", "admin"] }`.

#### `director`
- **Middleware line 145**: `const isAgentUser = role === "negotiator" || role === "director"` — director is treated identically to negotiator in routing terms.
- Redirected away from all non-agent paths to `/agent/hub` (middleware line 156).
- **`app/agent/layout.tsx`**: `if (session.user.role !== "negotiator" && session.user.role !== "director") redirect("/dashboard")` — confirms the two-role gate.
- **`app/api/agent/team/route.ts`**: `requireDirector()` helper — director-only team management CRUD.
- **`lib/services/agent.ts` line ~23**: `const seeAll = user?.role === "director" || user?.canViewAllFiles === true` — directors see all their agency's agent files; negotiators see only their own.

#### `negotiator`
- Same routing as `director` (isAgentUser = true).
- `app/agent/layout.tsx` lets them through.
- **Transaction visibility**: `listTransactions(agencyId, agentUserId)` filters by `{ agencyId, agentUserId }` — own files only, unless `canViewAllFiles = true`.
- Cannot access team management API (director-only).

#### `viewer`
- **Middleware lines 134–143**: all API mutation methods (POST/PUT/PATCH/DELETE) return 403 for viewers.
- `lib/session.ts` `forbidViewer()` helper (line 36) — secondary check in individual route handlers.
- No positive gate to any UI section; viewer can reach `/dashboard` but cannot mutate anything.

---

## 2. User vs Agency Relationships

### Schema

`prisma/schema.prisma` (User model, lines ~49–93):

```prisma
agencyId   String?    // NULLABLE
agency     Agency?    @relation(fields: [agencyId], references: [id])
```

`agencyId` is **nullable** (`String?`). This is the single most important structural fact for understanding role separation.

### What happens to null at auth time

`lib/auth.ts` JWT callback:
```typescript
token.agencyId = (user as { agencyId: string | null }).agencyId ?? "";
```

A `null` agencyId in the DB becomes **`""` (empty string)** in the JWT and session. The session type declares `agencyId: string` (non-nullable), but it may be `""`.

### The requireAgencySession gate

`lib/session.ts` lines 16–22:
```typescript
// Use in routes that require an agency-scoped user (admin/sales_progressor have no agencyId)
export async function requireAgencySession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (!session.user.agencyId) redirect("/login");  // empty string is falsy
  return session;
}
```

The comment is explicit: **internal admin and sales_progressor users have no agencyId**. Empty string is falsy, so these users are blocked from any route using `requireAgencySession()` and redirected to `/login`.

### How internal staff are modelled — current state vs intended

**In the seed** (`prisma/seed.ts`): all users including Ellis (admin) and James (sales_progressor) are assigned `agencyId: agency.id` (Hartwell & Partners). In the development/seed environment, internal staff share Hartwell's agencyId.

**Intended production model** (inferred from comment and `requireAgencySession` logic): internal Sales Progressor staff have `agencyId = null`. This means:

- Pattern **(a)** — Users with no agencyId, distinguished by role — is the intended model.
- Pattern **(b)** — a special "internal agency" — does **not** exist. There is no Agency record for The Sales Progressor company in the schema or seed.

**Consequence**: in production, an internal sales_progressor logging in would have `session.user.agencyId === ""`. The `/dashboard` page calls `listTransactions("")` which queries `{ agencyId: "", progressedBy: "progressor" }` — this would return **zero rows**. The cross-agency dashboard for internal progressors is **not yet implemented**.

### Registration flow

`app/api/register/route.ts` lines ~36–49: new self-registrations are always assigned to an existing agency and given role `director` or `negotiator`. Registration cannot produce internal staff accounts.

---

## 3. Routing Outsourced Files

### Relevant schema fields on `PropertyTransaction`

```prisma
serviceType    ServiceType    @default(self_managed)   // self_managed | outsourced
progressedBy   ProgressedBy   @default(progressor)     // progressor | agent
assignedUserId String?                                  // SP staff member assigned to this file
agentUserId    String?                                  // Agent who created/submitted
agencyId       String                                   // Required — which agency owns this
```

`ServiceType` enum (schema lines 120–123):
```prisma
enum ServiceType {
  self_managed
  outsourced
}
```

### How outsourced files appear on the dashboard

`app/dashboard/page.tsx` line 26: `listTransactions(session.user.agencyId)` — no opts, so the where clause is:
```typescript
whereClause = { agencyId, progressedBy: "progressor" };
```

`listTransactions` (`lib/services/transactions.ts` line 20) defaults to `progressedBy: "progressor"` when no agentUserId is provided. This means the internal dashboard shows all files on the "progressor" side of that agency.

Unassigned outsourced files widget (`app/dashboard/page.tsx` lines 39–41):
```typescript
const unassignedFiles = transactions.filter(
  (t) => t.serviceType === "outsourced" && t.assignedUser === null && t.status === "active"
);
```

This is client-side filtering of the already-fetched transactions. It highlights outsourced files that have no `assignedUserId` yet, prompting manual assignment.

### What is and is not implemented

| Feature | Status |
|---------|--------|
| `serviceType` field on schema | ✅ Implemented |
| `progressedBy` field on schema | ✅ Implemented |
| `assignedUserId` field (SP staff member) | ✅ Implemented |
| Unassigned outsourced files widget on `/dashboard` | ✅ Implemented |
| Cross-agency visibility (SP staff seeing outsourced files from multiple agencies) | ❌ Not implemented |
| Internal SP staff dashboard that aggregates outsourced files from all agencies | ❌ Not implemented |

The `assignedUserId` field exists and is the intended routing mechanism, but the query infrastructure for an internal SP staff member to see files across all agencies is absent. Currently, a sales_progressor with `agencyId = null` would see an empty dashboard.

---

## 4. Internal Dashboard

### Route

`app/dashboard/page.tsx` — exists. Uses `AppShell` component (line 44), which is the internal SP shell with full sidebar navigation.

**No role gate**: uses `requireSession()` (line 21), not `requireAgencySession()`. Any logged-in user who reaches this route can render it.

**In practice**, only non-agent users reach `/dashboard`:
- Middleware line 155–156 redirects all agent users (director, negotiator) away from `/dashboard` to `/agent/hub`.
- Non-agent users (admin, sales_progressor, viewer, superadmin) are not redirected and reach the dashboard.

### Layout

No `app/dashboard/layout.tsx` exists. The shell is applied within the page via `<AppShell>`.

`AppShell` (`components/layout/AppShell.tsx`) is the internal brand shell: full sidebar with navigation to `/dashboard`, `/transactions`, `/tasks`, `/solicitors`, `/comms`, `/analytics`, `/admin` (if admin), etc.

### Distinction from `/agent/*`

| Property | Internal `/dashboard` | Agent `/agent/*` |
|---|---|---|
| Shell component | `AppShell` | Agent shell (different component) |
| Navigation | Full SP sidebar | Minimal agent header |
| Brand | The Sales Progressor | Agency-branded |
| Roles | admin, sales_progressor, viewer, superadmin | director, negotiator |
| Transaction scope | `progressedBy: "progressor"` | `agentUserId: session.user.id` (or all for director) |

`/agent/hub` is the agent landing page. `/agent/dashboard` also exists and is a separate page within the agent shell.

---

## 5. Access Boundaries

### Director

- Sees **all agent-side files** for their agency (`agencyId` filter applied, but `canViewAllFiles = true` via `resolveAgentVisibility` in `lib/services/agent.ts` line ~23).
- Can create and manage agent team members via `/api/agent/team` (director-only gate).
- Cannot access internal `/dashboard`, `/tasks`, `/admin`, `/command/*`.
- Boundary enforced: `app/agent/layout.tsx` role check, middleware routing.

### Negotiator

- Sees **only their own files** (`agentUserId === session.user.id` filter in `listTransactions`).
- No team management access.
- Same shell/routes as director, subset of visibility.
- Boundary enforced: `listTransactions` query filter.

### Internal sales_progressor (intended model)

- **Intended**: sees all `progressedBy: "progressor"` files across all agencies (cross-agency).
- **Actual current state**: `listTransactions(session.user.agencyId)` — scoped to their agencyId. With null agencyId in production, returns nothing.
- **Not enforced**: no meaningful boundary exists yet for cross-agency access because cross-agency queries don't exist.

### Internal admin (intended model)

- Same as sales_progressor for file visibility.
- Additionally: access to `/api/admin/users` and `/api/admin/agents` (admin-role-gated).
- **Same gap**: production cross-agency dashboard is not implemented.

### Internal admin — note on `/agent` access

Middleware allows admin to reach `/agent/*` paths (excluded from the non-agent block at line 160). But `app/agent/layout.tsx` immediately redirects non-negotiator/non-director users to `/dashboard`. So admin cannot use the agent interface. This is a minor inconsistency between middleware and layout — the layout wins.

### Superadmin

- Access to `/command/*` only (middleware blocks all non-command paths? No — superadmin is not in `isAgentUser`, so they can reach `/dashboard`).
- `/command/*` requires superadmin role + valid step-up cookie.
- GDPR export/delete routes require superadmin + step-up.
- Can reach `/dashboard` if they have an agencyId (or see empty dashboard if null).
- **Not intended to manage regular transactions** — command centre is for system-level operations.

### viewer

- Reaches `/dashboard` and can view all data within their agencyId scope.
- All API mutations blocked at middleware level.
- `forbidViewer()` provides secondary block in individual handlers.

### Boundary enforcement reality check

| Boundary | Enforced how | Strength |
|---|---|---|
| Agency isolation (different agencies) | `agencyId` filter in every query | ✅ Application-layer (RLS staging only — see TODO.md) |
| Agent vs internal role routing | Middleware + layout redirects | ✅ Enforced |
| Director sees all / negotiator sees own | `resolveAgentVisibility` + query filter | ✅ Enforced |
| Viewer read-only | Middleware + `forbidViewer` | ✅ Enforced |
| Superadmin command centre | Middleware + layout + TOTP step-up | ✅ Enforced |
| Internal staff cross-agency visibility | Not implemented | ❌ Gap |

---

## 6. The Trial Paywall Question

### Current state

No subscription, trial, or billing system exists anywhere in the codebase:
- `prisma/schema.prisma` Agency model: no `trialEndsAt`, `subscriptionStatus`, `plan`, or any billing field.
- No middleware check for trial expiry.
- No API route that enforces payment state.

The paywall is a greenfield addition.

### How cleanly the role separation supports it

**The role values themselves are clear:**

| User type | Role(s) | Should paywall block? |
|---|---|---|
| Agency director | `director` | Yes |
| Agency negotiator | `negotiator` | Yes |
| Agency viewer | `viewer` | Yes |
| Internal sales progressor | `sales_progressor` | No |
| Internal admin | `admin` | No |
| Superadmin | `superadmin` | No |

A paywall middleware check could read:
```typescript
const isAgencyUser = role === "director" || role === "negotiator" || role === "viewer";
```
or equivalently:
```typescript
const isInternalStaff = role === "admin" || role === "sales_progressor" || role === "superadmin";
```

**One wrinkle**: the agencyId approach (block if `session.user.agencyId !== ""`) would fail because in the current seed, admin users have an agencyId. The role check is the reliable discriminator.

**Second wrinkle**: for Package A1, the paywall blocks access to *a specific agency's* files. An internal sales_progressor might be working on Agency A's outsourced files while Agency B is on a trial. The block logic would need to gate on the *transaction's* agency, not the *user's* agency. This requires the cross-agency internal dashboard to exist first — which it doesn't. If internal progressors are modelled with `agencyId = null` and the cross-agency dashboard is built, the paywall only needs to skip internal staff.

**Conclusion**: the role values are clean enough that the paywall is straightforward *in concept*. The messiness is not in the role architecture but in the unimplemented cross-agency internal dashboard. If Package A1's paywall only needs to block agency-side users from their own `/agent/*` routes (and the internal SP dashboard is out of scope), the role check is a single clean condition.

---

## Summary Table

| Role | agencyId | Can reach | Sees files |
|---|---|---|---|
| `superadmin` | null → `""` | `/command/*`, `/dashboard` (empty) | System operations only |
| `admin` | null → `""` (intended) or agencyId (seed) | `/dashboard`, `/api/admin/*` | `progressedBy: "progressor"` within their agencyId |
| `sales_progressor` | null → `""` (intended) or agencyId (seed) | `/dashboard` | Same scope as admin; cross-agency not implemented |
| `director` | `{agencyId}` | `/agent/*` | All agent files for their agency |
| `negotiator` | `{agencyId}` | `/agent/*` | Own files only |
| `viewer` | `{agencyId}` | `/dashboard` (read-only) | Same as admin/SP within their agency |

### Open gap

The internal SP staff model is partially specified (nullable agencyId, comment in session.ts) but not operationally implemented. The `/dashboard` and `listTransactions` work correctly for a single-agency setup (as in the seed), but would return empty for a properly configured internal staff account with `agencyId = null`. Building Package A1 (trial paywall) does not require resolving this gap unless the paywall also needs to govern cross-agency internal access.
