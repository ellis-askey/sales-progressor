# File-detail hero header — redesign brief

**Date:** 2026-08-08
**Scope:** The header zone of the property file page at `/agent/transactions/[id]` — everything from the "Back to files" link down to (and including) the 6-stage milestone strip. Tab *content* (Overview, Steps, etc.) is out of scope.
**Purpose:** Handover document for a UI/UX redesign. Describes every element, its data source, its interactions, and every state the new design must handle. **Nothing listed here may be dropped without a decision.**

---

## The four zones (top to bottom)

The header is assembled in `app/agent/transactions/[id]/page.tsx` from four components:

| Zone | What the user sees | Component |
|---|---|---|
| 1. Hero | Back link, house icon, address, status + attribute pills, agent meta line, progress ring | `components/transaction/PropertyHero.tsx` |
| 2. Stats strip | Sale price / Sale type / Expected exchange | `components/transaction/TransactionStatsStrip.tsx` |
| 3. Tab bar | Overview · Steps · Reminders · To-Do · Activity, plus AI summary + Portal emails on the right | `components/transaction/PropertyFileTabs.tsx` |
| 4. Milestone strip | 6 stage circles: Instructed → Draft pack → Searches → Enquiries → Exchange → Completion | `components/transaction/MilestoneTimelineStrip.tsx` |

Above Zone 1, conditional banners can inject (on-hold banner, relist banner for withdrawn files, chain-setup-failed banner, "file claimed" toasts). The redesign needs a home for these.

---

## Zone 1 — Hero

### Content and data

| Element | Detail | Source |
|---|---|---|
| Back link | "← Back to files", goes to the file list | static |
| House icon tile | 56px coral-tinted rounded tile, desktop only | static |
| Address line 1 | e.g. "29 Berwick Way" — 20px semibold. Split on first comma | `propertyAddress` |
| Address line 2 | Remainder, e.g. "Sevenoaks, TN14 5EY" — 13px muted | `propertyAddress` |
| Status pill | Interactive control, not just a badge (see interactions) | `status` |
| Tenure pill | "Leasehold" / "Freehold" — hidden when null | `tenure` |
| Purchase type pill | "Mortgage" / "Cash buyer" / "Cash from Proceeds" — hidden when null | `purchaseType` |
| Service type pill | "Self-managed" (grey) or "With progressor" (coral) | `serviceType` |
| Round chip | Buyer-round indicator (e.g. which buyer attempt this is); opens round history. Slot-injected | `RoundChip` component |
| Meta line | "{agent name} · Added {date} · {elapsed}" — elapsed reads "5 weeks 3 days elapsed", "1 day elapsed", or "Landed today" | assigned user + `createdAt` |
| Progress ring | 72px ring, % from the milestone weight engine. Animated sweep on load (900ms), coral with glow. Honours `prefers-reduced-motion` | progress engine |

### Interactions (all must survive the redesign)

1. **Status pill is a dropdown** (`StatusControl`): click opens Active / On hold / Completed / Withdrawn. Three flows hang off it:
   - **→ Withdrawn:** modal collecting a structured "who pulled out" reason (4 radio cards, drives chain-cascade notifications, with an explainer of who gets notified when the file is in a chain) plus optional free-text detail.
   - **→ On hold:** modal collecting a return date (with past-date guard), an optional hold reason, or "hold indefinitely".
   - **On hold → Active:** modal offering "Resume automation" vs "Reactivate, keep emails paused".
   - Completing is gated server-side (needs exchange + completion milestones confirmed) — the error surfaces as a toast.
2. **Service type pill is interactive for admins only:** hover reveals a ⇄ icon, click opens a confirm-and-switch modal (self-managed ↔ outsourced). Plain static pill for everyone else.
3. **Round chip** opens buyer-round history (previous buyers, relists).
4. Back link navigation.

### Layout behaviour today

- **Desktop:** icon tile · title column · pills+meta column (max 320px) · ring, all on one row.
- **Mobile (<md):** tile hidden; a **small 56px ring takes the tile's slot** top-left; pills + meta re-flow full-width below the row. One shared modal instance serves both renderings.
- Address fields carry `data-sensitive="true"` (privacy/screen-share blurring) — new design must keep these attributes.

### Not visible in the screenshot but real

- A **second, dark-themed variant** of `PropertyHero` renders for the internal dashboard surface (different brand: dark glass, progress bar instead of ring, "Outsourced to us" badge, exchange countdown in days with overdue states). The agent-side redesign must either leave it untouched or split the component deliberately.
- `flagSlot` prop: arbitrary extra content injected into the hero row.
- On-track state (`on_track` / `at_risk` / `off_track` / `unknown` / `on_hold`) is computed and passed in but currently only used by the dark variant and the Sale health card — available if the new design wants a health signal in the hero.

---

## Zone 2 — Stats strip

Three equal columns in one elevated card, each with a small coral icon, uppercase label, and value:

1. **Sale price** — formatted from pence, "–" when unset. Marked `data-sensitive`.
2. **Sale type** — same mapping as the hero pill (duplication note below).
3. **Expected exchange** — uses the manual override date when set, otherwise the expected date; "–" when neither.

Mobile: labels shorten ("Price", "Type", "Expected") and the date collapses to d/m/yy.

**Known duplication for the designer to resolve:** sale type appears in both the hero pills and the stats strip; progress % appears in the ring and (on the dark variant) a bar. House rule is no same-screen duplication — the redesign is the moment to pick one home for each fact.

---

## Zone 3 — Tab bar

- Tabs: **Overview, Steps, Reminders, To-Do, Activity**. Deep-linkable (`?tab=`).
- **Live count badges** on Reminders and To-Do — they stream in after the tab panels load, so badges appear a moment after first paint (0 → n transition needs a design).
- Sticky at the top on scroll; in "hero connected" mode it sits transparent on the page backdrop rather than in a glass bar.
- **Right slot**, role-gated:
  - "✦ AI summary" button — currently Ellis-only.
  - "Portal emails" toggle — internal staff only (suppresses portal confirmation emails for the file).
  - Agency users see neither; the right side is empty for them.
- Mobile: the tab row becomes a full-width collapsible selector.

---

## Zone 4 — Milestone strip

Six fixed stages summarising the file journey (full milestone detail lives on the Steps tab): Instructed, Draft pack, Searches, Enquiries, Exchange, Completion. Each stage node has three states:

| State | Circle | Caption |
|---|---|---|
| complete | filled emerald + white tick | real completion date |
| active | white with coral ring + stage icon | "In progress" |
| pending | hollow slate outline + muted icon | "~ {forecast date}" or "–" |

Connectors between nodes are tinted by whether the previous stage completed. Stages never shrink below 92px; the strip scrolls horizontally on mobile. Has `role="list"` a11y semantics. Stage icons: house, document, magnifier, chat, handshake, key.

---

## States the new design must cover

- **File status:** draft, active, on hold, completed, withdrawn — each changes the status pill, and on-hold/withdrawn add banners above the hero.
- **Missing data:** no price, no sale type, no exchange date ("–" cells), no tenure/purchase-type (pills hidden), no assigned agent, address with no second line, very long addresses.
- **Role variations:** agency negotiator/director (no right-slot controls, static service pill), internal staff (portal toggle, admin service-switch), Ellis (AI summary).
- **Round chip present vs absent; in-chain vs not** (changes withdraw-flow copy).
- **Viewports:** 1280 desktop and 375 mobile are the tested baselines.
- **Motion:** ring sweep and tab transitions must honour reduced-motion.
- **Privacy mode:** `data-sensitive` on address and price.

---

## Constraints

- **Brand:** agent surface only — warm cream backdrop, coral `#FF6B4A` primary, glass cards, tokens in `design/tokens.ts` + `docs/reference/DESIGN_TOKENS.md`. No new colours or fonts.
- **Voice:** all copy passes `docs/reference/VOICE.md` (no em dashes, no exclamation marks, no system self-references, no technical codes).
- **Definition of done:** hover/focus/active/disabled on every control, loading/empty/error/first-time states, `docs/DEFINITION_OF_DONE.md`.
- **Modals** follow the canonical pattern in `docs/reference/MODAL_DRAWER_SYSTEM.md`.
- **No functionality loss:** every interaction listed above ships in the new design or is explicitly cut by founder decision, in writing.
