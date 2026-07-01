# Phase 3 · Surface 8 · Internal Dashboard · CLOSURE (no-op)

**Drafted:** 2026-07-01.

BUILD_PLAN originally scoped Surface 8 as:

> **Internal dashboard** · `/dashboard` · SP, admin, superadmin · SP / admin landing — distinct from agent hub · 1 wk

**Finding:** the surface as described does not exist as its own render.

---

## What's actually at `/dashboard`

```ts
// app/dashboard/page.tsx (5 lines)
import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/agent/hub");
}
```

Any user landing on `/dashboard` gets bounced to `/agent/hub`. Internal-staff visibility branches inside the hub page via `resolveInternalVisibility(...)` → they see the same hub with an internal-staff scope (already documented + remediated in [Surface 2 BASELINE §4](../02-agent-hub/BASELINE.md)).

There is a `loading.tsx` sibling that renders during the same-server redirect window (~milliseconds). It's dead code in practice — animate-pulse skeletons that briefly flash during the redirect handoff. Not worth touching.

---

## What exists but is NOT Surface 8

Some AppShell-based routes exist that could look like an "internal dashboard" surface:

- **`/transactions/[id]`** (454 lines) — parallel file-detail using AppShell instead of AgentShell. Contains 1 `glass-card` at L307. Uses the same delegate components as Surface 1 (PropertyHero, TransactionSidebar, MilestonePanel, etc.) — all already migrated.
- **`/transactions/new`** — parallel new-sale form (AppShell chrome).
- **`/admin/*`** — founder-only admin surfaces (audit, migrate). Different scope entirely.

**None of these are "the internal dashboard" per the original plan wording.** They're parallel AppShell versions of surfaces we've already remediated on the agent side. Filing them separately in POLISH_TBD as an "AppShell parallel routes" audit for Phase 3.5 or a bundled follow-up.

---

## Decision: close Surface 8 as no-op

- No baseline / audit / plan / PR — nothing to remediate at `/dashboard`
- No E2E sentinel — hitting `/dashboard` just fires the redirect (`/agent/hub` sentinel from Surface 2 already covers the destination)
- BUILD_PLAN updated to note the no-op resolution
- Follow-up filed in POLISH_TBD: `/transactions/[id]` and `/transactions/new` AppShell parallels need their own audit

Phase 3 progress adjusts to 7 of 10 real surfaces (one dropped as it doesn't exist).
