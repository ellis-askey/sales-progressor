# Role-Coverage Inventory: Remaining Pages

**Date:** 2026-05-18  
**Pages:** `/agent/completions`, `/agent/comms`, `/agent/analytics`  
**Status:** Stage 1 — Pending Ellis review and answers to open questions

---

## PAGE 1: /agent/completions

### Section 0: Data layer

**`getAgentCompletions(vis)`** in `lib/services/agent.ts`:
- Uses `txWhere(vis)` which correctly branches on `internalMode`:
  - `admin_all` → `{}` → all platform exchanged files ✓
  - `assigned` → `{ assignedUserId: vis.userId }` → SP's assigned files ✓
  - Agent paths: agency-scoped ✓
- **GAP:** Return shape does not include `agency.name`. Admin sees platform-wide files with no way to identify which agency each belongs to. Fix: add `agency: { select: { name: true } }` to the select in `getAgentCompletions` and surface in `CompletionFileRow`.

**`saveCompletionDateAction`** (from `app/actions/transactions.ts`):
- Uses `scopeOwnershipWhere(scope, txId)` — Package D. SP scoped to assigned files, admin to all. ✓

### Section 1: Current state per role

#### Director / Negotiator
| Section | What renders | Correct? |
|---|---|---|
| Title | "Completions" | ✓ |
| Subtitle | "Exchanged files, tracking to completion." | ✓ |
| StatPills | Overdue / this week / next week / later / no date counts | ✓ |
| Urgency groups | Collapsible, with count + fee/value totals | ✓ |
| File rows | Address, price, fee, purchasers, assigned user, exchange date | ✓ |
| "Set date" button | Visible and works | ✓ |
| Empty state | "No completions" + generic desc | ✓ |

No adaptation needed for director/negotiator.

#### sales_progressor
| Section | What renders | Correct? |
|---|---|---|
| Title | "Completions" | ✓ |
| Subtitle | "Exchanged files, tracking to completion." | **WRONG** — no mention of assigned scope |
| StatPills | Correct counts (assigned files only) | ✓ |
| Urgency groups | Assigned files only, correct | ✓ |
| File rows | No agency column — SP can't see which agency each file is | **MISSING** |
| "Set date" button | Works (Package D scoping) | ✓ |
| Empty state desc | "Once a file exchanges, it'll appear here…" — doesn't mention assigned scope | **WRONG** |

#### admin
| Section | What renders | Correct? |
|---|---|---|
| Title | "Completions" | ✓ |
| Subtitle | "Exchanged files, tracking to completion." | **WRONG** — admin sees all agencies |
| StatPills | Platform-wide counts | ✓ (though overwhelming at scale) |
| Urgency groups | All platform files, no agency identifier | **GAP** |
| File rows | No agency column — 100+ files, no way to identify agency | **MISSING** |
| "Set date" button | Works | ✓ |
| Empty state | Generic — irrelevant, admin never has zero platform files | Minor |

### Section 2: Target state

#### sales_progressor
| Problem | Current | Target |
|---|---|---|
| Subtitle | Generic | "Your assigned outsourced files, tracking to completion." |
| Empty state desc | Generic | "Once a file is assigned to you and exchanges, it'll appear here." |
| Agency column | Absent | Show agency name in file rows (for multi-agency context) |

#### admin
| Problem | Current | Target |
|---|---|---|
| Subtitle | Generic | "All exchanged files across the platform." |
| Agency column | Absent | Show agency name in file rows (critical for platform-wide view) |

### Section 3: Adaptation plan

| # | Item | Category | Role(s) | File |
|---|---|---|---|---|
| 1 | Subtitle (SP + admin) | B — Copy | SP, admin | `app/agent/completions/page.tsx` |
| 2 | Empty state desc (SP) | B — Copy | SP | `app/agent/completions/page.tsx` |
| 3 | Agency name in file rows | C — New data | SP, admin | `lib/services/agent.ts`, `CompletionFileRow` type, `CompletionFileRowView.tsx` |

**Total: 3 items. 2× Category B, 1× Category C.**

### Section 4: Category C detail — agency column

`getAgentCompletions` (lib/services/agent.ts) needs:
```ts
select: {
  // ...existing...
  agency: { select: { name: true } },
}
// mapped to:
agencyName: tx.agency?.name ?? null,
```

`CompletionFileRow` type (CompletionsGroupList.tsx) needs `agencyName?: string | null`.  
`CompletionFileRowView.tsx` needs a conditional agency label — show only when `agencyName` is present (i.e., gated in the data at page.tsx level, only passed for `isInternalStaff`).

Page.tsx passes `agencyName` only to internal staff — agents never get it so the column doesn't render for director/negotiator.

**Complexity:** Small. One extra field in the query, one conditional label in the row view.

### Section 5: Open questions

**OQ-1 — Agency column scope**  
Add agency column for SP and admin (item 3 above), or defer to a later pass?  
Recommendation: add it — admin's platform-wide view is unusable without it. SP benefits at low cost. One query field.

### Section 6: Bugs / follow-ups

None new. Viewer role is in `isInternalStaff` check (line 46) — known from previous pages; same pattern. Not in production use, not blocking.

---

## PAGE 2: /agent/comms

### Section 0: Data layer

**`getAgentMilestoneActivity(vis, portalOnly)`** in `lib/services/agent.ts`:
- Uses `txWhere(vis)` — same correctly-branching helper as all other pages.
  - `admin_all` → `{}` → platform-wide milestone completions ✓
  - `assigned` → `{ assignedUserId: vis.userId }` → SP's assigned files ✓
  - Agent paths: agency-scoped ✓

No mutations on this page. Read-only feed. No agencyId-null bugs.

### Section 1: Current state per role

#### Director / Negotiator
| Section | What renders | Correct? |
|---|---|---|
| Title | "Updates" | ✓ |
| Subtitle | "What's happened across your files." | ✓ |
| Filter pills | "All milestones" / "Client confirmations" | ✓ |
| Day buckets | Grouped by day → transaction → milestones | ✓ |
| Milestone rows | Agency-scoped completions | ✓ |
| Empty state | "No completed steps yet" / "Confirmed steps appear here as they happen." | ✓ |

No adaptation needed for director/negotiator.

#### sales_progressor
| Section | What renders | Correct? |
|---|---|---|
| Title | "Updates" | ✓ |
| Subtitle | "What's happened across your files." | **WRONG** — SP doesn't have "files" in the agent sense; they have assigned outsourced files |
| Filter pills | Both applicable | ✓ |
| Day buckets | Assigned files only, correct | ✓ |
| Milestone rows | Assigned files only, correct | ✓ |
| Empty state | Generic — doesn't mention assigned scope | **WRONG** |

#### admin
| Section | What renders | Correct? |
|---|---|---|
| Title | "Updates" | ✓ |
| Subtitle | "What's happened across your files." | **WRONG** — admin sees all platform activity, not "their" files |
| Filter pills | Both applicable | ✓ |
| Day buckets | All platform milestone completions (last 150) | ✓ |
| Milestone rows | All agencies, no agency identifier shown | Gap (low severity — address is shown; file link navigates to detail) |
| Empty state | Generic — "Confirmed steps appear here as they happen." | **WRONG** — admin context |

### Section 2: Target state

#### sales_progressor
| Problem | Current | Target |
|---|---|---|
| Subtitle | "What's happened across your files." | "What's happened on your assigned files." |
| Empty state | Generic | "Confirmed steps on your assigned files appear here." |

#### admin
| Problem | Current | Target |
|---|---|---|
| Subtitle | "What's happened across your files." | "What's happened across the platform." |
| Empty state | Generic | "Confirmed steps appear here as they happen across the platform." |

### Section 3: Adaptation plan

| # | Item | Category | Role(s) | File |
|---|---|---|---|---|
| 1 | Subtitle (SP + admin) | B — Copy | SP, admin | `app/agent/comms/page.tsx` line 77 |
| 2 | Empty state (SP + admin) | B — Copy | SP, admin | `app/agent/comms/page.tsx` lines 103–111 |

**Total: 2 items. Both Category B. Smallest pass of the three.**

### Section 4: New functionality

None. Page is read-only, data layer is correct, no new components needed.

### Section 5: Open questions

None. All changes are copy decisions.

### Section 6: Bugs / follow-ups

None new. No mutations exposed. No agencyId-null paths. Clean.

---

## PAGE 3: /agent/analytics

### Section 0: Data layer

All service functions used by analytics (`getAgentTransactions`, `getSolicitorExchangeStats`, `getMonthlyActivity`, `getKpiTrendsForAgency`, `getFilesAtRisk`) use `buildTxWhere(vis)` in `lib/services/analytics.ts`:
- `admin_all` → `{}` → platform-wide aggregation ✓
- `assigned` → `{ assignedUserId: vis.userId }` → SP's assigned files ✓

Director-only calls (`getReferralStats`, `getBrokerReferralStats`, `getAgencyTeam`) are correctly gated by `isDirector` in page.tsx and never execute for SP/admin. ✓

**No data layer bugs.** Data scoping is correct for all roles.

### Section 1: Current state per role

#### Director
Full analytics suite: KPI widgets, team filter, export CSV, monthly charts, solicitor stats, referral income tables (conveyancer + broker), files at risk, team leaderboard. Correctly scoped to own agency. ✓

#### Negotiator
Same as director minus: no team filter, no export, no referral tables, no leaderboard. Correctly scoped to own assigned files. ✓

#### sales_progressor
| Section | What renders | Correct? |
|---|---|---|
| Nav entry | "Analytics" shown in sidebar | **QUESTION** — is analytics meaningful for SP? |
| Title | "Analytics" | ✓ |
| KPI widgets | Counts/speed/fees for assigned files only | Technically correct |
| Team filter | Hidden (isDirector guard) | ✓ |
| Export | Hidden (isDirector guard) | ✓ |
| Referral tables | Hidden | ✓ |
| Leaderboard | Hidden | ✓ |
| Empty state | "No files yet" + agent-framed CTA ("Submit your first sale" hidden for SP) | ✓ |

Data is correctly scoped. The page renders and works. The question is whether SP analytics for 5–10 outsourced files is useful or is clutter they don't need.

#### admin
| Section | What renders | Correct? |
|---|---|---|
| Nav entry | "Analytics" shown in sidebar | **QUESTION** — is admin's analytics useful? |
| Title | "Analytics" | ✓ |
| KPI widgets | Cross-platform totals (all agencies, all files) | Technically correct |
| Team filter | Hidden (isDirector guard) | ✓ |
| Export | Hidden | ✓ |
| Referral tables | Hidden | ✓ |
| Leaderboard | Hidden | ✓ |
| Per-agency drill-down | **Does not exist** | **GAP if admin needs per-agency view** |

Admin sees correct cross-agency aggregated data. The gap is there's no per-agency breakdown — it's one flat number across the whole platform.

### Section 2: Target state

The key decision is nav inclusion. Three possible targets per role:

**SP analytics — options:**
- **Option A: Keep as-is.** Data is correct, UI is uncluttered (director-only sections hidden). SP has a personal KPI view of their assigned files. No code change.
- **Option B: Remove from SP nav.** Analytics provides low value for 5–10 outsourced files. SP's primary surface is the work queue, not analytics. Nav removal only (Category D).

**Admin analytics — options:**
- **Option A: Keep as-is.** Cross-agency aggregated totals. No per-agency breakdown but works. No code change.
- **Option B: Remove from admin nav.** Admin oversight is served by hub "Needs your attention". Same pattern as To-Do and Reminders. Category D only.
- **Option C: Add per-agency drill-down.** New service function + agency selector UI. Genuine Category C. Larger scope — probably its own arc.

### Section 3: Adaptation plan

Depends entirely on Ellis's decisions in Section 5.

**If SP: remove from nav (Option B):**
- D: `components/layout/AgentShell.tsx` — add `role !== "sales_progressor"` guard on Analytics entry

**If admin: remove from nav (Option B):**
- D: Same file — add `role !== "admin"` guard on Analytics entry

**If admin: add per-agency drill-down (Option C):**
- Flag as own arc. Involves new service function (`getAnalyticsByAgency`), new agency selector component, and scoped re-fetch. Not bundled into this pass.

**If both kept as-is (Option A for both):**
- Zero changes. Move on.

### Section 4: New functionality

Only relevant if admin Option C (per-agency drill-down) is chosen. Not estimated here — split into own arc if needed.

### Section 5: Open questions

**OQ-1 — SP nav: keep or remove?**  
Recommendation: **Remove**. Analytics for a handful of outsourced files adds little value. SP's job is the work queue, not pipeline analytics. Consistent with To-Do and Reminders being removed from admin nav (same philosophy: show each role what's relevant to their job).

**OQ-2 — Admin nav: keep or remove? And if keep, per-agency drill-down or flat?**  
Recommendation: **Remove**, same as To-Do and Reminders. Admin's oversight role is served by the hub. Adding per-agency analytics is real feature work for a later arc. Flat cross-agency totals with no context are low-value at the platform level.

If Ellis wants to keep analytics for admin: Option A (no code change) is the right call for now — not Option C.

### Section 6: Bugs / follow-ups

None. Data layer is clean. No mutation paths. No agencyId-null issues.

---

## Summary across all three pages

| Page | Category B items | Category C items | Category D items | Open questions | Verdict |
|---|---|---|---|---|---|
| /agent/completions | 2 (subtitle, empty state) | 1 (agency column) | 0 | 1 (agency column scope) | Small-medium |
| /agent/comms | 2 (subtitle, empty state) | 0 | 0 | 0 | Tiny |
| /agent/analytics | 0 | 0 (or large if OC) | 0–2 (nav removal) | 2 (SP nav, admin nav) | Decision-driven |

**No Category C surprises in comms or analytics.** Completions has one modest Category C (agency column — one query field + conditional render).

**Analytics is entirely decision-driven.** Recommend removing both SP and admin from analytics nav (same pattern as To-Do/Reminders), leaving the page URL live but not surfaced. If confirmed, analytics becomes a trivial D-only change.
