# Discovery: The Milestones Tab

**Route:** `/agent/transactions/[id]` (Milestones tab, index 1)
**Report file:** `docs/help/_discovery/property-file-milestones-tab.md`
**Word count:** ~7,200
**Code references:** ~85
**Worth-flagging items:** 12

---

**What this tab actually is (one-line summary):** The operational spine of every property file — the ordered list of every legal step required on both the vendor and purchaser sides, with the actions to confirm them, mark them not required, and undo them, plus the bilateral exchange and completion flows.

**Tab scale:** Two sides (vendor/purchaser) toggled by a tab pair. Vendor: 20 milestones in 3 sections. Purchaser: 27 milestones in 4 sections. Per row: 5 interactive zones. Two full-screen modal overlays (undo cascade preview, exchange/completion reconciliation). One overlay component (ExchangeCelebration). The most interactive surface in the agent app.

**Sections identified:**
1. Exchange readiness banner / progress bar
2. Side toggle tabs (Vendor / Purchaser)
3. Section groups with collapse affordance (3–4 per side)
4. Milestone rows (MilestoneRow per active milestone)
5. Not Required section (collapsible, bottom of list)
6. ExchangeCelebration overlay (on exchange confirmation)

**Pending diagnosis fixes — current status:**
> Sprint closed 2026-04-29 (v5). All 12 fixes shipped. Source: `AGENT_MILESTONE_DIAGNOSIS.md:6`
- Fix 4 (VM18/PM25 wiring): **LIVE**
- Fix 5 (exchange reconciliation): **LIVE**
- Fix 8 (sale details reconciliation): **LIVE**
- Fix 9 (cascade audit): **LIVE**
- Fix 10 (optimistic UI N/R + undo): **LIVE**
- Fix 11 (undo cascade preview): **LIVE**
- Fix 12 (exchange celebration): **LIVE** — for VM19/PM26; VM20/PM27 celebration is Future Work

**Specifically covered:**
- Tab identity and purpose: ✓
- Tab structure: ✓
- Milestone definition model: ✓
- Milestone row: ✓
- Confirming (simple + event-date): ✓
- Mark not required: ✓
- Reversing / undo: ✓
- Bilateral exchange / completion: ✓
- Exchange gate: ✓
- Cascade and prerequisites: ✓
- Auto-generated state from new-sale form: ✓
- Optimistic UI: ✓
- Director vs negotiator: ✓
- Empty states: ✓
- Component extraction assessment: ✓
- Worth flagging items: 12 ✓
- Pre-existing claims verified: ✓
- Page identity check: ✓

---

## 1. What this tab actually is

The Milestones tab is the second of five tabs on the property file (Overview, **Milestones**, Reminders, To-Do, Activity). It is the exclusive surface for tracking transaction progress through the milestone hierarchy — confirming each legal/financial step on both the vendor (seller) and purchaser (buyer) sides, handling bilateral exchange and completion events, and managing exceptions via the "not required" flow.

**Rendering:** The Milestones tab data is fetched server-side in the route RSC's `Promise.all` (line 51 of `app/agent/transactions/[id]/page.tsx`). The data is passed as fully-enriched props to `<MilestonePanel>`. MilestonePanel is a **client component** (`"use client"`, `components/milestones/MilestonePanel.tsx:1`) — all interactive state (optimistic updates, modals, undo flow, collapsed sections, side toggle) lives client-side.

**Panel location in route:** The Milestones tab's content is passed as the second child to `<PropertyFileTabs>` (`page.tsx:361–375`). Like all five tabs, its HTML is in the DOM from first page load (opacity-switch rendering — see article 10).

**Scale:**
- Vendor side: 20 milestones, 3 sections
- Purchaser side: 27 milestones, 4 sections
- Per row: timeline node indicator, name + metadata, event-date input (some), action buttons (Confirm / N/R / Undo), error state
- Two modal overlays rendered to `document.body` via `createPortal`: the undo cascade preview and the exchange/completion reconciliation modal
- One animated overlay component: `ExchangeCelebration` (exchange only)
- Total interactive elements per visible side: up to ~60 (one per non-locked milestone × 3 buttons)

**Data source:** `getMilestonesForTransaction(transactionId, agencyId)` (called at `page.tsx:51`). Returns vendor and purchaser arrays of `EnrichedDef` objects — each milestone definition merged with its completion record (`isComplete`, `isNotRequired`, `isAvailable` booleans pre-computed server-side).

---

## 2. Tab structure — top to bottom

All content renders inside `<MilestonePanel>` (`components/milestones/MilestonePanel.tsx`). DOM order:

### 2.1 Exchange readiness banner / progress bar (`MilestonePanel.tsx:212–249`)

Two mutually exclusive states based on the `exchangeReady` prop:

**When `exchangeReady === true`** (all blockers on BOTH sides are complete/NR):
- Emerald banner: "Ready to exchange" / "All blocking milestones are complete on both sides"
- `bg-emerald-500/15 border-emerald-400/25`, white checkmark in green circle

**When `exchangeReady === false`** (default):
- `glass-card` containing: "Exchange progress" label, percentage number (coloured by threshold), animated gradient progress bar with shimmer, "{done} of {total} milestones complete" text
- Progress bar gradient thresholds (hard-coded, lines 164–168): <40% → purple-to-blue, 40–75% → blue-to-emerald, >75% → emerald
- Progress bar width: `Math.max(progressPct, 2)` — minimum 2% so the bar is always visible
- The bar has a `ms-shimmer-anim` CSS animation running continuously (lines 243–246)

**Progress calculation (`MilestonePanel.tsx:156–161`):**
```typescript
const applicableMs = milestones.filter((m) => !m.isNotRequired);
const completedWeight = applicableMs.filter((m) => m.isComplete).reduce((s, m) => s + Number(m.weight), 0);
const progressPct = applicableWeight > 0 ? Math.round((completedWeight / applicableWeight) * 100) : 100;
```
Weighted by `MilestoneDefinition.weight` (sums to 100 per side). NR milestones excluded from both numerator and denominator. If all applicable milestones are NR (`applicableWeight === 0`), returns 100%.

**Note:** `exchangeReady` is computed from both sides simultaneously. The banner does not toggle per-side — it shows the overall exchange readiness, not per-vendor or per-purchaser.

### 2.2 Side toggle tabs (`MilestonePanel.tsx:252–283`)

Two buttons: "Vendor" and "Purchaser". Each shows a "{done}/{total}" count in muted text.

- Active tab: underline `border-b-2 border-coral` (agent coral colour)
- Switching tab recomputes section collapse state for the new side (section is auto-collapsed if all its rows are complete)
- The `activeTab` state is local to MilestonePanel — not persisted to URL or TabContext
- Gate-ready badge: a green dot appears next to the side label when `vendorGateReady` or `purchaserGateReady` is true — not confirmed in MilestonePanel:252–283 area but `gateReady` prop used there

### 2.3 Section groups (`MilestonePanel.tsx:292–359`)

Milestones are grouped into named sections defined at the top of MilestonePanel:

**Vendor sections (`MilestonePanel.tsx:17–21`):**
| Section | Milestones |
|---|---|
| Onboarding | VM1–VM6 |
| Conveyancing | VM7–VM17 |
| Exchange & Completion | VM18–VM20 |

**Purchaser sections (`MilestonePanel.tsx:23–28`):**
| Section | Milestones |
|---|---|
| Onboarding | PM1–PM4 |
| Finances | PM5, PM6, PM11, PM9, PM10 |
| Conveyancing | PM7–PM8, PM12–PM24 |
| Exchange & Completion | PM25–PM27 |

**Note:** The Finances section order `PM5, PM6, PM11, PM9, PM10` does not follow milestone order index strictly — PM9/PM10 are survey milestones grouped with finance milestones. This is intentional grouping, not a data order.

**Section header:** A collapsible button showing the section name, a coloured dot (`SECTION_COLORS` map, line 9–15), and a progress badge ("{done}/{total} in section"). Clicking toggles `collapsed[section.label]`.

**Auto-collapse logic (`initialCollapsed`, lines 63–72):** A section starts collapsed if ALL of its non-NR rows are complete. This means a completed file opens with all sections collapsed. Switching sides recomputes collapse state.

**Section body:** A `glass-card` containing the milestone rows for that section. Rows where `isNotRequired` is `true` are filtered out before passing to section rendering (line 293 context). NR milestones go to the separate "Not required" section below.

### 2.4 Milestone rows (`MilestoneRow.tsx`)

One `<MilestoneRow>` per non-NR milestone in each section. See §4 for full detail.

### 2.5 Not Required section (`MilestonePanel.tsx:362–393`)

A collapsible section at the bottom of the list. Only visible when `nrMilestones.length > 0`. Title: "Not required ({count})". Collapsed by default (`nrCollapsed: true`).

Each NR milestone renders as `<NotRequiredRow>` (`components/milestones/NotRequiredRow.tsx`). See §6 for detail.

### 2.6 ExchangeCelebration overlay (`components/milestones/ExchangeCelebration.tsx`)

A confetti + modal overlay that renders over the whole page when exchange is confirmed (VM19 or PM26). Fires via React state in MilestoneRow after `confirmMilestoneAction` returns `triggeredCelebration: true`. See §8 for detail. No equivalent overlay for completion (VM20/PM27) — marked as Future Work in the diagnosis doc.

---

## 3. The milestone definition model

### 3.1 Where definitions live

**Seed file:** `prisma/seed.ts:69–320`. Vendor milestones at lines 71–173 (20 definitions). Purchaser milestones at lines 175–319 (27 definitions). Total: **47 milestones**.

**No spreadsheet at runtime** — the seed file is the canonical source. A spreadsheet was used to author the data but the code reads only from the DB (seeded data).

### 3.2 MilestoneDefinition schema (`prisma/schema.prisma:349–365`)

```prisma
model MilestoneDefinition {
  id                String        @id @default(cuid())
  code              String        @unique
  name              String
  side              MilestoneSide   // "vendor" | "purchaser"
  orderIndex        Int
  blocksExchange    Boolean       @default(true)
  eventDateRequired Boolean       @default(false)
  predecessorCode   String?
  canBeMarkedNr     CanBeMarkedNr @default(never)
  summaryTemplate   String        @default("")
  weight            Decimal       @default(0)
  createdAt         DateTime      @default(now())
  completions       MilestoneCompletion[]
  reminderRules     ReminderRule[]  @relation("AnchorMilestone")
}
```

**Field notes:**
- `code`: Unique string identifier. Vendor: VM1–VM20. Purchaser: PM1–PM27.
- `name`: Human-readable display name. E.g. "Seller has instructed their solicitor".
- `side`: Enum — `vendor` or `purchaser`.
- `orderIndex`: Display order within side (1–20 vendor, 1–27 purchaser). Controls sequencing.
- `blocksExchange`: `true` means this milestone must be complete or NR before the exchange gate (VM18/PM25) unlocks. `false` for the gate milestones themselves (VM18, PM25) and for post-exchange milestones (VM19, VM20, PM26, PM27).
- `eventDateRequired`: `true` for PM6 (lender valuation), PM9 (private survey), PM26 (exchange), PM27 (completion). These trigger the inline date-picker UI. `false` for all others, including VM19/VM20 (exchange/completion on vendor side — those use the reconciliation modal's date field instead).
- `predecessorCode`: Single nullable string. The code of the one milestone that must be complete/NR before this one becomes available. E.g. PM26 has `predecessorCode: "PM25"`. Most milestones have a predecessor; a few entry-points (VM1, PM1) do not.
- `canBeMarkedNr`: Enum with three values: `never` (default, most milestones), `auto_only` (auto-NR at file creation only — VM8, VM9, PM5, PM6, PM11, PM12), `manual_allowed` (user can manually mark NR — PM9 only).
- `summaryTemplate`: Optional template with `{agent}`, `{vendors}`, `{solicitor}` tokens. Used to auto-generate `summaryText` on the MilestoneCompletion record.
- `weight`: Decimal (sums to 100 per side). Used for weighted progress calculation.

### 3.3 MilestoneCompletion schema (`prisma/schema.prisma:372–394`)

```prisma
model MilestoneCompletion {
  id                    String         @id @default(cuid())
  transactionId         String
  milestoneDefinitionId String
  state                 MilestoneState @default(locked)
  completedAt           DateTime?
  eventDate             DateTime?
  notRequiredReason     String?
  completedById         String?
  confirmedByPortal     Boolean        @default(false)
  summaryText           String?
  reconciledAtExchange  Boolean        @default(false)
  outOfOrderCompletion  Boolean        @default(false)
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt
  @@unique([transactionId, milestoneDefinitionId])
  @@index([transactionId, completedAt])
}
```

**Field notes:**
- `state`: One of four values (see §3.4).
- `completedAt`: Server timestamp when confirmed (or bulk-swept at reconciliation).
- `eventDate`: Explicit date entered by user — used for PM6 (valuation date), PM9 (survey date), PM26 (exchange date), PM27 (completion date). Also populated for VM19 via the reconciliation modal's exchange date field.
- `notRequiredReason`: Free text. Set to "Auto-set at file creation" for tenure/purchase-type auto-NR. Set to "Buyer confirmed no private survey required" for manual PM9 NR.
- `completedById`: User ID of whoever confirmed it. Null for portal-confirmed and auto-NR milestones.
- `confirmedByPortal`: `true` if confirmed via the client portal. In MilestoneRow, renders a "Client confirmed" badge next to the date.
- `summaryText`: Auto-generated on confirm from `summaryTemplate`. Stored per-completion and used in the "Last progress" cell on the Overview tab.
- `reconciledAtExchange`: Added in Fix 5. `true` on milestones bulk-completed during the exchange/completion reconciliation modal. Used by analytics to exclude these from cycle-time aggregation.
- `outOfOrderCompletion`: Added in Fix 11. `true` on downstream milestones left complete when user undoes their parent in "target only" mode. Self-resolves when the parent is re-confirmed.

### 3.4 The four milestone states

Enum `MilestoneState` in Prisma. Values used in code (`lib/services/milestones.ts:128, 361`):

| State | Meaning | Enum value |
|---|---|---|
| **Locked** | Predecessor not yet complete/NR. Cannot be confirmed. | `"locked"` |
| **Available** | Predecessor satisfied (complete or NR), or no predecessor. Actions enabled. | `"available"` |
| **Complete** | Confirmed by user or portal. Counts toward progress. | `"complete"` |
| **Not required** | Does not apply to this file. Excluded from progress denominator. | `"not_required"` |

Milestones are created with `state: "locked"` or `state: "available"` or `state: "not_required"` at file creation by `initializeMilestoneCompletions()` (`lib/services/milestones.ts:88–151`). They are never created with `state: "complete"`.

### 3.5 Milestone categories by section (not exhaustive lists)

Rather than listing all 47, the sections match the UI groupings:

**Vendor side (VM1–VM20):**
- *Onboarding (VM1–VM6):* Instructing solicitor, memo of sale, early client communications
- *Conveyancing (VM7–VM17):* Searches, contract pack, enquiries, mortgage (vendor-side), leasehold pack, exchange readiness steps
- *Exchange & Completion (VM18–VM20):* VM18 = exchange gate ("Vendor ready to exchange"), VM19 = exchange confirmation, VM20 = completion

**Purchaser side (PM1–PM27):**
- *Onboarding (PM1–PM4):* Instructing solicitor, memo of sale, early steps
- *Finances (PM5, PM6, PM11, PM9, PM10):* Mortgage application (PM5), lender valuation (PM6), mortgage offer (PM11), private survey (PM9), survey report (PM10)
- *Conveyancing (PM7–PM24):* Searches, contract pack, enquiries, anti-money laundering, pre-exchange steps
- *Exchange & Completion (PM25–PM27):* PM25 = exchange gate ("Purchaser ready to exchange"), PM26 = exchange confirmation, PM27 = completion

---

## 4. The milestone row

**Component:** `components/milestones/MilestoneRow.tsx`

Each row renders in this DOM order:

### 4.1 Timeline node (lines 298–323)

A 20×20px circle on the left edge, visually representing the milestone's state:

| State | Appearance |
|---|---|
| Complete | Emerald circle + white checkmark. Animation: `ms-node-pop` (360ms spring pop on transition to complete). |
| Complete, just confirmed | Same as above, triggered by `addOptimistic("complete")`. |
| Available (normal) | White circle with a small blue dot inside. |
| Available (exchange gate — `isGate`) | White circle with an amber dot + "Exchange gate" label beside the name. |
| Available (post-exchange) | White circle, minimal style. |
| Locked | White circle with grey lock icon. |
| Just unlocked (transition from locked → available) | `ms-node-unlock` animation (340ms spring) on the timeline node, plus `ms-unlock-enter` animation (900ms ease-out) on the row background. |

### 4.2 Name and metadata (lines 327–345)

- **Milestone name** — dark text when complete/available, lighter when locked or post-exchange
- **Gate badge** — amber "Exchange gate" tag (only for VM18/PM25 when available)
- **If complete:** "Completed [relative date]" in muted text, `eventDate` if present ("Valuation date: 12 May 2026"), "Client confirmed" badge if `confirmedByPortal: true`
- **If locked:** "Previous milestones must be completed first" in muted italic
- **If error:** Red inline error text below the name (set by `setError()` on server action failure)

### 4.3 Inline event-date input (lines 348–389, conditional)

Appears when `showEventDate === true`. This state is set by `handleConfirmClick()` on milestones where `def.eventDateRequired` is true. Only four milestones trigger this: **PM6, PM9, PM26, PM27**.

Contents:
- Label from `getEventDateLabel(def.code)` (from `lib/portal-copy.ts`): "Valuation date" (PM6), "Survey date" (PM9), "Exchange date" (PM26), "Completion date" (PM27)
- Date input field (HTML date picker)
- **PM6 only:** "Desktop valuation — no date" checkbox (lines 377–386). When checked, date input is disabled. Confirm fires with `eventDate: null`. Fix 7.
- "Confirm" button — disabled until `eventDate` is set OR (PM6 and `desktopValuation` is checked)
- "Cancel" button — resets `showEventDate` to false, clears the date

**Note for VM19/PM26/VM20/PM27:** These are in `RECONCILIATION_CODES` set (`MilestoneRow.tsx:33`), so clicking Confirm on them does NOT open the inline date picker — it instead triggers the reconciliation flow (`getExchangeReconciliationList`). PM26 has `eventDateRequired: true` in the DB, but the RECONCILIATION_CODES check takes precedence. PM27 similarly.

### 4.4 Action buttons (lines 408–439)

**Condition summary:**

| Button | Shows when | Notes |
|---|---|---|
| **Confirm** | `effectivelyAvailable && !showEventDate && !showNotRequired` | Disabled during `isPending` |
| **N/R** | `effectivelyAvailable && canBeNR` (`NR_ALLOWED.has(def.code)`) | PM9 only |
| **Undo** | `isDone` (complete or optimisticallyComplete) | Always shown on complete rows |

`effectivelyAvailable = def.isAvailable || optimisticallyAvailable`

**Confirm** button text: "Confirm" normally; "Confirming…" (with spinner) while `isPending`.

**Undo** button: grey text link, no border. Text: "Undo" normally; "…" while `loading`.

### 4.5 Row background colours (`rowBg`, lines 286–290)

| Condition | Background |
|---|---|
| Complete | `bg-green-50/40` |
| Available, `isGate` | `bg-amber-50/60` |
| Available, post-exchange | `bg-white/5` |
| Locked | `bg-white/10` |
| Just unlocked | Overridden by `ms-unlock-enter` animation |

---

## 5. Confirming a milestone

### 5.1 Simple confirm (no event date, no reconciliation)

**Applies to:** All milestones except PM6, PM9, PM26, PM27 (event-date) and VM19, PM26, VM20, PM27 (reconciliation). In practice: VM1–VM18, VM20 (wait — VM20 is in RECONCILIATION_CODES too). So simple confirm applies to VM1–VM17 and PM1–PM24 except PM6 and PM9, plus PM25.

**Trigger:** User clicks "Confirm" on an available milestone.

**Flow in MilestoneRow:**
1. `handleConfirmClick()` (lines 112–120) checks `RECONCILIATION_CODES.has(def.code)` first.
2. If not a reconciliation code, checks `def.eventDateRequired`.
3. If no event date needed, calls `doComplete()`.
4. `doComplete()` (lines 122–174):
   - Calls `onConfirmStart(def.id, def.code)` — triggers parent's `handleConfirmStart` to optimistically unlock dependents
   - `addOptimistic("complete")` — immediate visual state change
   - `startTransition(() => { confirmMilestoneAction(...); })`

**Server action:** `app/actions/milestones.ts` → `confirmMilestoneAction({ transactionId, milestoneDefinitionId, eventDate? })`
- Session check + access scope check
- Calls `completeMilestone()` in `lib/services/milestones.ts`

**Inside `completeMilestone()` (lib/services/milestones.ts:452–558):**
- `MilestoneCompletion.upsert` with:
  - `state: "complete"`
  - `completedAt: new Date()`
  - `eventDate: input.eventDate ?? null`
  - `completedById: session.user.id`
  - `summaryText`: auto-generated from `summaryTemplate` if the definition has one
  - Clears `notRequiredReason`
- `unlockDirectDependents()` — re-evaluates availability of milestones that list this code as their `predecessorCode`
- `autoCompleteRemindersForMilestone()` — marks reminder logs targeting this milestone code as completed
- `maybeUnlockExchangeGate()` — checks if all `blocksExchange: true` milestones on this side are now done/NR; if so, sets VM18 or PM25 to `"available"`. See §9.

**Bilateral pairing for VM19/PM26 and VM20/PM27 in `confirmMilestoneAction`:**
Handled separately — these codes are in `RECONCILIATION_CODES` and never reach the simple confirm path. See §8.

**Side-effects after `completeMilestone`:**
- `sendAdminMilestoneNotificationToPortal()` — emails vendor/purchaser portal contacts with milestone-specific copy
- `pushToTransaction()` — live push notification on client portal
- `maybeFireFirstExchangeEmail()` — fires additional email on certain milestones (verified for VM19/PM26)
- Toast: `toast.success(def.name)` or special exchange message
- `revalidatePath` — triggers RSC re-render to refresh all tab data

**Optimistic unlock cascade in MilestonePanel:**
When `onConfirmStart` fires, `unlockDependents()` (`MilestonePanel.tsx:104–124`) checks DIRECT_PREREQUISITES for all locked milestones. If the confirmed code satisfies all prereqs for a locked milestone, that milestone's ID is added to `optimisticallyUnlockedIds`. Child rows receive `optimisticallyAvailable` prop and render as available before the server re-render arrives.

### 5.2 Event-date confirm (PM6, PM9)

**Applies to:** PM6 and PM9 only (PM26/PM27 are reconciliation codes, described in §8).

**Trigger:** User clicks "Confirm" on PM6 or PM9.

**Flow:** `handleConfirmClick()` detects `def.eventDateRequired === true` (and code is NOT in RECONCILIATION_CODES). Sets `setShowEventDate(true)`. The inline date picker appears in the row.

**PM6 — lender valuation:**
- Date label: "Valuation date"
- Desktop valuation checkbox: "Desktop valuation — no date" — when checked, date input disabled, Confirm enabled without a date, sends `eventDate: null`

**PM9 — private survey:**
- Date label: "Survey date"
- No desktop-valuation checkbox
- Standard date picker

**After user fills in date and clicks Confirm:** Same `doComplete()` flow as simple confirm but with `eventDate` set.

**Server-side:** `completeMilestone` accepts `eventDate: null` for any milestone — `eventDateRequired` is a UI-only gate. No server enforcement of the date presence.

---

## 6. Marking a milestone as "not required"

### 6.1 The NR whitelist

**Only PM9** can be manually marked NR by an agent user.

Hardcoded in `MilestoneRow.tsx:31`:
```typescript
const NR_ALLOWED = new Set(["PM9"]);
```

The `canBeMarkedNr` enum on `MilestoneDefinition` has three values:
- `never` — most milestones; cannot be marked NR at all
- `auto_only` — auto-NR at file creation only (VM8, VM9, PM5, PM6, PM11, PM12); cannot be manually marked NR by user
- `manual_allowed` — PM9 only; user can manually mark NR

`NR_ALLOWED` in the component is consistent with `manual_allowed` in the schema.

**Portal NR whitelist (different):** The portal has `PORTAL_NOT_REQUIRED_WHITELIST = { PM9: ["PM10"] }` in `lib/services/portal.ts:867`. Portal clients can also mark PM9 NR (with PM10 as cascade). Not relevant to the agent app tab.

### 6.2 The N/R flow

**Trigger:** User clicks "N/R" button on PM9 (the only available N/R button).

**Step 1:** `handleNRClick()` (MilestoneRow, ~line 248). Sets `showSurveyNrConfirm: true`.

**Step 2:** Confirmation modal renders (via `createPortal` to `document.body`, lines 549–597 approximately):
- Title: "No private survey required?"
- Body: "Please confirm the buyer does not require a private Level 2 or Level 3 survey. The survey report milestone will also be marked as not required."
- Buttons: "Yes, mark as not required" / "Cancel"

**Step 3:** On confirm: `addOptimistic("not_required")` + `startTransition(() => markNotRequiredAction(...))`

**Server action:** `app/actions/milestones.ts:254–281` → `markNotRequiredAction`
- Calls `markNotRequiredWithCascade()` in `lib/services/milestones.ts`
- Checks `NR_CASCADE` map (`PM9: ["PM10"]`, line 31 in lib/services/milestones.ts)
- Marks PM9 `not_required` with `notRequiredReason: "Buyer confirmed no private survey required"`
- Also marks PM10 `not_required` with the same reason (cascade)
- Calls `maybeUnlockExchangeGate()` — NR counts as satisfied for exchange gating
- Calls `unlockDirectDependents()` — NR counts as satisfied for predecessor unlocking

**What gets written:**
- `state: "not_required"`
- `notRequiredReason: "Buyer confirmed no private survey required"` (PM9) / same (PM10)
- Clears `completedAt`, `eventDate`, `summaryText`

### 6.3 How NR milestones display

- Filtered out of the main section rows in MilestonePanel (line 293 context)
- Collected into `nrMilestones` array
- Rendered as `<NotRequiredRow>` in the collapsible "Not required" section at the bottom

**NotRequiredRow (`components/milestones/NotRequiredRow.tsx`):**
- Shows milestone name in muted text
- Shows `notRequiredReason` in italic (e.g. "Tenure: Freehold")
- Shows completion date if any
- "Reinstate" button (always visible in the row)

### 6.4 How NR affects exchange gating

`maybeUnlockExchangeGate()` treats NR milestones as equivalent to complete for the gate check:
```typescript
blockers.every((b) => state === "complete" || state === "not_required")
```
Source: `lib/services/milestones.ts:242–245`.

### 6.5 Can NR be undone?

**Yes.** The "Reinstate" button in `NotRequiredRow` calls `reverseMilestoneAction()`. For PM9, a follow-up modal asks whether the buyer is now getting a mortgage (if yes, PM5/PM6/PM11 are also reinstated). For other auto-NR milestones (reinstated only by admin flows), the reversal just reverts to the computed available/locked state.

**Role restriction per spec:** Directors and progressors only. **Not enforced in UI code** — "Reinstate" is visible to all roles. Server action does not verify role. See §16 item 4.

---

## 7. Reversing a confirmed milestone

### 7.1 The Undo affordance

**Button:** "Undo" text link, rendered when `isDone` is true (row is complete — either genuinely or optimistically). Located at line 435–438 in MilestoneRow.tsx. Grey, no border. All complete rows show this button — there is no role gate in the UI.

### 7.2 Cascade preview modal (Fix 11 — LIVE)

Clicking "Undo" triggers a **two-step flow**:

**Step 1 — Read impact:**
- Calls `getUndoImpactAction({ transactionId, milestoneDefinitionId })` (server action, `app/actions/milestones.ts:319–331`)
- Server calls `getUndoImpact()` (`lib/services/milestones.ts:890–975`)
- Returns: `cascade` list (downstream completed milestones), `currentPercent`, `targetOnlyPercent`, `cascadePercent`
- Sets `undoData` state, sets `showUndoModal: true`

**Step 2 — Show modal (portal, `createPortal` to `document.body`, lines 597–764):**

- Header: "Undo milestone" + target milestone name

**If cascade is empty (no downstream completions):**
- Simple "Are you sure?" confirmation
- One "Undo milestone" button

**If cascade exists:**
- Two radio options:
  1. **"Undo this milestone only"** — reverses target, leaves downstream complete (sets `outOfOrderCompletion: true` on them). Shows `targetOnlyPercent` projection.
  2. **"Undo this and downstream milestones ({count})"** — reverses target + all downstream. Shows `cascadePercent` projection.
- Cascade list: collapsible, shows first 5 then "Show {n} more" button (line 705, threshold 5)
- Each cascade item: milestone name + "reconciled" badge if `reconciledAtExchange: true` (line 711–713)

**Step 3 — Execute:**
- "Undo milestone" button calls `executeUndoMilestoneAction({ transactionId, milestoneDefinitionId, mode })` (server action, `app/actions/milestones.ts:333–355`)

### 7.3 What reverses

**Inside `executeUndoMilestone()` atomic transaction (`lib/services/milestones.ts:1078–1186`):**

1. **Primary milestone (+ bilateral partner):**
   - Undoing VM19 also undoes PM26 (if confirmed). Undoing VM20 also undoes PM27. (`BILATERAL_UNDO_PAIRS`, lines 995–1002)
   - State reverts to computed available/locked based on whether prereqs are still met
   - Clears `completedAt`, `completedById`, `summaryText`, `reconciledAtExchange`, `outOfOrderCompletion`

2. **In cascade mode:** All downstream completed milestones receive the same reset.

3. **Re-lock available dependents:** Any currently-available milestone whose direct prereq is the reversed code gets re-locked (lines 1111–1117).

4. **In target-only mode:** Downstream milestones get `outOfOrderCompletion: true` (lines 1119–1125). They remain `state: "complete"` but are flagged. The flag self-resolves when the parent is re-confirmed.

5. **Gate re-lock:** `maybeLockExchangeGate()` called inside the transaction (line 1128). Checks if gate is currently available; if any blocker is no longer complete/NR after the undo, sets gate back to `"locked"`. Creates an internal communication record.

6. **Reminder cleanup:** Active reminder logs targeting reversed codes are cancelled (lines 1132–1151).

### 7.4 Optimistic undo

`addOptimistic("reverse")` sets `isComplete: false, isNotRequired: false` immediately (MilestoneRow:43–44). Parent's `handleUndoStart()` re-locks any dependents that are currently available but depended on the undone milestone.

---

## 8. Bilateral exchange and completion

### 8.1 VM18 / PM25 — the exchange gate milestones

**Are they independently confirmable?** **Yes.** Fix 4 removed any pairing between them.

VM18 and PM25 are on different sides (vendor/purchaser) and are confirmed independently. Confirming VM18 does NOT auto-confirm PM25. Each must be manually confirmed once all blockers on their respective sides are complete.

**`blocksExchange: false`** for both (seed.ts:158, 277). They are the gate milestones, not blockers.

**Predecessor:** VM18 has `predecessorCode: "VM17"`. PM25 has `predecessorCode: "PM24"`. They become available only after all milestones on their side are complete (via the gate unlock, not just the predecessor check — see §9).

**UI:** When available, renders with amber dot + "Exchange gate" label. Confirm button enabled. Simple confirm (no reconciliation, no event date).

### 8.2 VM19 / PM26 — bilateral exchange

These are in `RECONCILIATION_CODES` (`MilestoneRow.tsx:33`). Clicking Confirm on either triggers the reconciliation flow — the inline date picker does NOT open even though PM26 has `eventDateRequired: true` in the DB.

**Counterpart-readiness check (Phase 1 fix — 2026-05-08):**

Before opening the reconciliation modal, `handleConfirmClick` in MilestoneRow now checks whether the counterpart side is ready. The check runs when the milestone is in `RECONCILIATION_CODES` and a `counterpartNotice` prop has been passed down from MilestonePanel.

- For **VM19** (vendor exchange): the check passes only if PM25 (purchaser gate) is `complete` or `not_required`. If PM25 is still pending, `showCounterpartNotice` is set to `true` and an inline amber notice renders: *"Both sides must be ready to exchange before exchange can be confirmed. The purchaser side is still at '{PM25 name}'."*
- For **PM26** (purchaser exchange): the check passes only if VM18 (vendor gate) is `complete` or `not_required`. If VM18 is still pending, the inline amber notice renders: *"Both sides must be ready to exchange before exchange can be confirmed. The vendor side is still at '{VM18 name}'."*

The notice replaces the Confirm/N/R action buttons. An **OK** button dismisses the notice and returns the row to its available state. `onConfirmStart` (optimistic unlock cascade) is NOT fired when the notice is shown — the optimistic unlock only fires when the user actually proceeds.

MilestonePanel computes whether the counterpart is ready via `getCounterpartNotice(code)` using `allMilestoneLookup` (a Map built from both vendor and purchaser arrays). No additional server roundtrip is needed — the data is already in memory.

**The two-step reconciliation flow:**

**Step 1 — Fetch outstanding:**
- `getExchangeReconciliationList({ transactionId, side: "vendor" | "purchaser" })` (server action)
- Returns all incomplete, non-NR milestones on BOTH sides (excluding VM18/PM25 themselves and post-exchange codes)
- These are milestones the agent can optionally mark as reconciled at exchange

**Step 2 — Show reconciliation modal (`createPortal`, lines 469–594):**
- Title: "Confirm exchange" (for VM19 or PM26)
- Exchange date field: date picker (required). This date is applied to `eventDate` on VM19/PM26 completion and synced to `PropertyTransaction.expectedExchangeDate`.
- List of outstanding milestones with checkboxes — agent checks which ones are actually completed
- For any checked milestone with `eventDateRequired: true`: an additional date field appears
- "Confirm exchange" button — disabled until exchange date is set

**Step 3 — Atomic write (`confirmExchangeReconciliationAction`, `app/actions/milestones.ts:364–587`):**
- All checked milestones: completed with `reconciledAtExchange: true`, `completedAt: now()`
- VM19 (or PM26): completed with the entered exchange date as `eventDate`
- VM19's counterpart PM26 (or vice versa): auto-confirmed in the same transaction
- `PropertyTransaction.expectedExchangeDate` synced to the entered exchange date (Fix 6)
- Open chase tasks for swept milestones cancelled
- Reminder logs targeting swept milestones deactivated
- `revalidatePath` fires

**ExchangeCelebration overlay (Fix 12):**
- Server action returns `{ triggeredCelebration: true, propertyAddress }` when code is VM19 or PM26 (lines 246–250)
- Client renders `<ExchangeCelebration>` — confetti + modal "Exchange confirmed" with property address and congratulations copy
- Standard toast suppressed when celebration fires
- `ExchangeCelebration.tsx`: confetti 120 pieces, 3s duration, 600ms fade (hard-coded, lines 20, 38)

**No celebration for VM20/PM27** — marked as Future Work in AGENT_MILESTONE_DIAGNOSIS.md.

### 8.3 VM20 / PM27 — bilateral completion

**Counterpart-readiness check (Phase 1 fix — 2026-05-08):**

For **VM20** and **PM27**, `getCounterpartNotice(code)` checks whether both VM19 (vendor exchange) and PM26 (purchaser exchange) are `complete`. If either is not complete, the inline amber notice renders: *"Exchange must be confirmed on both sides before completion can be recorded."* The reconciliation modal does not open.

Same pattern as VM19/PM26 for everything else:
- Both codes in `RECONCILIATION_CODES`
- Same two-step reconciliation flow
- Modal title: "Confirm completion"
- Completion date entered in modal; synced to `PropertyTransaction.completionDate`
- Outstanding milestones shown with checkboxes
- Atomic write: PM27 (or VM20) auto-confirmed as counterpart
- `reconciledAtExchange: true` on swept milestones (note: same field used for completion sweep)
- No celebration overlay (Future Work)

---

## 9. The exchange gate

### 9.1 maybeUnlockExchangeGate logic (`lib/services/milestones.ts:209–268`)

Called after every `completeMilestone()` and `markNotRequired()` in `lib/services/milestones.ts`.

Algorithm:
1. Find gate definition for the same side as the just-completed milestone (VM18 for vendor, PM25 for purchaser)
2. Find the gate's current MilestoneCompletion. If not `"locked"`, return immediately (already unlocked)
3. Find all MilestoneDefinitions on the same side with `blocksExchange: true`
4. Get all MilestoneCompletions for those blockers
5. Check: `blockers.every(state => state === "complete" || state === "not_required")`
6. If all clear: set gate `state: "available"`, create internal communication record "Vendor/Purchaser side ready to exchange"
7. If not all clear: return without change

### 9.2 blocksExchange values

Verified from `prisma/seed.ts`:

| Codes | blocksExchange | Notes |
|---|---|---|
| VM1–VM17 | `true` | Regular vendor milestones; must be done to unlock VM18 |
| VM18 | `false` | Gate itself; excluded from its own check |
| VM19, VM20 | `false` | Post-exchange; not blockers |
| PM1–PM24 | `true` | Regular purchaser milestones; must be done to unlock PM25 |
| PM25 | `false` | Gate itself; excluded from its own check |
| PM26, PM27 | `false` | Post-exchange; not blockers |

### 9.3 UI treatment

**Gate locked (VM18/PM25 in `"locked"` state):** Rendered with grey lock icon, dimmed text, no action buttons. Text: "Previous milestones must be completed first."

**Gate available (VM18/PM25 in `"available"` state):** Rendered with amber dot + "Exchange gate" label. Row background `bg-amber-50/60`. Confirm button enabled. Simple one-click confirm (no event date, no reconciliation).

**Both gates confirmed (exchangeReady):** The top progress bar area is replaced with the green "Ready to exchange" banner. `exchangeReady` is computed server-side and passed as prop.

### 9.4 Gate re-lock on undo

`maybeLockExchangeGate()` (`lib/services/milestones.ts:274–322`) is called inside `executeUndoMilestone` (Fix 11). Logic:
- If gate is currently `"available"` and any blocker on the same side is now no longer complete/NR (because it was reversed), re-lock gate to `"locked"`
- Creates internal communication record

---

## 10. Cascade and prerequisites

### 10.1 DIRECT_PREREQUISITES map

**File:** `lib/milestone-prerequisites.ts:4–43`.

A `Record<string, string[]>` mapping each milestone code to its direct prerequisite codes. The spec allows only one prerequisite per milestone, but the data structure supports multiple. Most entries have zero or one prerequisite.

Examples:
```typescript
VM3:  ["VM1"],   // Contract pack req after solicitor instructed
VM10: ["VM7"],   // Enquiries after searches
PM26: ["PM25"],  // Exchange after purchaser gate
PM27: ["PM26"],  // Completion after exchange
```

Milestones with no prerequisites (or empty array) are immediately available.

This map was audited in Fix 9 against the spec's "Hard Prerequisites" column — all 47 entries verified.

### 10.2 Cascade in MilestonePanel

After confirm or NR, `unlockDependents()` (MilestonePanel:104–124) uses DIRECT_PREREQUISITES to find all currently-locked milestones that are now fully satisfied. These IDs are added to `optimisticallyUnlockedIds` and rendered as available before the server data arrives.

After undo, `handleUndoStart()` (lines 138–154) uses DIRECT_PREREQUISITES to find currently-available milestones that depended on the undone code and adds them to `optimisticallyRelockedIds`.

### 10.3 getImpliedPredecessors

A service function `getImpliedPredecessors()` (`lib/services/milestones.ts:410–439`) computes transitive prerequisites (not just direct), filtered to incomplete milestones. It is defined but **not called** anywhere in the current UI. Likely dead code or planned for a future cascade-preview modal for confirms (not currently implemented). There is no `/api/milestones/implied` route — the function exists only as a service utility.

### 10.4 Cascade for undo (implemented)

The undo cascade (§7) uses `getDownstreamCompleted()` (`lib/services/milestones.ts:377–406`) — traverses DIRECT_DEPENDENTS tree from target milestone code. Returns all completed milestones transitively downstream. For bilateral pairs, also includes downstream of the counterpart.

### 10.5 Agent milestone flexible order

The spec mentions that agents can confirm certain milestones out of order in edge cases (e.g. portal confirms before agent records). The system handles this via `outOfOrderCompletion` flag (Fix 11) — it does not relax the order constraint. The prerequisite guard in `completeMilestone()` (`lib/services/milestones.ts:461–478`) enforces that all direct prereqs must be complete/NR. Strict order is enforced.

---

## 11. Auto-generated milestone state from new-sale form

### 11.1 Where this logic lives

`initializeMilestoneCompletions()` in `lib/services/milestones.ts:88–151`. Called during transaction creation.

### 11.2 Tenure effects — Freehold vs Leasehold

If `tenure === "freehold"`, the following milestones are auto-marked `"not_required"` at creation:

| Code | Name |
|---|---|
| VM8 | Seller's solicitor requested management pack |
| VM9 | Seller's solicitor received management pack |
| PM12 | Buyer's solicitor received management pack from vendor's solicitor |

Leasehold files keep all three as active milestones.

### 11.3 Purchase type effects — Cash buyer vs Mortgage

If `purchaseType === "cash_buyer"` OR `purchaseType === "cash_from_proceeds"`, the following milestones are auto-marked `"not_required"` at creation:

| Code | Name |
|---|---|
| PM5 | Buyer submitted mortgage application |
| PM6 | Lender valuation booked |
| PM11 | Buyer's solicitor received mortgage offer |

Mortgage files keep all three as active milestones. PM9 and PM10 (private survey) are not affected by purchase type — they can be manually marked NR later if the buyer waives a survey.

### 11.4 Status reason on auto-NR milestones

All auto-NR milestones at creation get `notRequiredReason: "Auto-set at file creation"` (lib/services/milestones.ts:141). This is the reason displayed in the NotRequiredRow component.

### 11.5 Memo of sale auto-complete

**Not found in code.** The spec mentions VM2 (vendor MOS) and PM2 (purchaser MOS) as related to memo of sale, but there is no auto-complete logic in `initializeMilestoneCompletions()` or `createTransactionAction`. The "Memorandum of sale confirmed" milestone referenced in the reminder seeder is anchored to a different milestone code. MOS milestones are manual confirmations by the agent.

**Note:** `article-9` (creating a sale) described a "Memorandum of sale received" milestone being auto-completed on file creation. This should be verified against the creation action before being included in any article claim.

---

## 12. Optimistic UI behaviour

### 12.1 useOptimistic in MilestoneRow (`MilestoneRow.tsx:38–45`)

```typescript
const [optimisticState, addOptimistic] = useOptimistic(
  { isComplete: def.isComplete, isNotRequired: def.isNotRequired },
  (_, action: "complete" | "not_required" | "reverse") => {
    if (action === "complete")     return { isComplete: true,  isNotRequired: false };
    if (action === "not_required") return { isComplete: false, isNotRequired: true  };
    return                                { isComplete: false, isNotRequired: false };
  }
);
```

- `addOptimistic("complete")` fires immediately when Confirm is clicked
- `addOptimistic("not_required")` fires immediately when N/R is confirmed
- `addOptimistic("reverse")` fires when Undo is clicked (before modal, not after — **unclear:** the optimistic reverse may fire too early before the user has confirmed in the modal. Verify in UI testing.)
- All three paths use `startTransition()` so the pending state is visible and buttons are disabled during the transition

### 12.2 optimisticallyUnlockedIds and optimisticallyRelockedIds (`MilestonePanel.tsx:76–77`)

Two sets maintained in MilestonePanel:
- `optimisticallyUnlockedIds`: IDs of milestones to render as available before server re-render
- `optimisticallyRelockedIds`: IDs of milestones to render as locked before server re-render

Both cleared on receipt of new `vendor`/`purchaser` props (lines 80–83):
```typescript
useEffect(() => {
  setOptimisticallyUnlockedIds(new Set());
  setOptimisticallyRelockedIds(new Set());
}, [vendor, purchaser]);
```

### 12.3 Fix 10 status — LIVE

All three paths (confirm, N/R, undo) have optimistic UI and disabled-during-pending guards. Verified in MilestoneRow.tsx:38–45, ~lines 264–279 (NR), ~lines 230–244 (undo).

### 12.4 Disabled-while-pending guards

Buttons use `disabled={loading || isPending}` (lines 412, 427, 436). `isPending` from `useTransition`. `loading` from `setLoading(true/false)` in async paths (undo step 1 read impact).

---

## 13. Director vs negotiator differences

### 13.1 Route-level gate

`app/agent/transactions/[id]/page.tsx:59–60`:
```typescript
const isDirectorRole = session.user.role === "director";
if (!isDirectorRole && transaction.agentUserId !== session.user.id) notFound();
```
Negotiators can only access files they own. Directors can access any file in their agency. This gate applies to the whole page including the Milestones tab.

### 13.2 Inside the Milestones tab

**No milestone-specific role gates found in:**
- `components/milestones/MilestonePanel.tsx`
- `components/milestones/MilestoneRow.tsx`
- `components/milestones/NotRequiredRow.tsx`
- `app/actions/milestones.ts`

Both directors and negotiators who have file access see identical UI and have access to all actions (Confirm, N/R, Undo/Reinstate).

**Spec says directors/progressors only can undo NR.** This is not enforced in any code visible in this read. The "Reinstate" button in NotRequiredRow renders unconditionally. Server action does not check role.

---

## 14. Empty states

### 14.1 Brand-new file (just created)

- Exchange readiness banner shows progress bar (0% or close, animated shimmer)
- Vendor tab shows VM1 as available (or VM1 as complete if MOS auto-completes — see §11.5)
- Remaining vendor milestones locked in chain (VM2 available if VM1 is done, etc.)
- Auto-NR milestones for tenure/purchase type already in "Not required" section
- Purchaser side mirrors vendor pattern
- No exchange banner, no "Ready to exchange"

**Edge case — no milestones at all** (if seeding failed): MilestonePanel:286–289 shows "No milestones found" in place of the section list. Unlikely to occur on a normal file.

### 14.2 Mid-life file (partially progressed)

- Progress bar shows weighted percentage
- Complete sections auto-collapsed
- Sections with incomplete milestones expanded
- Undo buttons visible on all confirmed rows
- N/R button visible on PM9 if available

### 14.3 Post-exchange (VM19/PM26 confirmed, VM20/PM27 pending)

- Green "Ready to exchange" banner persists (both sides gate-confirmed)
- VM19 and PM26 show green checkmarks with exchange date
- VM20 and PM27 are `"available"` (their prerequisite VM19/PM26 is now complete)
- Exchange & Completion section on each side is not collapsed (has pending items)

### 14.4 Completed file (all milestones done or NR)

- Green "Ready to exchange" banner at top (exchangeReady prop is true)
- All sections auto-collapsed (every section's rows are complete)
- Clicking any section header expands it; all rows show green checkmarks
- "Undo" buttons still visible on all complete rows — no special lock-out for completed files
- Not required section: all auto-NR milestones listed

**Unclear:** Whether the app disables milestone actions when the file status is "Completed" or "Withdrawn". No code was found in MilestoneRow or MilestonePanel that reads `transaction.status`. The file status is in the page header/sidebar, not passed to MilestonePanel. Milestone actions appear to remain enabled regardless of file status.

### 14.5 Withdrawn or On Hold file

Same as above — no special milestone tab behaviour found for withdrawn or on-hold status. Actions appear to remain enabled.

---

## 15. Component extraction assessment

| Component | Extractability | Reason |
|---|---|---|
| **MilestonePanel** | **Medium** | Already a standalone component. Props are serialisable (arrays of EnrichedDef). Depends on DIRECT_PREREQUISITES import. Server actions fire from child MilestoneRows, not from Panel itself. Could be passed static data for a help example if actions are stripped or mocked. |
| **MilestoneRow (interactive)** | **Hard** | Imports 7 server actions from `app/actions/milestones`. Deep state: useOptimistic, useTransition, 12+ local state vars, two portal modals, ExchangeCelebration import. Cannot be isolated without mocking all actions. |
| **MilestoneRow (display-only)** | **Easy** | A read-only presentation of a row — name, state indicator, date — can be built as a static component with just the prop shape. Would need custom styling to match; not a direct extract of MilestoneRow.tsx. |
| **Undo cascade modal** | **Easy to extract** | Self-contained portal overlay (MilestoneRow lines ~597–764). Props: undoData, undoMode, cascadeExpanded, isPending, onUndo, onCancel. Could be `UndoMilestoneModal.tsx`. |
| **Exchange reconciliation modal** | **Easy to extract** | Self-contained portal overlay (MilestoneRow lines ~469–594). Props: outstanding, reconciledIds, dates, isExchangeMilestone, onConfirm, onCancel. Could be `ExchangeReconciliationModal.tsx`. |
| **ExchangeCelebration** | **Already extracted** | `components/milestones/ExchangeCelebration.tsx`. Standalone; takes `propertyAddress: string` prop. |
| **Exchange gate indicator** | **Easy to extract** | The amber-dot timeline node + "Exchange gate" label is a small visual element (lines ~315–318). Could be a `<GateNode />` component. |
| **Event-date input** | **Easy to extract** | Lines ~348–389. Props: code, eventDate, desktopValuation, onDateChange, onDesktopToggle, onConfirm, onCancel. Pure UI with no server calls. |

**Best candidate for a help example:** A display-only `MilestoneRow` showing all four states side-by-side, or a static rendering of the progress bar / section structure. The exchange reconciliation modal could be shown in a "loaded" static state as an example of the flow.

---

## 16. Worth flagging

### 1. All 12 diagnosis-sprint fixes are live — clean slate
The diagnosis doc (v5, 2026-04-29) confirms all 12 fixes shipped. The article is describing a system that has been significantly reworked since any earlier documentation. Prior session notes or older articles that describe the pre-fix behaviour (e.g. VM18/PM25 auto-confirming together, PM6 having no date picker, exchange lacking a reconciliation modal) describe the old state and should not be referenced.

### 2. Exchange celebration only fires for exchange, not completion
`ExchangeCelebration` fires on VM19/PM26 (`confirmMilestoneAction` returns `triggeredCelebration: true`). It does NOT fire on VM20/PM27 (completion). The AGENT_MILESTONE_DIAGNOSIS.md lists "VM20/PM27 celebration" as Future Work. The article must not imply a celebration exists for completion.

### 3. outOfOrderCompletion self-resolves silently
When user undoes a milestone in "target only" mode, downstream milestones that remain complete get `outOfOrderCompletion: true`. When the parent is subsequently re-confirmed, `completeMilestone()` checks for these flags and clears them (lines 516–553 in lib/services/milestones.ts). The downstream milestone silently transitions from "outOfOrder" to "normal complete" — no modal, no user notification. The article does not need to explain this flag to users, but should not imply undo always cascades.

### 4. Role enforcement gap: Undo and Reinstate are visible to all roles
Spec §6.3 says only directors and progressors can undo NR. The "Undo" button on complete rows and "Reinstate" in NotRequiredRow are visible to all roles in the UI. The server action does not verify role. The article should not advertise this restriction as enforced.

### 5. File status does not gate milestone actions
On Withdrawn or On Hold files, milestone Confirm/N/R/Undo buttons appear to remain active. No code in MilestonePanel or MilestoneRow reads `transaction.status`. A negotiator on a withdrawn file could theoretically confirm milestones. The article should not imply that withdrawn or on-hold files freeze milestone actions.

### 6. ~~The exchange reconciliation modal can fail silently if counterpart blockers aren't complete~~ — **RESOLVED (2026-05-08)**

**Previously:** When confirming PM26 (purchaser exchange), `confirmExchangeReconciliationAction` required all vendor-side blockers to also be complete (to confirm VM19 as the counterpart). If the vendor side was not ready, the server action threw. The reconciliation modal did not surface this requirement — the user hit a generic server error mid-flow.

**Resolution:** A UI-side counterpart-readiness check was added to `MilestoneRow.tsx` (Phase 1 fix, 2026-05-08). When the user clicks Confirm on any `RECONCILIATION_CODE`, `handleConfirmClick` now checks the `counterpartNotice` prop (computed in MilestonePanel from `allMilestoneLookup`). If the counterpart is not ready, the modal does NOT open — an inline amber notice explains which side is still pending and why. The reconciliation modal only opens once both sides are confirmed ready.

The server-side throw in `confirmExchangeReconciliationAction` remains in place as a defence-in-depth guard (race conditions, stale UI state). Users should not encounter it in normal use.

### 7. N/R cascade is only PM9 → PM10; no other cascades exist
The `NR_CASCADE` map has only one entry: `{ PM9: ["PM10"] }`. No other milestone has an NR cascade. The behaviour (marking PM9 NR also marks PM10 NR) is specific to the survey flow and not a general pattern. The article should explain this as a specific case, not imply NR always has cascades.

### 8. Progress bar counts BOTH sides combined on the `exchangeReady` banner, but per-side on the progress bar
`exchangeReady` prop is computed using both sides' data. The progress bar percentage is per the active side only (vendor or purchaser). The top banner is file-level; the progress bar is side-level. Switching from vendor to purchaser will show different progress percentages.

### 9. Memo of sale auto-complete claim requires verification
§11.5 above flags that the expected auto-complete of VM2/PM2 ("Memorandum of sale") on file creation was not found in code. If article 9 (creating a sale) describes this behaviour, article 11 should cross-check and not repeat it without grounding it.

### 10. Section collapse state resets on side tab switch
When the user switches from Vendor to Purchaser (or back), `handleTabChange()` recomputes `collapsed` state from scratch based on the new side's milestones. Any manual section expansions the user made on the other side are lost. Not a bug but may surprise users who switch back and find sections collapsed again.

### 11. The progress percentage shows 100% when all milestones are NR
If `applicableWeight === 0` (all milestones are NR — pathological but possible), `progressPct` returns 100. The progress bar would show 100% / "Ready to exchange" even though nothing has actually been confirmed. This is an edge case but worth noting for completeness.

### 12. Only PM9 can be manually marked NR; all other milestones are locked or auto-only
The `NR_ALLOWED = new Set(["PM9"])` in MilestoneRow is the entire manually-accessible NR whitelist. An agent cannot mark any other milestone as not required through the UI. Auto-NR milestones (tenure/purchase type) are handled at file creation only. The article should be clear that the N/R flow the user sees on the Milestones tab is specifically about the private survey.

---

## 17. Pre-existing claims — verification

### From article 10

| Claim | Status | Evidence |
|---|---|---|
| Milestones tab is one of five | **Confirmed** | `page.tsx:198–204` — tabs array: Overview, Milestones, Reminders, To-Do, Activity |
| eventDateRequired milestones: PM6, PM9, PM26, PM27 | **Confirmed** | `prisma/seed.ts` lines 203 (PM6), 218 (PM9), 303 (PM26), 308 (PM27); AGENT_MILESTONE_DIAGNOSIS.md:96 |
| Completed gate requires VM19 or PM26 AND VM20 or PM27 | **Partially confirmed** | `changeStatusAction` throws "Cannot mark as completed before confirming exchange" unless VM19/PM26 and VM20/PM27 are confirmed. Exact predicate to verify in `app/actions/transactions.ts`. The milestone structure (VM20 requires VM19, PM27 requires PM26) means both exchange milestones must come first. |
| NextMilestoneWidget "Complete →" switches to Milestones tab via TabContext | **Confirmed** | `NextMilestoneWidget.tsx:5` imports `useTabContext`; line 86 calls `setActiveTab("milestones")` |

### From article 11

| Claim | Status | Evidence |
|---|---|---|
| NextMilestoneWidget excludes VM18/PM25 (gate) and VM19/VM20/PM26/PM27 (post-exchange) from "next available" | **Confirmed** | `app/agent/transactions/[id]/page.tsx` has `EXCHANGE_GATES` and `POST_EXCHANGE` sets used in `computeMilestoneSideState()` |
| Milestones tab handles exchange/completion flows | **Confirmed** | `RECONCILIATION_CODES` set in MilestoneRow.tsx:33; `confirmExchangeReconciliationAction` in app/actions/milestones.ts |

### AGENT_MILESTONE_DIAGNOSIS.md fix status

Source: AGENT_MILESTONE_DIAGNOSIS.md:6 — "2026-04-29 (v5 — all 12 fixes shipped; sprint closed)"

| Fix | Description | Status | Evidence |
|---|---|---|---|
| 1 | Portal survey bugs (E1+E2) | **LIVE** | AGENT_MILESTONE_DIAGNOSIS.md:170 ✓ DONE |
| 2 | Spreadsheet reconciliation | **LIVE** | AGENT_MILESTONE_DIAGNOSIS.md:177 ✓ DONE |
| 3 | eventDateRequired in schema | **LIVE** | Schema field confirmed in `prisma/schema.prisma`; PM6/PM9/PM26/PM27 = true in seed |
| 4 | VM18/PM25 de-paired; VM19↔PM26 + VM20↔PM27 paired | **LIVE** | AGENT_MILESTONE_DIAGNOSIS.md:72; `BILATERAL_UNDO_PAIRS` in `executeUndoMilestone`; `BILATERAL_PAIRS` in `confirmMilestoneAction` |
| 5 | Exchange/completion reconciliation flow | **LIVE** | Two-step modal in MilestoneRow.tsx; `confirmExchangeReconciliationAction`; `reconciledAtExchange` field in schema |
| 6 | Exchange Forecast sync (expectedExchangeDate) | **LIVE** | AGENT_MILESTONE_DIAGNOSIS.md:21; `PropertyTransaction.expectedExchangeDate` upserted in reconciliation action |
| 7 | Modal copy + PM6 desktop valuation toggle | **LIVE** | `getEventDateLabel()` in `lib/portal-copy.ts`; desktop checkbox in `MilestoneRow.tsx:377–386` |
| 8 | Edit Sale Details reconciliation | **LIVE** | AGENT_MILESTONE_DIAGNOSIS.md:23 ✓ DONE |
| 9 | Cascade-prerequisite audit | **LIVE** | DIRECT_PREREQUISITES audited; `lib/milestone-prerequisites.ts` updated |
| 10 | Optimistic UI for N/R + undo | **LIVE** | `MilestoneRow.tsx:38–45, ~264–279, ~230–244` — all wrapped in startTransition + useOptimistic |
| 11 | Undo cascade preview + maybeLockExchangeGate | **LIVE** | Two-step undo modal in MilestoneRow.tsx; `executeUndoMilestoneAction`; `maybeLockExchangeGate` in service |
| 12 | Exchange celebration moment | **LIVE** (exchange only) | `ExchangeCelebration.tsx`; `confirmMilestoneAction` returns `triggeredCelebration: true` for VM19/PM26. VM20/PM27 completion celebration: Future Work |

---

## 18. Page identity check

**Article name:** "The Milestones tab" is the right name. The tab label in the UI is "Milestones" (tab index 1 in `page.tsx`). "The milestone engine" and "Tracking milestones" are too abstract.

**Article length:** This is the longest article in the help library. The Milestones tab has:
- Two sides × 4 sections × up to 27 rows
- Three distinct action types (Confirm, N/R, Undo)
- Three distinct confirm flows (simple, event-date, bilateral reconciliation)
- The exchange and completion bilateral flows are substantial standalone topics

**Should it be split?** This is the right question. Two options:

**Option A — Single article:**
Covers the basics (confirming, marking NR, undoing, progress tracking) with a separate section on "Exchange and Completion" toward the end. Article-10 territory in length. Dense but complete.

**Option B — Two articles:**
- "The Milestones tab" — covers the everyday flow (confirming milestones, N/R, undo, reading the progress bar, exchange gate indicator)
- "Exchange and completion" — covers the bilateral exchange/completion reconciliation flow, the gate mechanics, and the exchange celebration

Option B is cleaner for users who want to understand exchange specifically. The exchange/completion flow is the most complex and has the most edge cases (reconciliation modal, outstanding milestone checklist, bilateral pairing). It could stand alone as a procedural guide.

**Recommendation to flag to user:** Consider option B. The everyday milestone flow is straightforward for agents who have done this before; the exchange flow is where they will want detailed guidance and likely will search for it separately.

**Product gaps to flag in the article (if single article):**
1. No exchange celebration for completion (VM20/PM27) — do not imply one exists
2. Role enforcement gap on Undo/Reinstate — do not advertise as director-only if not enforced
3. File status does not gate milestone actions on withdrawn/on-hold files — do not say it does
4. ~~Exchange reconciliation can fail if counterpart side isn't ready~~ — **RESOLVED (2026-05-08)**. A UI-side counterpart-readiness check now blocks the modal and shows an inline amber notice when the other side is not ready. Not a gap to flag in the article.
