# TSP Admin — Global Command Centre Search (implementation proposal)

**Status:** proposal for review. **Not implemented.** Stop after review of interaction design + scope.

**Date:** 2026-11-20. Grounded against current HEAD.

---

## 1. What already exists (reuse, don't rebuild)

- **Two hand-rolled ⌘K palettes in the agent app:** `components/layout/AgentGlobalSearch.tsx` (the reference — ⌘K/Ctrl+K, Escape, 220 ms debounce, arrow-key nav, portal to body, top-result prefetch, theme-aware) backed by `app/api/agent/search/route.ts`; and an older `components/layout/GlobalSearch.tsx` (`/api/search`). **The Command Centre has neither.**
- **No `cmdk` / `react-hotkeys` dependency** — palettes are hand-rolled. We follow that (no new dep).
- **No cross-entity CC search endpoint** (`app/api/command/search` does not exist).
- **Per-entity reads already available** (`lib/command/*`): `getUsageOverview()` (agents + agencies), `getBusinessesOverview()` / `getBusinessNameMap()` (businesses), `searchFiles(q)` (files — address-only, and notably **omits the live-file filter**). `commandDb` can `contains`-search each model directly.
- **The agent search endpoint is agent-access-scoped** (`resolveInternalVisibility`/`resolveAgentVisibility`, Law 7) and returns transactions/contacts/solicitors — **not** agencies/businesses, and **not** superadmin cross-tenant. So it's the wrong backend for a founder search; we reuse the palette **mechanics**, not this endpoint.

**Verdict:** the *interaction* already exists and works (clone its mechanics, re-skin for the CC dark system). Only a **superadmin cross-tenant backend** and a CC-skinned palette are new.

---

## 2. Proposed design

### Backend — new `app/api/command/search/route.ts`
- `GET ?q=` (+ optional `?archived=1`), **superadmin-gated** (`hasSuperAdminPowers`, mirroring the `/command` layout), reads via **`commandDb`** (full cross-tenant — correct for the founder).
- Parallel `contains` (case-insensitive ILIKE) search across four entities, each capped (~6), min query length 2:

| Entity | Query fields | Detail route | Minimal result fields |
|---|---|---|---|
| **Estate agency** | `agency.name` (non-internal) | `/command/agency/[id]` | name, mode, managed-by |
| **Progression company** | `progressionBusiness.name` / `shortName` (non-TSP) | `/command/businesses/[id]` | name, status |
| **Person (user)** | `user.name` / `user.email` | `/command/agencies/[userId]` | name, role, agency/business |
| **Property file** | `propertyTransaction.propertyAddress` | `/command/files?tx=` | address, status, agency |

Returns `{ agencies, businesses, people, files }`.

### Frontend — new `components/command/CommandGlobalSearch.tsx`
- Clone the **mechanics** of `AgentGlobalSearch` (⌘K/Ctrl+K toggle, Esc, debounce, portal, arrow-nav, Enter-to-navigate), re-skinned to the CC dark system (`#0a0a0a`/`#111`, blue `#2563eb`, no glass). Mounted once in `app/command/(protected)/layout.tsx` (alongside the sidebar) so ⌘K works on every CC page.
- Results grouped by entity type; each row links to its detail route, built with **`buildFilterUrl`** so the active `?mode`/`?agency` scope is preserved where those pages honour it.

### Keyboard
⌘K / Ctrl+K open; typeahead; ↑/↓ move; Enter navigates; Esc closes. Keyboard-first, matching the agent-app palette users already know.

---

## 3. Tenant isolation & security
- Superadmin-only (layout gate + a re-check in the route), reading through `commandDb`. It **intentionally spans all tenants** — that is the founder's cross-tenant view, the same trust boundary every other CC read uses (Law 8). It does **not** adopt the agent `business`/`agency` access scope (not applicable to a superadmin) and changes no isolation rule. It exposes nothing a superadmin can't already reach by navigating.

## 4. Performance & indexing
- `contains`/ILIKE on `name` / `propertyAddress` / `email`, capped + debounced. At current scale (tens of agencies/businesses, modest file counts) this is comfortably fast — **no new indexes or migration needed**, and none proposed. If the file/user tables grow large enough to feel slow, the future option is `pg_trgm` GIN indexes on those columns (a migration, staging-first) — flagged as a later optimisation, explicitly **not** part of this slice.

## 5. Reuse summary
- **Reused:** the palette interaction model (from `AgentGlobalSearch`), CC primitives for result rows, `buildFilterUrl`, the existing detail routes, `commandDb`.
- **New (small):** one superadmin search endpoint + one CC-skinned palette (+ optionally a shared `SearchInput`). No new dependency, no new search *system*, no DB migration.

---

## 6. Scope decisions for your review
1. **File results default:** live/genuine transactions by default, with an explicit "include archived/withdrawn/internal" affordance for investigations (this is why we won't reuse `searchFiles`, which omits the live filter). Confirm.
2. **"People" scope:** staff/agents/owners (`User` rows) are searchable and link to `/command/agencies/[userId]`. Buyer/seller **portal contacts** have no CC person page, so they'd only be reachable via their file — i.e. Phase-1 search covers **agencies / progression companies / users / files**, not portal contacts. Confirm that matches your "users and team members" intent.
3. **Mechanics: clone-and-reskin** `AgentGlobalSearch` (recommended — it's coupled to agent styling/portal-theme; extracting a shared hook is more work for little gain) vs. extract a shared hook. Confirm.
4. **Trigger:** a single global ⌘K palette mounted in the command layout (recommended) — agreed?
