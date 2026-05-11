# Inventory: [Page Name]

**Route:** `/agent/[path]`
**Stage 1 status:** Draft / Approved by Ellis on [date]
**Amendments:** (see bottom of file — added if mid-flight discoveries occur in Stage 2)

---

## 1. Page identity

| Field | Value |
|---|---|
| Route | `/agent/[path]` |
| File | `app/agent/[path]/page.tsx` |
| Component type | Server component / Client component / Mixed |
| Who sees it | Director, Negotiator / Director only / All authenticated agents |
| How they reach it | Sidebar nav / Deep link from hub card / Email link / Redirect from X |
| Reachable without a transaction? | Yes / No (if no, note the minimum data required) |

---

## 2. Components rendered

List every component imported and rendered by this page, with file paths. Include layout wrappers.

| Component | File | Stage 4 scope | Notes |
|---|---|---|---|
| `AgentShell` | `components/layout/AgentShell.tsx` | No changes — already matches polish | Wraps the page; sidebar, topbar, toaster |
| `MilestonePanel` | `components/milestones/MilestonePanel.tsx` | Match polish page | Rendered only when `completions` is loaded |
| `ChaseDrawer` | `components/chase/ChaseDrawer.tsx` | Match polish page | Portal: open state controlled by `chaseOpen` |
| _[list every import]_ | | _[Match polish page / No changes — already matches polish / Out of scope]_ | |

**Stage 4 scope — mandatory declaration (one per component row):**

Every component listed here must be tagged with exactly one of:

- **Match polish page** — Stage 4 changes this component's markup, layout, spacing, and classes to make it match the polish page. The polish page is both the visual target and the structural contract. See Section 13 for the per-section specification.
- **No changes — already matches polish** — This component already matches the polish page visually and structurally. Stage 4 verifies but does not modify it.
- **Out of scope** — This component is not part of this polish pass. It should not be touched in Stage 4.

**Why this matters:** Without an explicit scope declaration, Stage 4 has no basis for deciding whether a visual gap between production and the polish page is a miss to fix or an expected difference to leave alone. Declaring scope here at Stage 1 eliminates that ambiguity.

**Components mocked in Stage 2 polish page:** If you know at Stage 1 that a component will be mocked rather than imported in the polish page (e.g. because it requires complex server data), note it in the Notes column: "Mocked in Stage 2 — inline mock, not real import." This pre-warns Stage 4 to verify the real component directly against Section 13 rather than relying on the polish page as the sole reference.

**Depth rule:** If a component imports sub-components that are specific to this page's behaviour (not generic UI primitives), list those too. If a sub-component is generic (e.g. a `Button` or `Input`), list it once and omit its children.

---

## 3. Data dependencies

What queries, server actions, props, or session data does the page read?

| Data | Source | Shape | Notes |
|---|---|---|---|
| `transaction` | `prisma.propertyTransaction.findFirst({ where: { id, agencyId } })` | Full `PropertyTransaction` with relations | Null if not found → 404 |
| `completions` | Same query, `include: { milestoneCompletions: true }` | `MilestoneCompletion[]` | Empty array if no milestones initialised (tenure/type not set) |
| `session.user` | `requireSession()` | `{ id, agencyId, role, name }` | Redirect to login if missing |
| _[list every data source]_ | | | |

**Null / missing data:** For each data source, note what happens if it returns null or empty. Null transaction → redirect to 404. Empty completions → milestone panel shows empty state. Etc.

---

## 4. States

List every meaningful render state the page can be in. "Meaningful" means a user would see a visually distinct page. Be exhaustive — empty states are where the most regressions happen.

### Standard states

| State | Trigger condition | What the user sees |
|---|---|---|
| **Loading** | Server component fetch in progress | Skeleton component (`loading.tsx`) — describe what it renders |
| **Populated** | All data present and transaction is active | Full page layout — describe the hero state |
| **Empty (no transactions)** | `transactions.length === 0` | Empty state card with headline and CTA |
| **Error** | Server throws / Prisma connection fails | `error.tsx` boundary catches; describe what it renders |
| **Permission denied** | `agencyId` mismatch | Redirect to `/agent/hub` (via access scope helper) |

### Page-specific states

| State | Trigger condition | What the user sees |
|---|---|---|
| **Transaction on hold** | `transaction.status === "on_hold"` | Amber status badge, banner across the top: "This file is on hold — [reason if set]" |
| **Exchange ready** | VM19 + PM26 both complete | Exchange gate card promoted, confetti trigger enabled |
| **Withdrawn** | `transaction.status === "withdrawn"` | Red badge, all edit affordances removed, read-only notice |
| **No milestones initialised** | `tenure` or `purchaseType` is null | Milestone panel shows inline prompt to set tenure/type |
| _[list every page-specific state]_ | | |

---

## 5. Interactive elements

Every button, link, dropdown, input, and toggle visible on this page. What each one does. What happens when it's disabled and why.

| Element | Location on page | Action | Disabled when | Disabled behaviour |
|---|---|---|---|---|
| "Confirm" button (milestone row) | Milestone panel | Calls `confirmMilestoneAction()` | `isOptimistic` is true (pending), or milestone is locked | Opacity 0.38, pointer-events none |
| "Undo" button (milestone row) | Same | Calls `undoMilestoneAction()` | Milestone is not yet complete | Hidden (not rendered) |
| Status dropdown | Page header / sidebar | Changes `transaction.status` | `role === "negotiator"` | Not rendered for negotiators |
| Chase drawer trigger | Reminder card / milestone row | Opens `ChaseDrawer` | No chase target available | Not rendered |
| "+ Add chain" | Chain section | Expands chain panel | Transaction is withdrawn | Not rendered |
| _[list every element]_ | | | | |

---

## 6. Conditional renders

Every `{condition && <Component />}` or ternary branch. What triggers each one.

```
{transaction.status === "on_hold" && <OnHoldBanner />}
{/* Shows: amber banner across the top of the page */}
{/* Hides: any other status */}

{!tenure || !purchaseType && (
  <MilestonePlaceholder />
)}
{/* Shows: when either field was not set at transaction creation */}
{/* Hides: when both tenure and purchaseType are set */}

{role === "director" && (
  <StatusDropdown />
)}
{/* Shows: directors only */}
{/* Hides: negotiators; they see the status badge but not the dropdown */}

{/* [list every conditional] */}
```

---

## 7. Copy inventory

**Verbatim rule:** A string is only captured if it appears in the inventory exactly as it renders in the UI. Not paraphrased, not summarised, not grouped. "Confirm", "Confirmed", and "Confirming…" are three separate strings, not one. State variants, loading variants, disabled variants, error variants — each gets its own line. If you are tempted to write "Confirm button (with loading and confirmed states)", stop and list all three.

**Every string of text visible on this page. Verbatim.** Labels, headings, helper text, button text, placeholder text, tooltips, error messages, empty-state copy, toast messages, confirmation dialog copy. This list is the contract — anything not here can be lost; anything here must survive Stage 4.

Format: group by location on the page.

```
# Page header
"14 High Street, Maidstone ME15 9PQ"   [dynamic — property address]
"Active"                                [status badge — varies by status]
"On hold"                               [status badge variant]
"Withdrawn"                             [status badge variant]
"Complete"                              [status badge variant]

# Milestone panel
"Milestones"                            [section heading]
"Vendor side"                           [tab label]
"Purchaser side"                        [tab label]
"Confirm"                               [milestone row button — available milestone]
"Confirmed"                             [milestone row — after optimistic update]
"Confirming…"                           [milestone row button — loading state]
"Undo"                                  [milestone row — completed milestone]
"Not required"                          [milestone row badge — NR milestone]
"Locked"                                [milestone row — locked milestone, accessible-only text]

# Toast messages (milestone confirm)
"Milestone confirmed"                   [toast title — success]
"Milestone reversed"                    [toast title — undo] ← FLAG for voice pass
"+2 downstream milestones also undone"  [toast description — cascade undo] ← FLAG for voice pass
"Marked not required"                   [toast title — NR action] ← FLAG for voice pass

# Empty state (no milestones initialised)
"Set tenure and purchase type to unlock milestones"  [placeholder prompt]

# [Continue for every section of the page]
```

**Flagging convention:** Add `← FLAG for voice pass` next to any string you spot as a voice violation during inventory. This pre-populates the Stage 3 review without requiring a separate read.

---

## 8. Desktop view

| Field | Value |
|---|---|
| Breakpoint | Desktop applies at ≥ 1024px (or whatever the actual breakpoint is — check CSS) |
| Layout | Two-column: main content left, sidebar right. Sidebar width: Xpx. Main width: fluid |
| Navigation | `AgentShell` renders full sidebar, visible permanently |
| Page-specific desktop elements | Exchange forecast card (sidebar). Status dropdown (visible inline). Chase drawer slides in from right at 480px width |
| Desktop-only elements | None / [list if any] |

Describe the visual layout in plain language. The goal is for someone who hasn't seen the page to understand what's where.

```
Desktop layout:
┌─ AgentShell sidebar (240px, fixed) ─┬─ main content (fluid) ───────────────┬─ sidebar panel (320px) ─┐
│  logo                               │  property address header              │  Price & Fees card      │
│  navigation links                   │  status badge, assigned-to            │  Exchange forecast      │
│  user strip                         │  [tabs: Overview / Milestones / Chase]│  Timeline card          │
│                                     │  [tab content]                        │                         │
└─────────────────────────────────────┴───────────────────────────────────────┴─────────────────────────┘
```

---

## 9. Mobile view

Mobile is a separate inventory section. It is not "the same but narrower." Document it as if you have never seen the desktop view.

| Field | Value |
|---|---|
| Breakpoint | Mobile applies at < 1024px (verify against actual CSS) |
| Layout | Single column. AgentShell sidebar collapses to [hamburger / bottom bar / drawer — which?] |
| Navigation | [Describe exactly how the nav changes on mobile] |
| Elements that reorder | Sidebar panel (Price & Fees etc.) moves [above / below] milestone panel |
| Elements that become drawers/sheets | Chase drawer is the same on mobile; date picker may switch to native |
| Elements that collapse | [list anything hidden or collapsed by default on mobile] |
| Mobile-specific elements | [any elements only visible on mobile — back button, bottom sheet handles, etc.] |
| Hidden on mobile | [anything explicitly `hidden md:block` or similar] |

Describe the mobile layout in the same plain-language format as desktop:

```
Mobile layout (375px):
┌─────────────────────────────┐
│ [hamburger] Address [status]│  ← topbar (sticky)
├─────────────────────────────┤
│ [Overview / Milestones tabs]│
│                             │
│ Tab content                 │
│                             │
│ Price & Fees (stacked below │
│ tab content on mobile)      │
└─────────────────────────────┘
```

**Common mobile questions to answer explicitly:**
- Does the sidebar become a drawer? If so, what triggers it?
- Does the status dropdown become a bottom sheet?
- Do any tables become stacked cards?
- Are any actions moved to a sticky footer bar on mobile?
- Are there swipe gestures?

---

## 10. Animations / transitions already in place

Note what is already animated so Stage 2 doesn't re-implement or contradict it.

| Element | Animation | Source |
|---|---|---|
| Milestone dot | `ms-node-pop` keyframe on confirm | `agent-system.css` |
| Milestone row unlock | `ms-unlock` + `ms-node-unlock` | `agent-system.css` |
| Chase drawer open | `agent-drawer-in` keyframe | `agent-system.css` |
| Status/withdrawal modal | `agent-modal-in` keyframe | `agent-system.css` |
| Toast enter/exit | `agent-toast-in` / `agent-toast-out` | `agent-system.css` |
| Milestone section expand | None currently — candidate A5, B1 in animation shortlist | — |
| [list anything else already animated] | | |

---

## 10.5. Global animation and interaction inheritance

Which canonical classes does this page use? For each, note where it fires and whether it is already wired up or needs Stage 2 / Stage 4 work. Reference: `docs/polish-pass/ANIMATION_STANDARDS.md`.

**Animation classes (§1–5):**

| Class | Applies to this page? | Where it fires | Status |
|---|---|---|---|
| `.agent-acc` / `.agent-acc-in` | Yes / No | [which collapsible sections?] | Already present / Needs wiring in Stage 4 |
| `.agent-reveal-in` / `.agent-reveal-out` | Yes / No | [validation errors? inline edit forms?] | Already present / Needs wiring in Stage 4 |
| `.agent-dropdown-in` | Yes / No | [which dropdowns?] | Already present / Needs wiring in Stage 4 |
| `.agent-row-flash` | Yes / No | [which confirm rows?] | Already present / Needs wiring in Stage 4 |
| `.agent-btn` (press-down + hover) | Yes — all buttons | [note any inline-styled buttons that need the class added] | Audit in Stage 2 |

**Interactive-state classes (§6–10):**

| Class | Applies to this page? | Where it fires | Status |
|---|---|---|---|
| `.agent-segment-pill` | Yes / No | [which toggles / multi-option selectors?] | Already present / Needs wiring in Stage 4 |
| `.agent-link` / `.agent-link-muted` | Yes / No | [which text-link actions?] | Already present / Needs wiring in Stage 4 |
| `.agent-btn-ghost-bordered` | Yes / No | [which bordered ghost CTAs?] | Already present / Needs wiring in Stage 4 |
| `.agent-acc-hdr` | Yes / No | [which accordion headers?] | Already present / Needs wiring in Stage 4 |
| `.agent-icon-btn` | Yes / No | [which circular icon / close buttons?] | Already present / Needs wiring in Stage 4 |

**Rule:** If the answer for a row is "Yes / Needs wiring in Stage 4", list it explicitly in section 12. If the answer is "No", explain why (not applicable, portal-only, etc.).

---

## 11. Known edge cases

Things that would cause a furious regression report if broken.

- **Optimistic updates (useOptimistic):** Milestone confirm and undo use `useOptimistic`. The UI must remain functional during the optimistic state (button disabled, dot animates) even if the server response is slow. Stage 2 must not touch the optimistic logic — only the wrapper styling.
- **Exchange gate:** VM19 + PM26 must both be complete before exchange confirmation is allowed. The gate is enforced in both the milestone panel (UI lock) and the server action. Stage 2 does not touch server actions.
- **Cascade undo:** Undoing a milestone can undo downstream milestones (cascade mode). The toast describes how many were undone. This logic is untouched in Stage 4.
- **[Add any others specific to this page]**

---

## 12. Out of scope for redesign

List anything on this page that must not change in this pass.

- **Milestone confirmation logic** (`confirmMilestoneAction`, `undoMilestoneAction`) — server actions are not touched
- **Chase message generation** — AI prompt, Anthropic API call, channel logic — not touched
- **Data fetching** — no query changes, no new data requirements
- **`useOptimistic` implementation** — CSS wrapper can change; the hook and its state logic cannot
- **[Anything else you want locked]**

---

## 13. Per-section visual specification

This section is the visual contract for Stage 4. One row per visible section of the polish page, top to bottom. Stage 4 is not complete until every in-scope row reads "Done."

| Section name | Polish-page structure | Production component(s) | Current state vs polish | Stage 4 changes required |
|---|---|---|---|---|
| _[e.g. Next milestone widget]_ | `glass-card overflow-hidden rounded-[12px]`. CardHdr: `px-4 py-3 border-b border-white/20`, title `text-xs font-semibold text-slate-900/70`. Body: `px-5 py-4`. | `components/milestones/NextMilestoneWidget.tsx` | External `<section>` wrapper; title `text-sm font-bold`. | Wrap in `glass-card overflow-hidden rounded-[12px]`. Add CardHdr. Match body padding. |
| _[list every section]_ | | | | |

**Filling this section at Stage 1:**
- Walk the polish page top to bottom, section by section
- For each section: note the outermost wrapper class(es), the header pattern (CardHdr or plain `<p>`), and any structural specifics (divide-y, px-5 py-4, etc.)
- Note which production component renders that section
- Note what currently differs — best guess at Stage 1, corrected via Amendments if wrong
- "Stage 4 changes required" must be specific enough that Stage 4 can execute it without re-reading the polish page

**This section is the primary gate for Stage 4 sign-off.** Visual parity across every in-scope row must be confirmed before the gate closes.

---

## 14. Amendments

_(Empty until Stage 2 begins. Mid-flight discoveries are appended here with timestamp and brief description.)_

| Date | Discovery | Added to which section |
|---|---|---|
| — | — | — |
