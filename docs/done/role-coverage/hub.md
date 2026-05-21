# Role-Coverage Inventory: /agent/hub

**Date:** 2026-05-18  
**Status:** Stage 1 — Pending Ellis review  
**Files:** `app/agent/hub/page.tsx`, `app/agent/hub/loading.tsx`, `lib/services/hub.ts`, `components/hub/AttentionListView.tsx`

---

## Section 1: Current state per role

### Data layer (shared understanding)

The hub page already routes through the `internalMode` mechanism built in WS3:

```ts
const vis = isInternalStaff
  ? resolveInternalVisibility(session.user.id, role)  // sync, no DB query
  : await resolveAgentVisibility(session.user.id, session.user.agencyId);
```

`buildTxWhere(vis)` in `hub.ts` branches correctly:
- `admin_all` → `{}` — all transactions across all agencies
- `assigned` → `{ assignedUserId: vis.userId }` — SP's assigned files
- agent path → `{ agencyId, agentUserId }` — unchanged

**All seven hub service functions (`getHubPipelineStats`, `getHubAttentionItems`, `getHubMomentum`, `getHubWeeklyForecast`, `getHubServiceSplit`, `getHubRecentActivity`, `getHubDiary`) use this branching.** The cross-agency admin view and the SP assigned-file view are both already returning the correct data. No data gap exists on the hub page.

---

### Director — current state

Data: `resolveAgentVisibility` → `seeAll = true` (directors always see all) → `{ agencyId }`. All hub stats are agency-scoped.

| Section | What renders | Correct? |
|---|---|---|
| Greeting | "Good morning, [name]" | ✓ |
| Subtitle | "Here's what matters today." | ✓ |
| "New sale" button | Shown (`canCreateSale = true`) | ✓ |
| Flag button | Shown (`!isInternalStaff = true`) | ✓ |
| Today's diary | Agency exchanges/completions today | ✓ |
| Needs your attention | Agency reminders due/overdue (max 3) | ✓ |
| Pipeline health | Agency-wide stats, 4 cells + stalled row | ✓ |
| Pipeline health subtitle | "Where your business stands today." | ✓ |
| Momentum | Agency exchanges this month vs last | ✓ |
| Exchange forecast | Agency-scoped 5-week bar chart | ✓ |
| Exchange forecast subtitle | "When your files are due to exchange." | ✓ |
| Service split ("Who's managing") | Shown. "Managed by you" / "Our team" | ✓ |
| Activity ribbon | Most recent comm/milestone across agency | ✓ |

All copy is agent/agency-centric and correct for director.

---

### Negotiator — current state

Identical to director in hub terms. Data scoped to own files (`{ agencyId, agentUserId }`) or all agency files (`canViewAllFiles = true`). All sections and copy correct for negotiator.

---

### sales_progressor — current state

Data: `resolveInternalVisibility` → `internalMode: "assigned"` → `{ assignedUserId }`. SP sees only transactions they are personally assigned to (the outsourced files they manage).

| Section | What renders | Correct? |
|---|---|---|
| Greeting | "Good morning, [name]" | ✓ |
| Subtitle | "Here's what matters today." | ✓ (generic, acceptable) |
| "New sale" button | **Hidden** (`canCreateSale = false`) | ✓ |
| Flag button | **Hidden** (`!isInternalStaff`) | ✓ |
| Today's diary | Assigned-file exchanges/completions today | ✓ |
| Needs your attention | Assigned-file reminders due/overdue (max 3) | ✓ |
| Pipeline health | Assigned-file stats — correct data | Data ✓ |
| Pipeline health subtitle | "Where your business stands today." | **WRONG** — not their business |
| Momentum | Exchanges in assigned files | ✓ (functionally) |
| Exchange forecast | 5-week forecast for assigned files | Data ✓ |
| Exchange forecast subtitle | "When your files are due to exchange." | **WRONG** — "your files" implies ownership |
| Service split | **HIDDEN** (`!isProgressor` guard exists) | ✓ |
| Activity ribbon | Most recent activity across assigned files | ✓ |
| Empty state | "No assigned files yet." | ✓ |

**Two copy strings are wrong.** Data is correct throughout.

---

### admin — current state

Data: `resolveInternalVisibility` → `internalMode: "admin_all"` → `{}`. Admin sees ALL transactions across ALL agencies — the full platform.

| Section | What renders | Correct? |
|---|---|---|
| Greeting | "Good morning, [name]" | ✓ |
| Subtitle | "Here's what matters today." | ✓ (generic, acceptable) |
| "New sale" button | **Shown** (`canCreateSale = true`) | Intentional — admin can add sales |
| Flag button | **Hidden** (`!isInternalStaff`) | ✓ |
| Today's diary | All-agency exchanges/completions today | ✓ |
| Needs your attention | Platform-wide reminders (max 3) | ✓ |
| Pipeline health | Platform-wide stats | Data ✓ |
| Pipeline health subtitle | "Where your business stands today." | **WRONG** — platform-wide |
| Momentum | Platform-wide exchanges this month vs last | ✓ |
| Exchange forecast | Platform-wide 5-week forecast | Data ✓ |
| Exchange forecast subtitle | "When your files are due to exchange." | **WRONG** — platform-wide |
| Service split ("Who's managing") | **Shown** (`!isProgressor = true` for admin) | **WRONG** — labels are agency-centric |
| Service split: "Managed by you" | Platform self-managed count | Label wrong |
| Service split: "Our team" | Platform outsourced count | Label wrong |
| Activity ribbon | Most recent activity on entire platform | ✓ |
| Empty state | "Your pipeline starts here." | Wrong but admin never has empty platform |

**Three copy strings wrong. Service split card shown with wrong labels.**

---

### loading.tsx — current state (all roles)

`loading.tsx` renders a static skeleton before session resolves. It cannot access session — Next.js loading.tsx is a static Server Component with no dynamic data. Everything is hardcoded:

- "New sale" button always shown — SP shouldn't see it, but sees it for ~1s while loading
- Skeleton for flag button always shown — SP/admin shouldn't see it
- Service split grid always 2-column — SP/admin see the right 1-column layout once data loads
- Subtitle "Here's what matters today." — not role-conditional (accepted limitation, same as to-do page)

These are cosmetic flickers during the loading window only. Not fixable without adding session to loading.tsx (non-standard, would add latency). **Accepted as known limitation — do not attempt to fix.**

---

## Section 2: Target state per role

### Director / Negotiator — no change

Zero adaptation required.

### sales_progressor — target

**Copy changes only:**

| Element | Current | Target |
|---|---|---|
| Pipeline health subtitle | "Where your business stands today." | "Your assigned files at a glance." |
| Exchange forecast subtitle | "When your files are due to exchange." | "Exchange forecast for your assigned files." |

All other sections already render correctly. No data changes. No hide/show changes beyond what already exists.

### admin — target

**Copy changes + one hide:**

| Element | Current | Target |
|---|---|---|
| Pipeline health subtitle | "Where your business stands today." | "Platform-wide pipeline at a glance." |
| Exchange forecast subtitle | "When your files are due to exchange." | "Platform-wide exchange forecast." |
| Service split card | Shown (wrong labels) | **Hidden** — same guard as SP |
| Forecast/split grid | 2-column (1fr 1fr) | 1-column (1fr) when no service split |

Rationale for hiding service split for admin: the card labels "Managed by you" / "Our team" are agency-centric and wrong for a platform-wide view. Admin has Command Centre for platform analytics. The card would need a full relabelling pass to be accurate for admin, and the marginal value is low — hide it.

---

## Section 3: Adaptation plan

| # | Item | Category | Role(s) |
|---|---|---|---|
| 1 | Pipeline health subtitle copy | B — Copy | SP, Admin |
| 2 | Exchange forecast subtitle copy | B — Copy | SP, Admin |
| 3 | Service split card: relabel eyebrow, subtitle, row labels, footer for admin | B — Copy | Admin |

**Total: 3 Category B items. No Category C items.**

The cross-agency admin aggregation and the SP assigned-file view are **already built and correct**. Ellis flagged this as a potential Category C (new data path) — it was built in WS3 via the `internalMode` branching in `hub.ts`. Nothing to build.

---

## Section 4: New functionality details

**None.** All data paths are already correct.

The concern about admin needing cross-agency aggregation was valid in intent — it is implemented, via `internalMode: "admin_all"` in `resolveInternalVisibility` → `{}` in `buildTxWhere` → all service functions return platform-wide data. Verified by reading `hub.ts` lines 17–28 and 31–42.

---

## Section 5: Implementation order

One pass, all four items:

1. `app/agent/hub/page.tsx`:
   - Add `const isAdmin = role === "admin"` derived var
   - Pipeline health subtitle: three-way ternary on `isProgressor` / `isAdmin` / agent
   - Exchange forecast subtitle: same three-way ternary
   - Service split: relabel eyebrow → "Service split", subtitle, row 1 label → "Self-managed", row 2 label → "Outsourced to us", footer → admin-framed text. Card stays visible for admin (grid stays 2-column).

2. No component files need changes. No service files need changes. No loading.tsx changes (accepted limitation).

3. `tsc --noEmit`, commit: `feat(role-coverage): /agent/hub — SP + admin views`

---

## Bugs to log (follow-ups, not fix inline)

**FU-05 — `getHubFlags` latent agencyId bug**  
`lib/services/hub.ts:343`: `getHubFlags(vis)` queries `{ agencyId: vis.agencyId, resolvedAt: null, transaction: txNested }`. For internal staff, `vis.agencyId = ""` — no TransactionFlag has `agencyId = ""`, so this returns empty. The function is not called from the hub page (page uses `getHubAttentionItems` instead), so no production impact today. But if it's ever wired up for internal staff, it will silently return empty. Should be fixed to use the same `internalMode` branching as other hub functions when it becomes relevant.

**FU-06 — Momentum ring for SP: metric validity**  
SP momentum (`getHubMomentum`) counts exchanges in assigned files this month vs last. If SP is new or has few exchanges, `thisMonth = 0, lastMonth = 0, percent = null` → ring renders null state (no data). This is technically correct but visually confusing — the ring just doesn't appear. Decision: if SP has no exchanges, consider replacing momentum with a different SP-relevant metric (e.g. files with outstanding reminders vs total). Out of scope for this pass; log for future SP UX review.

**FU-07 — loading.tsx role-conditional elements**  
`loading.tsx` always shows "New sale" button and the flag-button skeleton regardless of role. SP sees "New sale" for ~1s before the real page loads (then it disappears). Not fixable without adding session to loading.tsx (non-standard, defeats the skeleton's purpose). Accepted limitation.
