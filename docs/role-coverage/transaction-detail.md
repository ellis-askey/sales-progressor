# Role-Coverage Inventory: /agent/transactions/[id]

**Date:** 2026-05-18  
**Status:** Stage 1 — Pending Ellis review  
**Files:** `app/agent/transactions/[id]/page.tsx`, `components/transaction/*`, `components/milestones/MilestonePanel.tsx`, `lib/services/transactions.ts`, `lib/security/access-scope.ts`

---

## Section 0: Data layer status

### Main transaction fetch — CORRECT

The page correctly branches on `isInternalStaff`:

```ts
isInternalStaff
  ? getTransactionByScope(id, txScope!)     // admin: kind="all" → { id } only; SP: kind="assigned" → { id, assignedUserId }
  : getTransaction(id, session.user.agencyId) // agents: { id, agencyId }
```

`getAccessScope(session)` returns `kind: "all"` for admin and `kind: "assigned"` for `sales_progressor`. `getTransactionByScope` delegates to `scopeOwnershipWhere(scope, id)` which enforces the correct filter. No gaps.

### Sub-fetches — CORRECT (but see fragility note)

Five sub-fetches are called with `session.user.agencyId`, which is `""` (empty string) for internal staff:

```ts
getMilestonesForTransaction(id, session.user.agencyId)    // "" → falsy → { id: transactionId } only
getReminderLogsForTransaction(id, session.user.agencyId)   // same
getActivityTimeline(id, session.user.agencyId)             // same
listManualTasksForTransaction(id, session.user.agencyId)   // same
```

Each service function uses `agencyId ? { id, agencyId } : { id }`. Since `""` is falsy in JS, all bypass the agencyId filter for internal staff. Data access is correct.

**Fragility note (FU-08):** These calls work because `""` is falsy. If session serialization ever returned a truthy string for internal staff's `agencyId`, all sub-fetches would break silently (returning empty data rather than 404ing). The correct call is `null` for internal staff, not `""`. Log as cleanup — see follow-ups.

### Other fetches — CORRECT

| Fetch | Scoping |
|---|---|
| `prisma.transactionDocument.findFirst` | `{ transactionId: id, source: "mos" }` — no agencyId ✓ |
| `prisma.user.findUnique` (assignedUser) | `{ id: assignedUserId }` — no agencyId ✓ |
| `prisma.user.findUnique` (agentUser) | `{ id: agentUserId }` — no agencyId ✓ |
| `agencyRecommendedSolicitor.findMany` | Only fetched for `isDirectorRole`; SP and admin get `null` ✓ |
| `prisma.fileTimeSession.findMany` | `{ transactionId: id }` — no agencyId ✓ |
| Broker row | Explicit: `isInternalStaff ? { id } : { id, agencyId }` ✓ |

**Overall data layer verdict: CORRECT AND SAFE.** No foundational data gaps for internal staff. This page is ahead of the hub in that the security branching is fully explicit (not just relying on agencyId falsy bypass).

---

## Section 1: Current state per role

### Director — current state

All sections correct. Director is the reference/baseline user for this page.

| Section | Status |
|---|---|
| PropertyHero | Agent-view layout (coral glass), correct service type badge, agencyName shown |
| StatusControl | Full access (active / on_hold / completed / withdrawn) |
| ManualTaskList | `perspective="agent"`, `showOwnership={outsourced}` — correct |
| Sidebar | `showOurFee=true` (agent fee + referral fee + progressor fee), `isInternal=false` (no time split) |
| MilestonePanel | Vendor + purchaser tabs, full confirm/undo access |
| RemindersSection | Full access |
| ActivityTimeline + CommsEntry | Full access — log any comm type, add internal notes |
| ComposeEmail | Full access (director has verified sender) |
| ContactsSection | Full access including portal view dates |
| SolicitorSection | Full access + recommended firms for director |
| PropertyIntelCard | UK property data — read-only ✓ |
| ViewChainButton | Own-agency chain visibility |
| RiskScoreWidget | Read-only risk calculation ✓ |

### Negotiator — current state

Identical to director in UI terms. Only differences:
- `showOurFee = false` (not a director, no fee breakdown)
- `recommendedFirms = null` (only director gets recommended solicitor list)
- Data scope: own files only (or all if `canViewAllFiles = true`)

All sections otherwise correct for negotiator.

### sales_progressor — current state

Data: SP sees only transactions where `assignedUserId = spId`. In practice, all their files are `serviceType: "outsourced"`. Data access is correct.

| Section | Current | Correct? |
|---|---|---|
| PropertyHero layout | Agent-view (coral glass), `backHref="/agent/transactions"` | ✓ (on agent surface) |
| PropertyHero — agency name | Shown ("Agency: [name]") | ✓ — tells SP which agency this file belongs to |
| PropertyHero — serviceType badge | "With progressor" for all SP files | **WRONG** — SP IS the progressor; badge says "With progressor" about themselves |
| StatusControl | SP can change status | ✓ — SP manages the file, status changes are in scope |
| ManualTaskList — perspective | `"agent"` hardcoded | **WRONG** — SP should see `"progressor"` to manage agent request tasks |
| ManualTaskList — showOwnership | `transaction.serviceType === "outsourced"` = always `true` for SP | **WRONG** — shows "flag to progressor" ownership toggle; SP doesn't flag tasks to themselves |
| Sidebar — showOurFee | `false` | ✓ — SP doesn't need to see the agency's fee breakdown |
| Sidebar — isInternal | `true` → shows time split | ✓ conceptually, but... |
| Sidebar — time split labels | "You" = `agentSeconds` (the customer agent's time) | **WRONG** — SP reads "You" as their own time, but it refers to the agent's engagement |
| Sidebar — "Our team" | `teamSeconds` (SP + admin time) | ✓ label works from SP's perspective |
| MilestonePanel | Full vendor + purchaser tabs, can confirm milestones | ✓ — SP progresses milestones |
| RemindersSection | Full access | ✓ |
| ActivityTimeline | All comms, milestones, internal notes visible | ✓ — SP manages the file |
| CommsEntry | Can log any comm type, add internal notes | ✓ |
| ComposeEmail | Accessible but requires verified sender | NOTE — SP probably has no verified sender configured (ops gap, not a code issue) |
| ContactsSection | Full access + portal view dates | ✓ |
| SolicitorSection | Full access, no recommended firms | ✓ |
| PropertyIntelCard | Read-only UK property data | ✓ |
| ViewChainButton | Can view chain | ✓ — chain is read-only; SP seeing chain positions is appropriate |
| RiskScoreWidget | Read-only | ✓ |
| TransactionNotes | Can view + add internal notes | ✓ |

**SP problems: 4 items — 1 in PropertyHero, 2 in ManualTaskList, 1 in Sidebar.**

### admin — current state

Data: admin sees ALL transactions across ALL agencies via `kind: "all"`. A single admin viewing a customer's file via direct URL (`/agent/transactions/[id]`) gets full data access.

| Section | Current | Correct? |
|---|---|---|
| PropertyHero — agency name | Shown prominently | ✓ — critical context for admin seeing cross-agency files |
| PropertyHero — serviceType badge | "Self-managed" or "With progressor" | ✓ — correct framing for admin |
| StatusControl | Can change status of ANY file | ✓ — admin-level override access |
| ManualTaskList — perspective | `"agent"` | ✓ — admin reads from oversight perspective |
| ManualTaskList — showOwnership | `true` for outsourced files | **WRONG** — admin shouldn't have the "flag to progressor" toggle; admin doesn't create agent requests |
| Sidebar — showOurFee | `true` | ✓ — admin sees the full fee picture |
| Sidebar — isInternal | `true` → shows time split | ✓ conceptually, same label bug |
| Sidebar — time split "You" label | `agentSeconds` (customer agent time) | **WRONG** — admin reads "You" as themselves, it's the agent's time |
| MilestonePanel | Full access, can confirm milestones | NOTE — admin confirming milestones on any file is powerful; accepted as admin capability |
| ActivityTimeline | All comms + comms from other users | ✓ — admin oversight |
| CommsEntry | Can log comms on any file | ✓ — oversight role; admin may need to add notes on files |
| ComposeEmail | Accessible (admin likely has verified sender) | ✓ |
| SolicitorSection | Full view, `recommendedFirms = null` | ✓ — admin doesn't use agency's recommended solicitor list |
| ViewChainButton | Can view full cross-agency chain | ✓ — admin has full platform visibility |
| RiskScoreWidget | Read-only | ✓ |

**Admin problems: 2 items — ManualTaskList showOwnership, sidebar "You" label.**

---

## Section 2: Target state per role

### Director / Negotiator — no change

Zero adaptation required.

### sales_progressor — target

| Element | Current | Target |
|---|---|---|
| PropertyHero serviceType badge | "With progressor" | **Hidden** — SP's files are always outsourced; badge adds no info and is self-referential |
| ManualTaskList perspective | `"agent"` | `"progressor"` — SP manages agent requests, not just reads them |
| ManualTaskList showOwnership | `true` (outsourced) | `false` — SP doesn't flag tasks to themselves |
| Sidebar "You" time label | `agentSeconds` | Relabel to `"Agent"` when `isInternal` — "Agent" = customer agent's engagement time |

### admin — target

| Element | Current | Target |
|---|---|---|
| ManualTaskList showOwnership | `true` (outsourced) | `false` — admin doesn't create agent requests |
| Sidebar "You" time label | `agentSeconds` | Relabel to `"Agent"` when `isInternal` — same fix as SP |

---

## Section 3: Adaptation plan

| # | Item | Category | Role(s) | File(s) |
|---|---|---|---|---|
| 1 | PropertyHero serviceType badge: hide for SP | A — Hide | SP | `PropertyHero.tsx` (add `hideServiceTypeBadge?: boolean` prop) + `page.tsx` |
| 2 | ManualTaskList `showOwnership`: false for SP + admin | A — Hide | SP, Admin | `page.tsx` |
| 3 | ManualTaskList `perspective`: "progressor" for SP | B — Behaviour | SP | `page.tsx` |
| 4 | Sidebar `isInternal` time label "You" → "Agent" | B — Copy | SP, Admin | `TransactionSidebar.tsx` |
| 5 | "With SP since" display using `assignedAt` | C — New | SP | See Section 4 |

**Total: 2 Category A, 2 Category B, 1 Category C.**

Items 1–4 are single-file or two-file changes, fully additive. Item 5 is the one feature build.

---

## Section 4: New functionality details

### Item 5 — "With SP since" display (Category C)

**What:** Show how long the SP has been assigned to this file. Relevant only for SP viewing their own assigned files. Could surface in PropertyHero (near status) or sidebar (near assignedUser row).

**Data availability:**

| Field | Exists? | Notes |
|---|---|---|
| `PropertyTransaction.assignedAt` | **YES** — `DateTime?` in schema | Set when SP is assigned. Present if file is outsourced with SP assigned. |
| `PropertyTransaction.serviceTypeChangedAt` | **NO** | No timestamp for when `serviceType` was changed from `self_managed` to `outsourced`. |
| Activity log entry for assignment | **NO** | `EventType` enum does not include `file_assigned_to_user`. |
| `FileTimeSession` breakdown | **YES** | Already computed: `agentSeconds` / `teamSeconds`. Shows relative engagement. |

**What we CAN show:** "Managing since [assignedAt date]" — a simple tenure display. If `assignedAt` is null (file assigned before the field was added), fall back silently.

**What we CANNOT show without a migration:** How long the file was self-managed before being outsourced. There is no `serviceTypeChangedAt` field and no audit trail for the serviceType transition. Defer the "was self-managed for X days then outsourced" widget to a future migration pass.

**Where to surface:** Sidebar, under the "Assigned" row. One line: "Managing since [date] · [N weeks]". Only rendered when `isInternal && transaction.assignedAt`.

**Data requirement:** `assignedAt` must be included in the transaction data returned to the page. `getTransactionByScope` uses Prisma `findFirst` with `include` (not a narrow `select`), so all scalar fields including `assignedAt` should be returned. **Verify before implementation**: confirm `transaction.assignedAt` is accessible in the page. If `getTransaction` uses a narrow select, add `assignedAt` to the include/select.

**Complexity:** Small. No migration. No new query. One new line in TransactionSidebar when `isInternal && assignedAt`.

**Belongs in this pass?** YES — small, data is available, Ellis asked about it explicitly. Implement alongside A/B items.

---

## Section 5: Self-managed vs outsourced milestone paths

### What MilestonePanel renders

`MilestonePanel` receives two pre-computed arrays: `vendor: EnrichedDef[]` and `purchaser: EnrichedDef[]`. These are populated by `getMilestonesForTransaction(id, agencyId)` which fetches definitions for the transaction's `serviceType`.

The milestone definitions use `VM*` codes (vendor-side milestones) and `PM*` codes (purchaser-side milestones). **The service-type branching (which milestone set to load) happens in `getMilestonesForTransaction`, not in `MilestonePanel`.** The panel is serviceType-agnostic — it renders whatever vendor/purchaser arrays it receives.

### SP only sees outsourced files

SP's data scope is `assignedUserId = spId`. The outsourced milestone path (PM/VM codes with the full UK conveyancing workflow) is the only path SP files use. The self-managed path is identical in structure — the same milestone definitions apply; what differs is who is responsible for progressing them (agent vs SP). MilestonePanel renders the same component either way.

**Conclusion: No milestone branching work needed for role-coverage. The infrastructure is already correct.**

### Admin sees both

Admin (`kind: "all"`) can view any transaction — both self_managed and outsourced. `getMilestonesForTransaction` loads the correct milestone set per transaction. `MilestonePanel` renders it correctly. **No adaptation needed for admin on milestones.**

---

## Section 6: Time-active split — data reality

Ellis asked specifically about this. Full answer:

**Available data:**
- `PropertyTransaction.assignedAt` — YES, exists. When the SP was assigned to the file.
- `PropertyTransaction.createdAt` — when the file was created (offer accepted).
- `FileTimeSession` — records engagement time by user, split by role in page.tsx into `agentSeconds` / `teamSeconds`.

**Not available:**
- `serviceTypeChangedAt` — does NOT exist in schema. No record of when a file was upgraded from self_managed to outsourced.
- Any audit log entry for service type change — `EventType` enum does not include this transition.

**What can be built without a migration:**
1. "Managing since [assignedAt]" — simple tenure display in sidebar. Data exists.
2. Engagement time split (agent vs SP team) via FileTimeSession — already computed, already shown in sidebar when `isInternal`. Only needs label fix (see Item 4).

**What requires a migration:**
- "Self-managed for X days → Outsourced for Y days" — full phase timeline. Needs `serviceTypeChangedAt DateTime?` field. Not in schema, would require a migration plus a backfill strategy for existing files (most files pre-date this field, so the self-managed phase start is lost for historical data).

**Decision for Ellis:** Does the time-active split widget (Section 4, Item 5) show "Managing since [date]" only? Or is the full phase timeline (including self-managed phase) required for this pass? The full phase timeline requires a migration that cannot be backfilled accurately.

**My recommendation:** Build the simple "Managing since [date]" display in this pass (no migration, no backfill). Defer the full phase timeline to a future dedicated pass once the migration and backfill strategy are settled.

---

## Bugs to log (follow-ups, not fix inline)

**FU-08 — Sub-fetch agencyId fragility**  
`app/agent/transactions/[id]/page.tsx` lines 60–64: five sub-fetches pass `session.user.agencyId` (= `""` for internal staff). This works today because `""` is falsy and all service functions branch on truthiness. Correct call would be explicit `null` for internal staff. Risk: any upstream change making internal agencyId truthy would silently return empty data.

**FU-09 — `deleteCommAction` has no UI role gate**  
`components/activity/ActivityTimeline.tsx`: delete button appears for any authenticated user with access to the file. SP and admin can delete any communication entry on any transaction they can see. Backend action (`deleteCommAction`) must enforce role restriction. Recommend: SP should be able to delete their own logged comms; admin should be able to delete any. Current state unknown — needs backend audit.

**FU-10 — `confirmMilestoneAction` has no UI role gate**  
`components/transaction/NextMilestoneWidget.tsx` and `components/milestones/MilestonePanel.tsx`: any authenticated user can confirm milestones. SP managing outsourced files SHOULD be able to confirm (that's their job). Admin confirming any milestone is powerful but acceptable. Confirm backend action checks auth correctly. No UI gating needed if backend is correct.

**FU-11 — `EditSaleDetailsDrawer` actions include agent fee editing**  
The drawer calls `saveAgentFeeAction`, `savePriceAction`, `saveAddressAction`, `saveReferralAction`, etc. SP editing the agent's fee on a file they manage is likely wrong. Admin editing is probably acceptable for corrections. Backend role enforcement needs audit. UI-level: could add `isReadOnly` prop to drawer for SP but this is a larger change — defer to a permissions audit pass.

**FU-12 — `ComposeEmail` for SP: no verified sender likely configured**  
SP accounts probably don't have a verified SendGrid sender identity. The ComposeEmail component will render but the email send will fail at the API level (no verified email returned from `/api/agent/verified-emails`). Not a crash, but SP sees dead UI. Ops fix, not a code fix — configure a verified sender for SP accounts or hide ComposeEmail for SP if no verified emails exist.

---

## Section 7: Implementation order proposal

### Pass 1 — A/B items (single commit)

All in two files:

**`app/agent/transactions/[id]/page.tsx`:**
```ts
// Add:
const isProgressor = session.user.role === "sales_progressor";
const isAdminRole  = session.user.role === "admin";

// PropertyHero:
hideServiceTypeBadge={isProgressor}

// ManualTaskList:
perspective={isProgressor ? "progressor" : "agent"}
showOwnership={transaction.serviceType === "outsourced" && !isProgressor && !isAdminRole}
```

**`components/transaction/TransactionSidebar.tsx`:**
```tsx
// In the isInternal time breakdown, change:
<p>You</p>        // → <p>Agent</p>
// "Our team" stays unchanged
```

**`components/transaction/PropertyHero.tsx`:**
```tsx
// Add prop:
hideServiceTypeBadge?: boolean
// Guard the badge render:
{!hideServiceTypeBadge && serviceType && ...}
```

### Pass 2 — Category C: "With SP since" display

**`app/agent/transactions/[id]/page.tsx`:** confirm `transaction.assignedAt` is accessible; thread to `TransactionSidebar` as new prop.

**`components/transaction/TransactionSidebar.tsx`:** add `assignedAt?: Date | null` prop; render "Managing since [date] · [N weeks]" under the assignedUser row when `isInternal && assignedAt`.

Commit separately: `feat(role-coverage): /agent/transactions/[id] — SP + admin views`

---

## Open questions for Ellis

1. **"Managing since" display (Item 5):** Accept the simple "Managing since [date]" in the sidebar for this pass? Or hold until the full phase timeline (requires migration)?

2. **ComposeEmail for SP (FU-12):** Should `ComposeEmail` be hidden for SP entirely (since they almost certainly have no verified sender), or left visible and fail gracefully at send time?

3. **`deleteCommAction` UI gate (FU-09):** Should SP be able to delete comms they did NOT log (e.g. comms logged by the agent before outsourcing)? Recommend: SP can only delete their own. This needs a backend check, not a UI change. Out of scope for this pass — confirm that it's a known gap and we'll address in a permissions audit.

4. **`EditSaleDetailsDrawer` for SP (FU-11):** Should SP see the edit drawer at all (currently visible via the sidebar's edit button)? If SP shouldn't edit agent fees, the cleanest fix is to not show the edit drawer for SP at all, or hide the fee section within it. Recommend: hide the entire drawer for SP (`!isProgressor` gate on the edit button in TransactionSidebar). Admin keeps full edit access. Confirm before implementing.
