# Post-Launch Fix Log

---

## FIXED

### B1 — Duplicate transaction on submit
**Symptom:** Clicking Create Transaction did nothing visibly, so clicking again created a duplicate.
**Root cause:** React state updates are asynchronous — the button wasn't re-rendering as disabled fast enough to block a rapid double-click.
**Fix:** Added a `useRef` guard in `NewTransactionForm.tsx` that blocks any second submission before the first resolves. On failure, the ref resets so the user can try again.

### B2 — Exchange target mismatch (dashboard 70 days vs file 12 weeks)
**Symptom:** Dashboard exchange forecast showed ~10 weeks; property file correctly showed 12 weeks.
**Root cause:** `createTransaction()` was setting `expectedExchangeDate` to +70 days (10 weeks). The dashboard reads this field. The sidebar reads `twelveWeekTarget` which was already correct at +84 days.
**Fix:** Changed the auto-set exchange date from +70 to +84 days in `lib/services/transactions.ts`. Both the dashboard and the file now agree on 12 weeks.

### B3 — "File may be behind schedule" shown on brand new files
**Symptom:** Opening a transaction created minutes ago showed the amber warning banner.
**Root cause:** `FileHealthBanner` received `onTrack={progress.onTrack === "on_track"}`. For a new file with no milestones completed, `onTrack` is `"unknown"`, which evaluates to `false`, triggering the banner.
**Fix:** `FileHealthBanner` now accepts the full `onTrack` string value. The banner only shows when onTrack is explicitly `"at_risk"` or `"off_track"` — not when it's `"unknown"`.

### B4 — Reminder logs not created on file creation (silent crash)
**Symptom:** Reminders tab empty on new files; tasks never appeared.
**Root cause:** `autoSetNotRequired()` was building a `communicationRecord` audit entry with `createdById: ""` (empty string) when the transaction had no `assignedUserId`. This caused a Prisma foreign-key constraint error that silently killed the entire `createTransaction` call — meaning reminder evaluation never ran.
**Fix:** `autoSetNotRequired` now skips the audit log if there's no valid `assignedUserId`, instead of passing an empty string. The reminder engine error is now also console-logged rather than swallowed silently.

### B5 (partial) — Predicted exchange date not recalibrating in week 1
**Symptom:** Completing milestones on the day of creation or within the first few days didn't update the predicted exchange date.
**Root cause:** The velocity calculation required `weeksElapsed > 0` (i.e., a full 7-day week). Anything completed in the first 6 days produced `weeksElapsed = 0` and fell back to the 12-week default.
**Fix:** Velocity now kicks in after 1 day (not 7). If 1+ day has elapsed and progress > 0%, the predicted date is extrapolated from actual pace.

### B6 — Admin side always shows "self-managed" regardless of actual `progressedBy` value
**Symptom:** The service type badge in the agent card always showed "Self-managed" even for outsourced files.
**Root cause:** `createTransaction()` never set `serviceType` — it relied on the Prisma schema default which is `self_managed`.
**Fix:** `createTransaction()` in `lib/services/transactions.ts` now sets `serviceType` based on `progressedBy`: agent → `self_managed`, progressor → `outsourced`.

### B8 — Can't edit contact cards on the property file overview
**Symptom:** Contacts could only be added or removed, not edited.
**Fix:** Added a PATCH endpoint to `app/api/contacts/route.ts` (agency-scoped). Added inline Edit form to `ContactsSection.tsx` — clicking Edit on a contact shows name/phone/email fields in place; saves normalise phone to +44 and title-case the name.

### U2 — Completion date field editable before exchange is confirmed
**Symptom:** The sidebar showed an Edit button for completion date even on active pre-exchange files.
**Fix:** `TransactionSidebar` now accepts an `exchangeConfirmed` prop (computed from VM12/PM16 milestone state in the page). The Edit button and input are hidden until exchange is confirmed; a "Set once exchange is confirmed" hint is shown instead.

### U3 — No prompt for completion date when exchange milestone confirmed
**Symptom:** Completing the "Exchanged" milestone (VM12/PM16) gave no opportunity to record the completion date.
**Fix:** After a successful VM12 or PM16 confirmation in `MilestoneRow.tsx`, a modal prompts for completion date. The date is saved via the existing `/api/transactions/price` endpoint. The user can skip if the date isn't known yet.

### M1 — "Unassigned" shown but no UI to assign a file to a user
**Symptom:** Files showed "Unassigned" in the meta strip with no way to change it.
**Fix:** Added `AssignControl` component to the Assigned-to field. Clicking "Assign" or "Change" opens a dropdown fetching progressors from the new `/api/agency/users` endpoint, then PATCHes the transaction. The PATCH endpoint in `app/api/transactions/[id]/route.ts` now accepts `assignedUserId`.

### M3 — "Our fee" on agent view has no input field for agent fee
**Symptom:** Agent fee could be stored in the DB but there was no UI to set it from the sidebar.
**Fix:** Added an edit form in `TransactionSidebar.tsx` that lets users set agent fee as either a fixed £ amount or a percentage, plus VAT-inclusive/exclusive toggle. Saves via the existing `/api/transactions/price` endpoint.

### M4 — Agent can submit a file with no vendor/purchaser/solicitor details
**Symptom:** The "Send to progressor" flow had no minimum field requirement.
**Fix:** When an agent selects "Send to progressor", the submit button stays disabled until at least one vendor name and one purchaser name are filled in. The hint text explains what's missing.

### M6 — Agent side needs a proper left sidebar
**Symptom:** Agent area used a simple top header/horizontal nav — inconsistent with the progressor's left sidebar layout.
**Fix:** Created `AgentShell` client component in `components/layout/AgentShell.tsx` with a left sidebar matching the progressor layout style. Nav items: My Files, Completions, Analytics, Updates, New File. `app/agent/layout.tsx` now uses `AgentShell`.

### D1 — Internal notes exist in two places (Overview tab + Comms internal notes)
**Symptom:** Notes added on the Overview tab were invisible in the Comms/Activity tab, and vice versa.
**Root cause:** Overview tab wrote to `TransactionNote` model; Comms tab wrote to `CommunicationRecord` with `type: "internal_note"`.
**Fix:** `TransactionNotes.tsx` now reads from and writes to `CommunicationRecord` (via `/api/comms`). The page extracts `internal_note` entries from `activityEntries` and passes them to the component. Both tabs now show the same data.

### U4/U5 — Names and phone numbers not normalised
**Symptom:** Contact names could be entered in any case; phone numbers stored as-typed without +44 prefix.
**Fix:** `NewTransactionForm.tsx` applies `titleCase()` to vendor/purchaser names and `normalizePhone()` (07xxx → +447xxx) to phone numbers at submission. `ContactsSection.tsx` applies the same normalization when editing a contact. `normalizePhone()` added to `lib/utils.ts`.

---

## REMAINING / DEFERRED

### Polish — agent-btn press-down (Task 5 audit, deferred from transaction-detail polish pass)
One button in inventory-touched components still uses raw `bg-blue-500` instead of `agent-btn-color-primary`. No press-down state (`:active` transform). Fix is mechanical — swap class, verify color is acceptable (coral vs blue is a visual decision):
- `components/todos/AddManualTaskForm.tsx:184` — Add task submit button

(CommsEntry.tsx Continue/Save buttons fixed in Commit 6 — entries above removed.)

### Polish — agent-reveal-out exit animation (two component sites, five call sites)
`agent-reveal-out` requires the element to remain mounted during its exit animation, then be removed via an `onAnimationEnd` callback. Pure conditional-render components cannot use it as a className-only addition. Deferred from Stage 4.

**Call sites:**
- `components/milestones/MilestoneRow.tsx` — counterpart notice dismiss, event-date form cancel, N/R reason form cancel (3 sites)
- `components/transaction/EditSaleDetailsDrawer.tsx` — PropSaveStage delta preview, Save/Cancel conditional div (2 sites)

**Fix:** Apply the two-step pattern per `ANIMATION_STANDARDS.md §3` at each site: keep element mounted, add `agent-reveal-out` class on exit trigger, remove from DOM in `onAnimationEnd`. Standalone follow-up commit. Low priority.

### AgentRequestsPanel — render path removed, awaiting `/agent/to-do` redesign (2026-05-12)

**Context.** During the `/agent/dashboard` → `/agent/transactions` merge, the requests panel was removed from the dashboard render tree. The dashboard was the only surface rendering it, so the panel is currently not visible to any user.

**State of the code:**
- `components/agent/AgentRequestsPanel.tsx` — **file preserved in codebase, only render path removed.** Component still imports cleanly and remains a valid React component; it simply has no caller.
- Write paths still functional. `AgentFlagButton` (now in the transaction-list PageHeader and on every transaction-detail page) and `AddManualTaskForm` continue creating `ManualTask{ isAgentRequest: true }` rows. The data keeps accumulating in production with no visible reader.
- DB snapshot column (row count of `ManualTask` rows where `isAgentRequest = true`) left blank — Ellis to fill in post-merge if a paper trail is wanted before the future redesign.

**Future home.** The `/agent/to-do` two-column redesign brief (pending, owned by Ellis) is where these rows surface again. The redesign should pick up the existing component as-is or rebuild against the same data contract — both options remain open because the file is preserved.

**No urgency.** This is a deliberate parking of a feature, not a bug. The data integrity is intact; only the UI affordance is paused.

### Data consistency
- **D2** — Self-managed files appear in main pipeline analytics. Should be fully separated. (Requires analytics query audit — lower priority.)

### Missing features / UX
- **M2** — Hold / withdraw flow is already implemented in `StatusControl` — it's a discoverability issue only. Consider adding a hint or surfacing it more prominently.
- **U1** — Clicking milestones rapidly fires multiple pop-ups. Lower priority; milestone `loading` state already guards within a single row.
- **M5** — Upload memo of sale with auto-populate. Complex feature, lowest priority.

### Duplicate UK phone formatters — consolidation required

`lib/utils.ts::normalizePhone()` and `lib/utils/address.ts::formatUKPhone()` implement similar UK phone formatting with different output formats. The first produces E.164 (`+44xxxxxxxxxx`, no spaces) for mobiles; the second produces space-separated (`+44 xxxx xxxxxx`). Both are actively imported by different callers, so the same phone number can render in two different formats depending on the page.

Consolidate into a single formatter. Agree on canonical output format (likely the space-separated human-readable format for display, with a separate `parseUKPhone` helper for storage normalisation if needed). Update all callers.

Surfaced during local-vs-production drift audit on 2026-05-15.

### C1 — completeMilestone server action: defensive Prisma `connect` syntax
`completeMilestone` (and related milestone actions) set `completedById: input.completedById` directly. If the user ID from the JWT doesn't exist in the connected database (stale session after a DB re-seed or env switch), the FK constraint fires as a raw Prisma error with an opaque constraint name (`MilestoneCompletion_completedById_fkey`), not a readable message.

**Fix:** Change `completedById: input.completedById` to the Prisma `connect` syntax:
```typescript
completedBy: input.completedById
  ? { connect: { id: input.completedById } }
  : undefined,
```
Prisma will throw a typed `P2025 Record not found` error rather than a raw FK violation, making stale-session failures debuggable without a DB query.

**Affects:** `lib/services/` — verify exact file path before applying (likely `milestone-service.ts` or inline in `app/actions/milestones.ts`).
**No urgency.** The user-facing fix is Option A (clear cookies, re-login). This is an observability improvement only.

### C2 — isSolid + night-mode tablet overlap (768–1024px)

`useSolidMode` activates the `SolidModeToggle` at `≥768px` (the toggle is `hidden md:block`). Night mode activates via `@media (max-width: 1024px)`. These two ranges overlap at 768–1024px: a user on a large tablet can have solid mode ON while night mode CSS is also applied, resulting in white-background components receiving night-mode variable overrides (dark text tokens on a white surface — generally legible but not designed for this combination).

**Scope:** Pre-existing at time of Commit D (2026-05-16). All `isSolid` glass branches in new-v2 carry an inline comment documenting this. Not fixed because solid mode at the tablet breakpoint is itself a low-traffic edge case.

**Fix when addressed:** Scope `useSolidMode` to `≥1024px` only (remove the 768–1024px overlap), or add a third CSS selector branch for `isSolid+night`. Whichever is chosen, remove the inline comments.

### C3 — new-v2 box shadows not night-mode-aware (Category E, deferred)

Several components in `components/transactions-v2/` use `box-shadow` values with dark rgba (`rgba(15,23,42,...)`) hardcoded. On a dark background these appear as dark-on-dark and render invisible. Examples: `HeroCard` box shadow, `DraftPanel` box shadow.

**Deferred reason:** Box shadows on glassmorphic surfaces are a visual-polish concern only. Dark-on-dark shadows are simply invisible (not wrong), so the UI is usable. The correct fix is a Category E token (`--nv2-shadow-*`) that inverts to a glowing-outward shadow in night mode. Deferred until the new-v2 form ships and night-mode fidelity becomes a priority.
