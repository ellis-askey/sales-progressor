# Polish Pass: Workflow

**Status:** Methodology only. No page has entered Stage 1 yet. Ellis must sign off on this doc before Stage 1 of the first page begins.

---

## Overview

Every customer-facing page goes through four stages in strict sequence. One page is in flight at a time — never start Stage 2 of page N+1 while Stage 4 of page N is unverified. The "no functionality lost" contract means Stage 1 must be thorough enough that Stage 4 is mechanical. If Stage 1 is incomplete, Stage 4 will break something.

This workflow covers the agent pass. The buyer/seller portal pass follows the same methodology — see **Portal Handoff** below.

---

## The Four Stages

### Stage 1 — Inventory

**Who does it:** Claude reads the page, its components, and its data dependencies. Produces an inventory doc using `INVENTORY_TEMPLATE.md`.

**What gets captured:** Every component, every state, every interactive element, every line of user-visible copy — verbatim. Both desktop and mobile views documented separately. Known edge cases flagged. Out-of-scope items listed.

**Sign-off gate:** Post the inventory. Ellis reads it. No Stage 2 until Ellis replies with explicit approval (not implied silence).

**Rule:** If reading the page files to produce Stage 1 reveals that three more component files need reading before the inventory is complete, those files get read. The inventory is done when it's complete, not when it's convenient.

---

### Stage 2 — Redesign test page

**Who does it:** Claude builds a new page at the preview route (see below). No production files are touched.

**What gets built:**

- A standalone page rendering realistic mocks of every state listed in the inventory — populated, empty, loading, error, and any page-specific states
- Both desktop (full-width) and mobile (375px frame) views, on the same page
- Reduced-motion toggle carried over from the animation test page (same `data-rm` attribute pattern)
- Old copy annotated next to new copy in the JSX as `{/* OLD: "..." */}` comments above each changed string
- State toggles where needed (e.g. a button to switch between "populated" and "empty" views without navigating)

**Mocked vs production components — mandatory rule:**

Some components on the test page will be *mocked* (custom inline implementations rather than imports of the production component). This is sometimes unavoidable — a component may be too stateful or data-dependent to use directly in the test page. However, every mocked component creates a blind spot: Stage 4 will apply classes from the test page, but the production component has a different implementation. The mock is the visual target; it is not the contract.

Two requirements for every mocked component:

1. **Source annotation in the test page.** Above the mock's JSX, add a comment:
   ```tsx
   {/* MOCKED: [ComponentName] — production import at [path]. Stage 4 must verify production file against inventory. */}
   ```
2. **Inventory section 2 annotation.** In the Stage 1 inventory, find the component in the component table (section 2) and add the note: `[MOCKED IN TEST PAGE — not a production import. Stage 4 must verify production file separately.]`

**Stage 2 gate confirmation must list all mocked components** so Ellis knows what was not directly shown in the test page.

**Rule:** If a component is mocked, Stage 4 must explicitly walk every canonical class task in the inventory's section 12 that applies to that component against the production file — even if the mock "looked right." The mock confirms the visual direction; the inventory task list confirms the mechanical application.

**Preview route convention:**

```
app/agent/polish/[page-slug]/page.tsx
```

Examples:
- `app/agent/polish/transaction-detail/page.tsx` → `/agent/polish/transaction-detail`
- `app/agent/polish/hub/page.tsx` → `/agent/polish/hub`
- `app/agent/polish/login/page.tsx` → `/agent/polish/login`

The `/agent/polish/` prefix is accessible to agent-role users in the existing middleware — no middleware changes needed. Auth pages are placed under this path even though the originals live at the root (they're still agent-facing).

**Desktop and mobile on the same page:**

Desktop mock goes first (natural reading order). Mobile mock follows below it, wrapped in a 375px frame, clearly labelled "Mobile". For complex pages where side-by-side comparison is valuable, a narrow column approach can be used — but the default is stacked. Both must be visible without a toggle, because a toggle means one view gets less attention.

**Interactive Polish Gate — must be verified before requesting Stage 2 sign-off:**

Every Stage 2 test page must clear all ten of the following before sign-off is requested.

**Verification standard (mandatory):** Every gate item must be verified by Playwright assertion or Ellis browser walkthrough — never from reading source code. The confirmation message for each item must cite a Playwright test name + pass/fail result + screenshot filename (for assertable items), or state "requires Ellis browser walkthrough" with the specific thing to check (for subjective items). "The code references the correct class" does not clear a gate item.

**What Playwright can assert:** class presence/absence, computed CSS property values (boxShadow, transitionDuration, stroke-dashoffset), element visibility, bounding boxes (position: fixed, width/height), link href attributes, pixel-range checks on screenshot regions. These items must have Playwright evidence.

**What requires Ellis walkthrough:** hover feel and visual responsiveness, theme colour shift quality, animation timing/easing compared to anim-preview reference, keyboard navigation experience, mobile layout quality. These items cannot be fully captured by assertion — they require Ellis to open a browser and confirm. Mark them explicitly "requires Ellis browser walkthrough" — do not fabricate a Playwright pass for these.

**Reference comparison step:** Where a page's animations correspond to patterns in `/agent/anim-preview`, the Stage 2 test page must be compared against anim-preview's output directly in the browser before sign-off is requested. The bar is "matches anim-preview" — not "code looks similar to anim-preview code." This is a walkthrough item.

1. Every interactive element uses the appropriate canonical class from `ANIMATION_STANDARDS.md` — no bespoke inline styling for buttons, pills, links, icon buttons, accordion headers, inputs, or other elements that have a canonical class. **Verified by:** hovering every interactive element and confirming canonical hover/press-down behaviour fires.
2. Every interactive element has working hover, focus, and active states (where applicable for that element type). **Verified by:** using a mouse and keyboard on every element.
3. Focus treatment is correct for each element type — tabs use the underline/text-decoration pattern (not the halo ring); inputs and buttons use `--agent-focus-ring`; accordion headers use the inset ring. **Verified by:** tabbing through the page and observing focus treatment on each element type.
4. All hover, focus, and active states use theme tokens (`--agent-*`) — no hardcoded colour values. **Verified by:** switching themes and confirming hover/focus colours shift with the theme.
5. Verified across all six themes (Sunset, Coastal, Heritage, Slate, Emerald, Claret) using the theme switcher. **Verified by:** clicking through all six themes and visually confirming colours, backgrounds, and focus rings shift cleanly on each.
6. Reduced-motion respected — toggle the reduced-motion control and confirm: all translate/scale animations stop, ring draw-on stops, tab underline snaps rather than slides. Colour transitions may remain (they are non-spatial). **Verified by:** toggling the rm control and observing every animated element.
7. Keyboard-only tab through the entire test page — focus is clearly visible on every element, never invisible, never the wrong treatment for the element type. **Verified by:** a complete keyboard-only pass from top to bottom of the page.
8. Page-specific animations from section 10 of the Stage 1 inventory all fire correctly, and match anim-preview reference patterns where applicable (progress ring draw-on = C3, tab indicator = A5). **Verified by:** triggering each animation and comparing to the anim-preview reference.
9. Loading skeleton (where applicable) matches the production page layout — not generic bars. **Verified by:** visual comparison against a screenshot of the production loading state.
10. Mobile view documented and verified at 375px — layout, stacking order, and interactive states all checked. **Verified by:** viewing the 375px frame on the test page and confirming hierarchy and touch targets are correct.

This gate was first established during new-v2 Stage 2/3 (2026-05-11). It applies to all remaining agent pages.

**Updated 2026-05-11 (v2):** Playwright-verified evidence is now mandatory for all assertable gate items. "Observed in browser" language is retired — the format is now "Playwright assertion" (with test name + pass/fail + screenshot) or "requires Ellis browser walkthrough" (with specific check). Gate items without one of these two forms are blockers, not deferrals.

**Sign-off gate:** Post the completed GATE CONFIRMATION block below, including the Playwright run output and all screenshot references. Then ask Ellis to complete the walkthrough items and visit the preview route. No Stage 3 until Ellis replies with explicit approval.

**GATE CONFIRMATION FORMAT** — copy this template and fill in every field before posting Stage 2 sign-off:

```
## GATE CONFIRMATION (Stage 2 — [page-slug])

Playwright suite: e2e/[spec-filename].spec.ts — [N]/[N] tests passing

1. Canonical classes
   Playwright assertion: [test name: PASS — e.g. "G1-canonical-classes: PASS — 0 elements with raw background-color found"]
   Screenshot: [filename]

2. Hover / focus / active states
   Playwright assertion: [test name: PASS — e.g. "G7-focus-states: PASS — agent-input focus ring confirmed, icon-btn focus ring confirmed"]
   Screenshot: [filename]
   requires Ellis browser walkthrough: hover every interactive element — confirm visual response matches canonical behaviour

3. Focus treatment correct (tabs = underline, inputs/buttons = ring, accordions = inset ring)
   Playwright assertion: [test name: PASS — e.g. "I3-tab-focus: PASS — focused .agent-tab boxShadow = 'none' (no halo), text-decoration confirmed"]
   Screenshot: [filename]

4. Theme tokens — no hardcoded colours in hover/focus states
   requires Ellis browser walkthrough: switch all six themes and hover/focus elements — confirm colours shift with each theme (computed style sampling is insufficient for full visual QA)

5. All six themes: Sunset, Coastal, Heritage, Slate, Emerald, Claret
   Playwright assertion: [test name: PASS — e.g. "G5-themes: PASS — 6 theme screenshots captured"]
   Screenshots: [sunset filename], [coastal filename], [heritage filename], [slate filename], [emerald filename], [claret filename]

6. Reduced-motion respected
   Playwright assertion: [test name: PASS — e.g. "G6-reduced-motion: PASS — transitionDuration ≤ 0.01ms on .agent-btn in rm mode; ring offset snapped"]
   Screenshot: [filename]

7. Keyboard-only tab through entire page
   requires Ellis browser walkthrough: tab from top to bottom of the page — every element must have visible focus, no invisible stops, treatment matches element type

8. Page-specific animations (vs anim-preview reference where applicable)
   Playwright assertion (where automatable): [test name: PASS — e.g. "I4-ring-animation: PASS — stroke-dashoffset reached target within 1200ms; rm snap verified via transition style"]
   Screenshot: [filename]
   requires Ellis browser walkthrough: open /agent/anim-preview alongside the test page — confirm animation timing, easing, and feel match the reference (cannot be asserted programmatically)

9. Loading skeleton (where applicable)
   [Playwright assertion if testable — e.g. "G9-skeleton: N/A — page has no loading skeleton state"]
   [requires Ellis browser walkthrough if visual match to production loading state is required]

10. Mobile view at 375px
    Playwright assertion: [test name: PASS — e.g. "G10-mobile: PASS — screenshot captured at 375×812"]
    Screenshot: [filename]
    requires Ellis browser walkthrough: confirm layout stacking order, touch target sizing, and visual hierarchy — layout quality cannot be fully asserted programmatically
```

Items 1–10 must all have either a Playwright assertion or a "requires Ellis browser walkthrough" declaration. "Code looks correct" or "should work" is not a valid entry. Do not fabricate Playwright results — if a test did not run, say so.

---

### Stage 3 — Voice review

**Who does it:** Ellis reads just the copy — headings, labels, button text, empty states, error messages, helper text. Refers to `VOICE_GUIDELINES.md` as the standard.

**What gets reviewed:** The Stage 2 test page. Claude is available to propose revisions. Revisions happen in the test page only — production copy is not touched yet.

**Sign-off gate:** Ellis confirms voice is approved. This can be fast (one round) or take multiple revisions. Do not proceed to Stage 4 while copy is in question.

---

### Stage 4 — Production swap

Stage 4 transplants the polish page's visual design onto production components. The polish page is the contract — production must look like the polish page when Stage 4 is done. Structural markup changes, layout reflows, hierarchy changes, and component restructuring are all in scope, alongside canonical class application.

Every prop, server action, useOptimistic hook, conditional render, and edge case catalogued in the Stage 1 inventory must survive the transplant unchanged. The visual layer changes; the wiring does not.

If during Stage 4 you find that something on the polish page doesn't work for production (e.g. real data breaks the layout, an edge case the mock didn't anticipate), do not change the polish page during Stage 4. Stop, escalate, return to Stage 2, amend the polish page with Ellis's sign-off, then resume Stage 4 against the amended polish page. The polish page is the contract; only Stage 2 can change it.

**What happens:** The Stage 2 test page has proven the design and the Stage 3 pass has approved the copy. Now:

1. Open the production route and the polish test page side by side
2. Section by section, audit visual match: hero, banners, tab strip, each tab's cards, sidebar, modals, drawers
3. For each "no" — describe the gap and what the production component needs to change to close it
4. Post the audit. No code until the audit is reviewed and authorized
5. Implement: edit production components to match the polish page visually, preserving all wiring
6. Apply copy changes — each changed string has an `{/* OLD: */}` annotation in the test page so nothing gets lost
7. Run `npx tsc --noEmit` — must pass clean
8. **Commit** the changes as a single atomic commit. Message format: `polish-pass: stage 4 — [page name] ([route])`. This step is mandatory before posting "ready" — no commit, no gate.
9. **Local-visibility check** — confirm the production route (e.g. `/agent/transactions/[id]`) matches the polish route (e.g. `/agent/polish/transaction-detail`) visually. The production route is the only valid verification surface. Run `npm run dev` if not already running.
10. **Playwright on the production route** — if the production route is automatable (static ID or test account), run the gate spec against it. If it requires a real transaction ID that Claude cannot supply, state this explicitly in the gate post and Ellis runs it before sign-off.
11. If something regresses, revert (see Rollback below) and return to Stage 2

**Sign-off gate — mandatory format.** Post the following block before declaring Stage 4 ready. No field may be omitted or substituted with "should work":

```
## STAGE 4 READY — [page-slug]

Commit: [SHA]
Production route: [URL]
tsc: PASS / N errors

VISUAL PARITY — section-by-section (primary gate)

Per-section spec from inventory Section 13 (Per-section visual specification):

  Section: [Hero]
    Polish-page structure: [brief description from inventory]
    Production after Stage 4: [matches polish / gap: describe]
    Screenshot evidence: [filename — production route]

  Section: [File health banner]
    [same format]

  Section: [Tab strip]
    [same format]

  [Continue for every section in the inventory's Section 13 — no omissions]

  All sections match polish page: YES / NO
  If NO: list the gaps and the reason (e.g. polish page needs amendment, data edge case discovered, scope decision needed from Ellis)

CANONICAL CLASS CHECKLIST — Section 10.5 tasks (secondary gate)

  Task 1 — .agent-acc / .agent-acc-in: applied at [file]:[line] / N/A
  Task 2 — .agent-reveal-in / .agent-reveal-out: applied at [file]:[line] / N/A
  [... continue for all tasks ...]

LOCAL VISIBILITY

  Checked at: [production route URL on npm run dev]
  Production matches polish page visually: YES / NO
  Real-data edge cases verified: [list specific transactions / states tested]

PLAYWRIGHT

  [N]/[N] tests passing against [route] / N/A (reason)

FUNCTIONAL SERVER-ACTION SPOT-CHECK

  Required for any commit that touches a component wired to a server action.
  One end-to-end exercise per server action in scope. No field may be skipped.

  Action: [server action name, e.g. confirmMilestoneAction]
    Trigger path: [how it was invoked — e.g. "clicked Confirm on VM3 in Sarah Jones > 14 High Street"]
    Verified state change: [observable proof — e.g. "row turned green, DB row MilestoneCompletion.completedAt set"]
    Reverse path: [undo exercised / N/A — e.g. "Undo clicked, row returned to available state"]

  [Repeat block for each server action touched in this commit]

  If no server actions are in scope for this commit: state "No server actions in scope."

MOCKED COMPONENTS VERIFIED

  [ComponentName] — [confirmed production file rebuilt to match polish / NOT verified]

ELLIS WALKTHROUGH ITEMS

  [list specific items requiring Ellis browser walkthrough]

24h monitoring window: starts after Ellis deploys to production
```

**Rules for the task checklist:**
- Every task row is required, even if the answer is "N/A — not applicable to this page."
- "Applied" entries must cite file and line number. "MISSED" entries must explain why (out of scope, deferred, needs design decision).
- A MISSED row in the gate post is a visible gap — it does not block the gate if agreed, but it must be listed. Hidden misses (prose summaries that obscure skipped items) are what this format prevents.
- The checklist is not a sign-off blocker if misses are intentional and documented. It is a blocker if rows are omitted or fabricated.

The SHA field is structurally required. If there is no SHA, the commit has not been made and the gate cannot be posted. "tsc clean" alone is not a gate.

**Spot-check path (after gate post):**
- Ellis runs `npm run dev` and walks through the production route locally (functional check)
- Ellis deploys to production
- Ellis walks through on the deployed production URL (final spot-check)
- Stage 4 sign-off after the production-URL walkthrough confirms clean

**24h monitoring window:** starts after the production deploy, not after the commit.

---

## Critical Rules

### Sign-off phrasing

Approvals from Ellis use the explicit phrase **"Stage N approved"** — for example, "Stage 1 approved", "Stage 2 approved", "Stage 4 approved". Any other reply — questions, comments, partial feedback, silence — is not approval and does not unlock the next stage.

This convention exists so approvals can be grep'd through long conversation history. When in doubt, do not proceed.

### One page in flight at a time

Never start Stage 2 of page N+1 while Stage 4 of page N is unverified.

**Why this matters:** Stage 1 builds a shared mental model of what exists on a page today. If two pages are in flight simultaneously, context switches cause inventory drift — you think you're fixing the work queue but you're looking at hub notes. Stage 2 of the second page is built against stale memory. This is how small regressions accumulate unnoticed. The constraint feels slow. It is slower per-calendar-day and dramatically faster per-shipped-page.

### Mid-flight discovery

**Definition:** During Stage 2, Claude finds a component, state, or piece of copy that the Stage 1 inventory missed.

**Process:**
1. Stop Stage 2 work
2. Note the discovery in a reply: "Mid-flight discovery: [what was found]. Adding to inventory."
3. Append it to the Stage 1 inventory doc under a `## Amendments` section with a timestamp
4. Ellis acknowledges (a brief "noted" is enough — this is not a full re-sign-off)
5. Resume Stage 2, incorporating the discovery

**Do not** silently incorporate the discovery without noting it. The inventory is the contract.

### Scope creep

**Definition:** During any stage, Claude notices that a refactor (component extraction, data-fetching change, hook reorganisation) would make the redesign cleaner or fix a related bug.

**Process:**
1. Note it separately: "Scope note: [what was found]. Not touching this in the polish pass — flagging for a follow-up task."
2. Add it to `docs/TODO.md` or `docs/POST_LAUNCH_FIXES.md`
3. Continue the polish pass unchanged

The polish pass has one job. Refactors go in a separate PR. No exceptions.

### Rollback

Each Stage 4 is committed as a single atomic commit (one page, one commit). The commit message includes the page route.

**Revert path:**
```
git revert [stage-4-commit-sha]
```

This restores the production page to its pre-Stage-4 state in one command. No surgical file-by-file undo required.

After revert: file a note in `docs/POST_LAUNCH_FIXES.md` describing what broke, commit the revert, and return to Stage 2 of the same page. Do not start the next page.

**Monitoring window:** After Stage 4, the page should be observed on real data for at least one working session before the next page enters Stage 1. If a regression surfaces in that window, the revert path above is the response.

---

## Portal Handoff

After the agent pass completes, the buyer/seller portal pass begins, reusing this methodology without modification.

**What is portable (no changes needed):**
- This workflow doc — all four stages, all rules, the preview route convention, the rollback path
- `INVENTORY_TEMPLATE.md` — all sections apply to portal pages. The "who sees it" field will say "buyer/seller (token-authenticated)" instead of "agent (director/negotiator)"
- `VOICE_GUIDELINES.md` — the three core rules apply. The translation table has a portal column. Tone calibration shifts from "brisk" to "reassuring, plain" — see the portal audience note in that doc
- `ANIMATION_STANDARDS.md` — the five canonical classes (`.agent-acc`, `.agent-reveal-in`, `.agent-reveal-out`, `.agent-dropdown-in`, `.agent-row-flash`) and the per-page JS patterns apply to portal pages. The portal layout may need a one-line import of `agent-system.css` to pick them up — confirm at portal pass start. The portal-specific sheet slide-up (B6) and group accordion (B7) use the same `.agent-acc` pattern.

**What changes for the portal pass:**
- Preview routes: `app/portal/polish/[page-slug]/page.tsx` instead of `app/agent/polish/`
- Mobile weight: portal pages are more mobile-centric than agent pages. If a portal page has no meaningful desktop view, document that in Stage 1 and build the mobile view first in Stage 2
- Copy standard: audience is a buyer or seller navigating a life event, not an estate agent professional. The voice doc notes where rules tighten for this audience
- Interactive Polish Gate: all ten items apply to portal pages without modification. The audience difference (calmer motion, reassuring tone) is handled by `VOICE_GUIDELINES.md` — the gate itself does not change

**Agent-specific assumptions in this doc (to flag for portal re-read):** None. The methodology was written without agent-specific assumptions baked in. The portal pass can start from this doc as-is.

---

## Deferred Stage 4 — Exception pattern (new-v2 only)

This section documents a single exception to the standard four-stage workflow. It applies only to `/agent/transactions/new-v2` (queue position 1). No other page in the queue uses this pattern. If you find yourself reaching for it on another page, stop and flag it to Ellis first.

### Why the exception exists

The standard workflow assumes Stage 4 (production swap) follows immediately after Stage 3 (voice sign-off). For new-v2, that assumption breaks: the form creates the `PropertyTransaction` record that every downstream page reads. Cutting over production while downstream pages are still on old patterns creates a window where the form produces data that the consuming pages aren't designed for. Stages 1–3 proceed normally. Stage 4 is deferred until the main consumers are ready.

### The holding state

When Ellis says "Stage 3 approved" for new-v2, the page enters a holding state. The holding state is recorded by updating the status line at the top of the new-v2 inventory doc to:

```
Stage 3 approved [date]. Stage 4 deferred — awaiting trigger (see WORKFLOW.md). Frozen. Do not re-open Stage 2 without explicit instruction from Ellis.
```

In this state:
- The inventory doc is a locked artifact. No edits without a mid-flight discovery note and Ellis's acknowledgement.
- The test page at `/agent/polish/new-sale-v2` is a frozen artifact. No edits without Ellis's instruction.
- The approved copy is final for Stage 4. Changes require re-opening Stage 3, not silent edits.

The holding state is visible, documented, and inert. It does not need active tracking beyond the status line in the inventory doc.

### What triggers deferred Stage 4

Stage 4 of new-v2 is allowed when all six of the following pages have reached Stage 3 approved:

| Page | Route | What it reads from new-v2's output |
|---|---|---|
| Transaction detail | `/agent/transactions/[id]` | Full `PropertyTransaction` record: address, tenure, type, fee, contacts, solicitors, milestones, chain |
| Hub | `/agent/hub` | Aggregate counts, service split (self-managed vs outsourced), exchange forecast |
| Work queue | `/agent/work-queue` | `ReminderLog` and `ChaseTask` records created at transaction init |
| Transaction list | `/agent/transactions` | Transaction rows: address, status, price, assigned agent |
| All/My Files dashboard | `/agent/dashboard` | Same shape as transaction list; role-filtered |
| Analytics | `/agent/analytics` | Fee totals, referral fees, agent fee calculations, timing data |

These six cover the data new-v2 creates across its full lifecycle: the form inputs (transaction detail, list, dashboard), the automation outputs (work queue), the aggregations (hub), and the financial derivations (analytics). When all six are at Stage 3, the consuming pages are designed to the final data shape and the cutover is safe.

Pages positioned after these six in the queue (solicitors, partners, settings, help, auth, errors) do not consume new-v2's output directly and are not required triggers.

### How the one-page-in-flight rule bends

The user's read is correct and confirmed: **the rule bends, it does not break.**

The one-page-in-flight rule exists to prevent inventory drift from concurrent Stage 1/2/3 work — active reads, active edits, active decisions. A post-Stage-3 frozen page involves none of these. Its inventory is locked, its test page is static, its copy is approved. Nothing about it can drift while other pages run their full workflow.

Therefore: while new-v2 sits in holding, any other page in the queue can proceed through Stages 1, 2, 3, and 4 in the normal sequence.

**The one constraint that does not bend:** when new-v2's Stage 4 is eventually executed, it is the only Stage 4 in flight. No other page's Stage 4 runs simultaneously. The standard rule applies at that point.

### Drift protection during the holding period

If a downstream page's Stage 1 inventory reveals a data shape, field, or state that new-v2's frozen test page didn't anticipate, treat it as a mid-flight discovery on new-v2. Process:

1. Note it explicitly in the conversation: "new-v2 data shape conflict found during [page name] Stage 1 — [specific discrepancy]."
2. Append it to new-v2's inventory doc under `## Amendments` with a timestamp and description.
3. Ellis reviews. Two outcomes:
   - **Minor (new optional field, new validation message, new toast copy):** Ellis acknowledges. The amendment is noted for Stage 4 spot-checks. The test page stays frozen; Stage 4 will verify the discrepancy against real data at cutover time.
   - **Structural (a field that new-v2's form doesn't capture, a state the test page doesn't render):** Re-open new-v2's Stage 2 for the specific affected section. Get a Stage 2 amendment sign-off from Ellis. Re-freeze. This is the only condition under which the frozen test page is edited.

The amendment record in the inventory doc is the paper trail. Any structural re-opens must be listed there with date and reason.

### Stage 4 trigger event and cutover checklist

**Trigger message:** When all six trigger pages have reached Stage 3 approved, Claude posts:

> "New-v2 Stage 4 trigger met. Pages at Stage 3: transaction detail ✓, hub ✓, work queue ✓, transaction list ✓, dashboard ✓, analytics ✓. Initiating revalidation check before cutover."

Ellis replies with "proceed" or "hold". Only then does the revalidation check begin.

**Revalidation check (see next section):** Runs before any production file is touched.

**Cutover sequence: three commits**

The revalidation check precedes all three commits and runs before any production file is touched (see next section).

---

**Commit A — Prep (nav and route plumbing):**

1. **Update navigation links.** Any link in the codebase pointing to `/agent/transactions/new` must point to `/agent/transactions/new-v2`. Grep: `"/agent/transactions/new"` — update every match.
2. **Replace the old route.** `app/agent/transactions/new/page.tsx` becomes a redirect page:
   ```tsx
   import { redirect } from "next/navigation";
   export default function OldNewSalePage() { redirect("/agent/transactions/new-v2"); }
   ```
   This handles any bookmarks or cached links. The file stays; its content becomes a 307 redirect.
3. **Run `npx tsc --noEmit`** — must pass clean.
4. **Single atomic commit.** Message: "chore(new-v2): prep — nav link updates and old route redirect".

---

**Commit B — Cutover (form polish):**

5. **Apply UI and copy changes** to the production new-v2 page and its component tree. This is the standard Stage 4 mechanical swap — each changed string has an `{/* OLD: */}` annotation in the frozen test page.
6. **Run `npx tsc --noEmit`** — must pass clean.
7. **Spot-check on real data.** Create a test transaction via the new form. Verify it appears correctly in: transaction detail (milestone panel initialised, contacts rendered, sidebar), hub (file appears in pipeline), transaction list (row renders with correct data), work queue (initial reminders present).
8. **Single atomic commit.** Message: "feat(new-v2): Stage 4 cutover — form polish and voice pass".
9. **Monitor for 24h** before the next page enters Stage 1.

---

**Commit C — Cleanup (gated):**

Gated on explicit confirmation from Ellis ("cutover confirmed, safe to delete") after the 24h monitoring window closes. Do not run Commit C during the monitoring window — the v1 files are the rollback reference if a regression surfaces.

10. **Grep for v1 component references.** Search for `NewTransactionForm` and any other `components/transactions/` v1 component names. Confirm no remaining imports in the codebase.
11. **Run `npx tsc --noEmit`** — must pass clean after deletion.
12. **Assess the redirect file.** `app/agent/transactions/new/page.tsx` (installed in Commit A) is permanent infrastructure for cached links and bookmarks. Do not delete it unless Ellis explicitly confirms it is no longer needed. When in doubt, leave it in place.
13. **Delete v1 component files** confirmed to have no remaining imports.
14. **Single atomic commit.** Message: "chore(new-v2): delete v1 NewTransactionForm and components/transactions/ v1 files".

**If Commit C is deferred for any reason:** Log it in `docs/POST_LAUNCH_FIXES.md` so it is not forgotten. Do not leave cleanup as a floating intention.

### Revalidation before cutover

New-v2 may sit in holding for weeks while positions 2–9 complete their full workflows. Before Stage 4 executes, production may have drifted: new fields added to the schema, new components added to the form, new validation rules, schema migrations.

**Revalidation gate:** Before touching any production file, Claude reads the current `app/agent/transactions/new-v2/page.tsx` and the `NewSaleFlow` component tree and compares against the frozen Stage 1 inventory. Specifically:

- Are there new props, new form fields, or new conditional renders not captured in the inventory?
- Are there new components imported that weren't inventoried?
- Are there new copy strings that weren't in the Stage 3 copy inventory?

For each discrepancy found: treat as a mid-flight discovery (see drift protection above). Minor = note and incorporate into Stage 4 spot-check. Structural = re-open Stage 2, get sign-off, re-freeze.

If revalidation finds no discrepancies: state this explicitly ("Revalidation complete — no drift found. Proceeding to Stage 4.") and continue.

If revalidation finds significant drift (multiple structural changes, feature additions): report to Ellis before proceeding. Ellis decides whether to run a compressed Stages 2–3 refresh or proceed with the cutover acknowledging the gaps.
