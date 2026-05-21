# Agent Portal — Data Isolation Rules

This document defines the rules for keeping agency and agent data isolated on all `/agent/` routes and APIs. Treat it as a pre-flight checklist whenever adding or modifying agent-facing features.

---

## The Two Isolation Boundaries

### 1. Agency boundary
An agent must only see data that belongs to their own agency.  
Key field: `session.user.agencyId`

Every Prisma query touching a model with `agencyId` must include `where: { agencyId: session.user.agencyId }` (or pass agencyId to a service function that does so internally).

### 2. Agent boundary (within an agency)
Some data is per-agent, not per-agency (e.g. drafts, own to-dos, transactions assigned to that agent).  
Key field: `session.user.id`

Director-role users (`vis.seeAll === true`) may see all agents' data within the agency. All other roles must be scoped to their own `userId` as well.

---

## Current Verified-Safe Patterns

| Route / API | Scoping method | Verified |
|---|---|---|
| `/agent/transactions/new` | `agencyId` + `agentUserId: session.user.id` for drafts | ✓ |
| `/agent/transactions/[id]` | `getTransaction(id, agencyId)` + agent ownership check | ✓ |
| `/agent/dashboard` | `resolveAgentVisibility(userId, agencyId)` | ✓ |
| `/agent/work-queue` | `getAgentReminderLogs(vis)` — `transaction.agencyId` filter | ✓ |
| `/agent/to-do` | `listAllTasksForAgent(userId, agencyId)` | ✓ |
| `/agent/analytics` | `resolveAgentVisibility(userId, agencyId)` | ✓ |
| `/agent/solicitors` | `resolveAgentVisibility` + `agencyId` on recommended firms | ✓ |
| `/agent/completions` | `resolveAgentVisibility(userId, agencyId)` | ✓ |
| `/agent/comms` | `resolveAgentVisibility(userId, agencyId)` | ✓ |
| `/api/manual-tasks` POST | `agencyId` on create; service verifies on update/delete | ✓ |
| `/api/manual-tasks/[id]` PATCH/DELETE | `updateManualTask(id, agencyId)` — agencyId in where | ✓ |
| Task actions (complete/snooze/escalate/wakeup/manual chase) | `transaction: { agencyId }` relation filter in service layer | ✓ |

---

## Checklist for New Agent Features

Before shipping any new route, API endpoint, or server action that serves agent users:

- [ ] **Every `findMany` / `findFirst` / `findUnique`** on agency-owned data includes `agencyId` in the where clause (either directly or via a relation filter like `transaction: { agencyId }`).
- [ ] **Mutations** (update, delete, upsert) verify ownership before modifying — either a prior `findFirst` check or an `update({ where: { id, agencyId } })` pattern.
- [ ] **Draft / per-agent data** also filters by `agentUserId: session.user.id` (not just agencyId).
- [ ] **Director visibility** (`vis.seeAll`) widens the agent filter but never widens the agency filter.
- [ ] **API routes** (`/api/...`) call `getServerSession(authOptions)` and return 401 if no session.
- [ ] **Server actions** call `requireSession()` at the top.
- [ ] **Relation-loaded data** (includes/joins) does not expose fields from other agencies via the relation. If a relation is global (e.g. `SolicitorFirm`), ensure only agency-specific join data (e.g. `AgencyRecommendedSolicitor`) is exposed, not raw global records.

---

## Common Pitfalls

**Pitfall 1 — Querying by ID without agencyId**  
```typescript
// BAD — any agent who guesses the ID can read it
prisma.propertyTransaction.findUnique({ where: { id } })

// GOOD
prisma.propertyTransaction.findFirst({ where: { id, agencyId: session.user.agencyId } })
```

**Pitfall 2 — Forgetting agentUserId on per-agent data**  
```typescript
// BAD — returns all agency drafts, not just this agent's
prisma.propertyTransaction.findMany({ where: { agencyId, status: "draft" } })

// GOOD
prisma.propertyTransaction.findMany({ where: { agencyId, agentUserId: session.user.id, status: "draft" } })
```

**Pitfall 3 — Updating via relation without verifying agency**  
```typescript
// BAD — taskId could belong to any agency
prisma.chaseTask.update({ where: { id: taskId }, data: { ... } })

// GOOD — Prisma returns null if the relation filter doesn't match
prisma.chaseTask.findFirst({ where: { id: taskId, transaction: { agencyId } } })
// then throw if null, then update
```

**Pitfall 4 — Fire-and-forget actions that skip auth**  
Background/cron jobs that re-use `transactionId` from client input must still verify agencyId before touching data.

---

## When to Ask Before Implementing

If you're unsure whether a new piece of data is per-agency, per-agent, or global, ask before writing the query. Examples of things that require clarification:

- A new model with no `agencyId` column — is it truly global, or does it need scoping?
- Anything that lists records across multiple transactions for a given user
- Any route that takes an `id` parameter from the URL (not the session)
- Cron/webhook handlers that process data without a user session
