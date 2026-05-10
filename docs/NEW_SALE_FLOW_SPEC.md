# New Sale Creation Flow — Design Specification

Version: 1.0
Date: 2026-05-09
Status: Draft for review
Discovery source: `docs/NEW_SALE_FLOW_DISCOVERY.md`

---

## Overview

This document specifies the visual design and interaction model for the new sale creation flow. No server-side changes are required — the `createTransactionAction` contract is unchanged.

The form has three mutually exclusive entry states. Once a state is established, the form is consistent within it.

---

## Locked decisions (recap)

| Decision | Detail |
|---|---|
| Three-state same-page model | Cold start → MOS uploaded or Manual; no page navigation |
| Self-progress / outsourced toggle | Always visible to all agents; defaults to self-progress |
| `Agency.modeProfile` | Analytics-only; no effect on form logic |
| Service type post-creation | Immutable — no edit affordance |
| Address, tenure, purchase type | Currently immutable; Phase 5 will add edit affordance (out of scope here) |
| Vendor/purchaser cap | Raised from 2 to 4 per side |
| Stage 1 → Stage 2 | Animated visual reveal, not a page change |
| State 1 visual quality | Hero-level polish |

---

## Field expectation matrix

Governs indicator copy in State 2. Confirm or adjust before build — if the matrix changes, the indicator logic changes with it.

| Field | On every MOS? | Required for submission |
|---|---|---|
| Address | Yes | Yes |
| Tenure | Yes | Yes |
| Price | Yes | No |
| Vendor name(s) | Yes | If outsourced |
| Purchaser name(s) | Yes | If outsourced |
| Vendor contact (phone/email) | Sometimes | If outsourced |
| Purchaser contact (phone/email) | Sometimes | If outsourced |
| Vendor solicitor | Sometimes | No |
| Purchaser solicitor | Sometimes | No |
| Purchase type | Never | Yes |
| Who progresses | Never | Yes |
| Agent fee | Sometimes | No |
| Notes | Never | No |
| Chain | Never | No |

### Indicator copy rules (State 2)

Three variants, applied per-field when the field is empty after MOS extraction:

| Category | Condition | Indicator copy | Emphasis |
|---|---|---|---|
| A — Expected, not extracted | Field is "on every MOS" but returned null | "We couldn't read this from your memo — please add" | Strong — amber/orange |
| B — Sometimes present, not extracted | Field is "sometimes on MOS" but returned null | "Still needed" | Neutral — grey |
| C — Never on MOS | Field is never on a memo | "Not on memos — please complete" | Neutral — clear but not alarming |

Required-and-missing fields always receive stronger visual treatment than optional-and-missing fields, regardless of indicator category.

---

## State 1: Cold start (hero drop zone)

### Purpose

This is the landing state every time the form opens. Its sole job is to surface MOS upload as the primary action before anything else is visible.

### Dimensions and layout

- Full-width container, constrained to the same max-width as the existing form
- Height: **360px** on desktop — enough to feel hero-scale without requiring scroll before action
- Rounded corners consistent with existing glass cards (`rounded-2xl`)
- Glass surface treatment — not a flat outlined box

### Visual anatomy (top to bottom, centred)

1. **Upload icon** — ~48px, document/cloud-upload glyph, coral-tinted in idle state
2. **Headline** — `"Drop your memo of sale"` — large (~20px), semibold
3. **Subtext** — `"Fill this form in seconds — we'll read the address, price, solicitors, and contacts straight from the document."` — ~14px, muted
4. **Accepted formats pill** — small, muted: `"PDF, JPEG, PNG — max 10 MB"`
5. **Browse affordance** — `"or click to browse"` as a subtle underline link, not a button
6. **Divider** — `"or"` with horizontal rules, ~24px vertical margin
7. **"Fill in manually" link** — `"Fill in manually"` in muted coral or slate — transitions to State 3 on click

### Idle animation

Goal: signal interactivity without distracting from page load.

- **Recommended:** gentle floating animation on the upload icon — `translateY` ±4px, `ease-in-out`, 2.5s period, infinite loop
- Animation **pauses on hover** (see hover state)
- Avoid: pulsing opacity on the whole card — reads as a loading state, not an interactive affordance
- Alternative: animated dashed border with slow-crawling dash-offset — more technical feel, less warm; not recommended for the agent app brand

### Hover / drag-enter state

Triggered by mouse enter OR `dragenter` event.

- Border: solid coral (`#FF6B4A`), 2px — replaces any muted idle border
- Background: very light coral tint (`#FF6B4A` at 4–6% opacity) over glass surface
- Icon: scales to 110% with `transition: transform 150ms ease-out`
- Headline updates to: `"Drop it here"`
- Subtext remains unchanged
- Idle animation pauses

### Active drop state (drag held over zone)

- Border pulses between coral and a lighter tint — `@keyframes` pulse, 600ms period
- Background slightly more saturated than hover state
- No further text change

### Error states

**Invalid file type:**
- Zone border: amber/warning
- Icon: swaps to warning glyph
- Below zone: `"We can't read that file type — please upload a PDF, JPEG, or PNG"`
- Auto-clears after 4 seconds or on next drag-enter

**File too large (> 10 MB):**
- Same amber treatment
- `"That file is over 10 MB — try compressing the PDF or using a lower-resolution scan"`

**Upload or network failure:**
- Zone border: red/danger
- `"Something went wrong with the upload — check your connection and try again"`
- `"Try again"` link inline

**Total extraction failure (no parseable JSON returned):**
- Do not show a red state on the drop zone
- Transition to State 3, dropping the user directly into the manual form
- Toast: `"We couldn't read the memo — fill in the form below"` — dismissible, auto-clears after 6 seconds
- If any partial data was extracted before failure, pre-fill those fields silently

### "Fill in manually" link treatment

- Positioned below the drop zone, not inside it
- `"Prefer to fill in manually? →"` — `text-sm text-slate-500 hover:text-slate-700`
- On click: animate directly to State 3 Stage 1

---

## State 2: MOS uploaded

### Page transformation animation

When a file is successfully uploaded and extraction completes:

1. **Drop zone collapses** — height animates from 360px to ~56px over 280ms using `cubic-bezier(0.34, 1.56, 0.64, 1)` (the spring curve used elsewhere in the product)
2. Collapsed strip becomes a **status bar**: `"✓ Memo read — [N] fields filled"` in muted green, with a `"Change file"` link right-aligned
3. **Form sections reveal** below the strip — they were pre-rendered with `height: 0; overflow: hidden; opacity: 0`. Sections expand sequentially, staggered ~40ms per section, using the same spring curve
4. Focus auto-moves to the first unfilled required field

Total animation duration: ~500ms end-to-end (collapse + stagger).

### Field-filled indicators

For every field successfully extracted:

- Small green tick (`✓`) inline after the field label or at the trailing edge of the input
- Input has a subtle green-tint left border (`border-l-2 border-green-400`) or background tint
- All inputs remain **editable** — the user can correct extracted values

### "Still needed" indicator variants (see matrix above)

**Variant A — Expected, not extracted** (e.g. address on MOS but street blank):
- Label gains a coral/amber dot indicator
- Below the input: `"We couldn't read this from your memo — please add"` — `text-xs text-amber-600`
- Input border: amber-tinted

**Variant B — Sometimes present, not extracted** (e.g. vendor phone):
- Near the field: `"Still needed"` — `text-xs text-slate-400`
- No special border treatment

**Variant C — Never on MOS** (e.g. purchase type, who progresses):
- Near the field: `"Not on memos — please complete"` — `text-xs text-slate-500`
- No special border treatment

**Required + missing** (any variant): label gains `*` in coral; Variant A missing-required uses amber; Variant C missing-required (purchase type, who progresses) uses coral to signal these must be completed before submission.

### Partial extraction (common case)

The majority of MOS uploads will return some fields but not all. This is not an error condition — no fallback messaging is needed. The per-field indicators handle it completely. The status bar reads `"✓ Memo read — [N] of [M] fields filled"`.

### Solicitor firm creation banners

Displayed below the solicitor picker section when the MOS names a firm:

| Condition | Copy |
|---|---|
| New firm created in the database | `"[Firm name] added to your database"` — green chip, dismissible |
| Existing firm matched | `"[Firm name] already in your database"` — muted/neutral |
| Name found but not auto-filled | `"[Name] mentioned in the memo — search above to add them"` — amber, with a focus link to the solicitor picker |

---

## State 3: Manual entry — Stage 1

### Layout

A single card containing exactly four fields, vertically stacked. This is the only visible content on the page when State 3 begins.

### The four fields

**1. Property address** — three-input group sharing a single `"Property address"` label:
- `Street address` (flex-grow, fills remaining width)
- `City / Town` (fixed ~140px)
- `Postcode` (fixed ~110px, UK postcode format with auto-spacing on blur)
- On mobile: stack all three vertically or put City + Postcode side by side below Street

**2. Tenure** — pill picker: `Freehold` / `Leasehold`
- Pills: equal width, full-width of the card
- Selected: solid coral background, white text
- Unselected: muted border, slate text
- No default selection — user must choose

**3. Purchase type** — pill picker: `Mortgage` / `Cash buyer` / `Cash from proceeds`
- Three pills, equal width
- Same treatment as tenure
- No default selection

**4. Who will progress this file?** — pill picker: `I'll handle it` / `Send to Sales Progressor`
- Default: `I'll handle it` pre-selected
- When `Send to Sales Progressor` is selected, a brief note appears below: `"We'll take over the progression — you stay informed."` — `text-xs text-slate-500`

### Validation

- Street address: required, minimum 3 characters, validates on blur
- Tenure: required (must select one pill)
- Purchase type: required (must select one pill)
- Who progresses: always has a value (defaults to self-progress)

Pill selections cannot be "unselected" once made — only switched to the other option.

### Stage 2 trigger: the "Continue" button

When all four Stage 1 fields are valid, a `"Continue — add contacts & details"` button appears below the card:

- Animates in: `opacity: 0 → 1` + `translateY: 8px → 0`, ~150ms, ease-out
- Style: coral primary, full-width
- Above the button: `"That's enough to create the file — continue to add contacts and extra details"` — `text-xs text-slate-400`

**Recommended trigger: explicit button click.** Automatic reveal when the fourth field is completed would feel intrusive — the user may be mid-typing or tabbing through fields. The explicit button gives them a clear moment to confirm Stage 1 is done before Stage 2 appears. It also implicitly signals that Stage 1 alone is sufficient to create a file (for agents in a hurry).

---

## State 3: Stage 1 → Stage 2 transition

### Animation

Triggered when the user clicks `"Continue — add contacts & details"`.

1. **Stage 1 card** stays in place — it does not collapse. It becomes **read-only**: inputs disabled, pills non-clickable, card opacity reduces to 90%, a small `"✓ Saved"` label appears top-right of the card, and an `"Edit"` link appears beside it.
2. **Stage 2 sections** (pre-rendered with `height: 0; overflow: hidden; opacity: 0`) expand sequentially from top to bottom, staggered ~50ms per section.
3. Each section animates: `height` 0 → auto (via `max-height` trick) + `opacity` 0 → 1.
4. Curve: `cubic-bezier(0.34, 1.56, 0.64, 1)`, 280ms per section.
5. Page auto-scrolls to bring the first Stage 2 section into view after ~330ms.

### Edit affordance

The `"Edit"` link on the locked Stage 1 card allows returning to edit Stage 1:

- On click: Stage 2 collapses (reverse animation), Stage 1 becomes editable again
- Values already entered in Stage 2 are **retained** — the user does not lose their work
- Stage 1 card returns to full opacity, inputs re-enable

---

## State 3: Stage 2 — Optional sections

### Layout

Stage 2 flows below Stage 1 in the same single-column layout. No two-column arrangement (discussed in Concerns section).

### Section order

1. **Vendors** — always expanded
2. **Purchasers** — always expanded
3. **Solicitors** — collapsed by default
4. **Price & fees** — collapsed by default
5. **Notes** — collapsed by default
6. **Chain** — collapsed by default

### Vendors and Purchasers sections (always expanded)

Not collapsible. Rationale: contacts are the most commonly needed Stage 2 data, especially for outsourced files, and collapsing them by default would add friction for the majority of submissions.

**Each section:**
- Section label: `"Vendors"` / `"Purchasers"` in semibold
- One contact row shown by default (pre-populated from MOS extraction in State 2)
- Each row: `Full name` / `Phone` / `Email` — three fields in a row (stacked on mobile)
- `"+ Add another vendor"` / `"+ Add another purchaser"` button below all rows
- Delete affordance: `"Remove"` link at the right of each row — only shown when more than 1 row exists

**Cap behaviour:**
- At 4 rows: `"+ Add another"` button is replaced by: `"You've reached the maximum of 4 vendors"` — `text-sm text-slate-400`
- Existing rows remain editable and deletable; deleting brings the count below 4 and re-shows the add button

**Outsourced required treatment:** See Outsourced Validation section.

### Collapsed expander design

Each collapsed section shows:
- Section label (semibold, ~14px)
- `"Optional"` or `"Recommended"` label in `text-xs`:
  - Solicitors: `"Recommended"` in amber — missing solicitors generate Work Queue alerts
  - Price & fees: `"Optional"`
  - Notes: `"Optional"`
  - Chain: `"Optional"`
- Chevron icon right-aligned (rotates on expand)
- **Summary chip when collapsed with data**: e.g. `"Smith & Jones LLP"` in `text-xs text-slate-500` — lets the user verify what's filled without expanding
- On hover: subtle background tint

### Collapsed → expanded animation

- `height`: 0 → auto via `max-height`, `cubic-bezier(0.34, 1.56, 0.64, 1)`, 240ms
- `opacity`: 0 → 1, 200ms

### Submission button

`"Create transaction"` sits at the bottom of Stage 2, below all sections:

- Always active once in Stage 2 (Stage 1 fields already validated)
- Exception: disabled if outsourced is selected and required contact fields are empty (see Outsourced section)
- Loading state: text changes to `"Creating..."`, coral spinner prepended, button disabled
- No full-page overlay — button state alone is sufficient for the expected <2s duration

---

## Outsourced contact validation

When `"Send to Sales Progressor"` is selected (in Stage 1 pill picker):

### Visual changes to Vendor and Purchaser sections

- Section labels: `"Vendors *"` / `"Purchasers *"` — asterisk in coral
- Below the section label: `"At least one vendor with a name and contact method is required"` — `text-xs text-amber-600`
- First contact row's `Full name` field gains a required indicator
- Between `Phone` and `Email` fields: `"At least one required"` paired label

### Validation timing

| Event | Behaviour |
|---|---|
| Blur from a contact field | If row has a name but neither phone nor email: show `"Add a phone number or email address"` below the row |
| Submit attempt | Full validation fires; sections with errors scroll into view and highlight |

Error message on failed submit: `"Add at least one vendor with a name and contact method before sending to a progressor"` — displayed as an inline alert above the submit button, not a toast.

### Toggling outsourced → self-progress

- Required `*` labels and hint text disappear immediately
- Validation clears — no red states
- Values already entered are **retained**
- Submit button re-enables if it was blocked

### Toggling self-progress → outsourced

- Required visual treatment (labels, hint text) appears immediately
- Validation does not fire until first blur or submit attempt

---

## Vendor/purchaser cap of 4

| State | Behaviour |
|---|---|
| 1–3 rows | `"+ Add another vendor"` / `"+ Add another purchaser"` button visible |
| 4 rows | Button replaced by: `"You've reached the maximum of 4 vendors"` — `text-sm text-slate-400` |
| Row deleted from 4 | Button reappears |
| 1 row | No delete affordance (cannot remove the only row) |

---

## Submission flow

### Loading state

- `"Create transaction"` button text → `"Creating..."`, coral spinner icon, button disabled
- No full-page overlay

### Duplicate address error

Server returns `DUPLICATE_ADDRESS`:
- Modal: `"A file already exists for [address]"`
- Two actions: `"View existing file"` (link to duplicate) and `"Create anyway"` (re-submits with `forceCreate: true`)
- Modal is not dismissible by clicking outside — user must make a choice

### Server error

- Toast: `"Something went wrong — your file wasn't created. Try again or contact support."` — auto-clears after 8 seconds
- `"Create transaction"` button re-enables
- Form state is preserved — no data loss

### Success redirect

Unchanged from today:
- `mosAutoConfirmed === true` → `/agent/transactions/[id]?mosConfirmed=1`
- Otherwise → `/agent/transactions/[id]?newFile=1`

---

## Draft system integration

### Compatibility with the new state model

The draft system uses `PropertyTransaction` records with `status: "draft"`. No schema changes are required for this build.

**Loading a draft from State 1 (cold start):**
- Drafts are surfaced as a floating panel or banner on the page as today
- Loading a draft transitions directly to State 3 Stage 2 with Stage 1 fields pre-populated and locked
- This bypasses both the MOS hero zone and the Stage 1 form card — the user lands in the full form immediately

**Mid-state restoration logic:**

| Draft state | Restore behaviour |
|---|---|
| Has address + tenure + purchase type + who progresses | Restore into Stage 2 (Stage 1 auto-locked, Stage 2 expanded) |
| Missing any Stage 1 field | Restore into Stage 1 with available fields pre-filled; Stage 2 does not expand until Stage 1 is complete |

**Draft save trigger:** Unchanged — fires when the user navigates away with unsaved form data. The save captures all current field state including Stage and which expanders are open.

**No changes required to draft save/load logic.** Existing draft data maps cleanly to Stage 1 vs Stage 2 fields without schema changes.

### Flagged concern: draft accumulation

Draft transactions have no expiry. This is a pre-existing gap (see TO CONFIRM 10 in the discovery document). The new form makes draft creation more likely — users who reach Stage 1 and navigate away will trigger a draft save. A cleanup cron job should be planned for a later phase but is out of scope here.

---

## Mobile considerations

Not deep-designed in this spec. Layout adaptations to anticipate:

### State 1 (hero drop zone)
- Viewports < 640px: reduce height to 240px; reduce headline to 18px
- Idle floating animation pauses on touch devices (no hover, no drag API)
- Entire zone must be tappable (as a large `<input type="file">` target)
- Consider acknowledging camera capture in the copy: `"PDF, JPEG, or PNG — including photos of a printed memo"` — this is a real workflow for UK agents

### State 3 Stage 1 (address group)
- Three-field address row stacks vertically on mobile: Street address full-width, then City + Postcode side by side (or all three stacked)
- Pill pickers: `flex-wrap` with minimum pill width ~120px; "Cash from proceeds" is long — test wrapping at 375px

### Stage 2 expanders
- All sections remain collapsible on mobile
- Vendor/purchaser rows: Name full-width, Phone + Email stacked below name
- No layout changes needed for collapsed state

### General
- Submit button: full-width on mobile (matches current form)
- Solicitor pickers (search-as-you-type dropdowns): ensure dropdown opens above the field when the keyboard is visible and pushes the viewport

---

## Concerns and trade-offs

### 1. Single-column vs two-column layout

The current form uses two columns (optional fields on the right). This spec proposes single-column for clarity and mobile compatibility. Trade-off: two-column allows faster scanning for experienced agents who know the form. **Option to consider before build:** Stage 2 keeps single-column for everything except Vendors and Purchasers, which appear side by side (two equal columns). This gives the most-used sections the space they need without reverting to the current full two-column layout.

### 2. Stage 1 lockdown after Continue

Making Stage 1 read-only after "Continue" is clicked adds friction if the user spots a typo. The `"Edit"` link on the locked card mitigates this, but it requires re-collapsing Stage 2. **Simpler alternative:** keep Stage 1 fields always editable throughout Stage 2 — no locking, no "Edit" link needed. The trade-off is a less distinct "progress through stages" feel. Decide before build.

### 3. Auto-advance (not recommended)

Auto-advancing to Stage 2 when all four Stage 1 fields complete would remove one click. Not recommended: if a user tabs through fields, Stage 2 would appear mid-completion, which is disorienting. The explicit "Continue" button is the right choice.

### 4. Solicitors expander: default state

Solicitors are important (missing ones generate Work Queue alerts) but optional at creation time. Collapsed by default reduces perceived form length. **Counter-argument:** if the agency's solicitor-entry rate is high (most agents add solicitors immediately), defaulting to expanded saves clicks. Without analytics, collapsed is the safe default — but this is worth revisiting once the new form has been in use.

### 5. MOS upload on mobile

State 1 is designed around drag-and-drop, which is unavailable on mobile. The file picker fallback works, and camera capture of a physical memo is a real workflow in UK agency. The copy and zone sizing should account for this — see Mobile section.

### 6. Extraction latency and user expectation

MOS extraction takes 1–5 seconds after upload. The spec assumes a spinner or progress indicator is shown during this window. This must be confirmed in the build spec for the MOS upload component — and tested with real UK memo formats (different agency formats, handwritten sections, photos vs scans) to understand actual reliability before launch.

### 7. "Who progresses" pill in State 1 for outsourced-only agencies

Some agencies may intend all their files to go to the progressor team. Currently `Agency.modeProfile` is analytics-only and does not pre-select the toggle. If these agencies exist in practice, they will be clicking `"Send to Sales Progressor"` on every file. A per-agency default is possible but requires reading `modeProfile` or a new field — flagged here for consideration post-launch when usage patterns are clearer. Not in scope.

---

## Out of scope (confirmed)

- Changes to `createTransactionAction` server action contract
- MOS extraction model, prompt, or API route changes
- Solicitor firm lookup/creation API changes
- Draft expiry / cleanup cron job
- Internal staff dashboard (`/dashboard`) read path
- Service type post-creation editing
- Address, tenure, purchase type post-creation editing (Phase 5 scope)
