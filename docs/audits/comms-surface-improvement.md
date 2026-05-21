# Comms Surface Improvement — Design Proposal v2

**Source:** Activity tab, `/agent/transactions/[id]`  
**Status: Stage 1 complete — awaiting Arc 2 ship before Stage 2**  
**Last updated:** 2026-05-19 (v2 — all questions resolved)

Stage 2 does not begin until:
1. Arc 2 v4 lands and is approved
2. Arc 2 Stage 2 implementation ships
3. Ellis walks Arc 2 on real files for a working session

Arc 2 takes priority. Comms surface waits.

---

## 1. Current Add-Comm Flow Walkthrough

The entry point is a collapsed dashed button:

> `+ Add a note or log a communication…`

**Step count for a typical outbound email:**

| # | Action | UI element |
|---|--------|-----------|
| 1 | Click the dashed button | Expands the panel |
| 2 | Choose type: "Outbound" | Step 1 — three buttons (Internal / Outbound / Inbound) |
| 3 | Choose method: "Email" | Step 2 — six channel buttons |
| 4 | Tap contact pills, click "Continue" | Step 3 — contact selection + explicit continue button |
| 5 | Type content, click Save | Step 4 — textarea |

**Total: 5 interactions before the entry is saved.** For an internal note: 3 interactions (expand → Internal note → type → save).

**Other observations from the code:**

- The abstract Outbound/Inbound split precedes channel selection. An agent thinks "I'm sending an email", not "I'm doing an outbound then choosing email". Direction is a secondary detail.
- The step indicator (numbered circles) adds visual weight to what should feel lightweight.
- "Skip" on the contacts step signals the step is optional — if it's often skipped, it shouldn't be a full blocking step.
- WhatsApp is in the current channel list but wasn't in the old system. Keeping it.
- Post is a low-frequency channel — moving it to an overflow.

---

## 2. Current Card Layout Breakdown

Rendered in `ActivityTimeline.tsx` — two card variants:

### Comm card (outbound/inbound/internal/automated)

```
[CommPill]  [method text]  [contact name(s)]
[content body — up to several lines]
[createdByName · formatDate(at)]
                                          [× delete, hover only]
```

**What's shown:**
- Type badge: "← Inbound", "→ Outbound", "Internal", "System email" — text only, no icon, low visual weight
- Method: plain text label alongside the badge
- Contact names: plain first names, same size/weight as method
- Author: first name only, no visual treatment
- Date: `formatDate` → `"19 May 2026"` — **no time**
- No channel icon

**What's missing:**
- Time — `at` is a full `Date` but only the date is rendered
- Author pill — people are pills in the entry flow but degrade to plain text in the card
- Channel icon — nothing at-a-glance distinguishes an email row from a call row without reading the badge
- Combined direction+channel — "Outbound email" is more legible than "→ Outbound" + "Email" as separate elements

### Milestone card

Milestone cards are out of scope for this pass.

---

## 3. What the Old System Did Differently

Based on the reference at `app.thesalesprogressor.co.uk/admin_panel`:

- **Channel buttons surfaced immediately** — no collapsed state, no type-first step. Agents saw Email / Phone / SMS / Voicemail / Post as the opening UI.
- **Recipients pre-shown as pills** — contact pills visible before the agent started typing. Tap to include or exclude. No separate "Who was involved?" step.
- **Direction implicit or a toggle** — not a top-level branching choice.
- **Fewer steps, faster to complete** — estimated 2–3 fewer interactions.

---

## 4. Proposed New Add-Comm Flow

### Design principles

1. **Channel first.** Email/Phone/SMS/WhatsApp are the primary choices. Direction is secondary, surfaced as a toggle.
2. **Always visible.** No expand trigger — the panel sits above the feed permanently. Burying the primary action behind a click defeats the speed gain. *(Q1: decided — always-visible.)*
3. **Internal note is distinct** — conceptually different from a channel comm (no direction, no contacts, no share toggle). Kept in the primary row but visually separated with a thin vertical divider. *(Structural decision: option (a) — Note | divider | channels, not a separate row.)*
4. **No multi-step.** All input visible in one panel. No numbered step indicator. *(Q6: decided — removed.)*

### Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│  [📝 Note]  │  [✉ Email] [☎ Phone] [💬 SMS] [💚 WhatsApp] [more ▾]  │
│                                                                │
│  (after channel selected — inline state change, no animation) │
│                                                                │
│  Direction:  ● Outbound (sent)  ○ Inbound (received)          │
│                                                                │
│  [Mick] [Sarah] [James (V sol)] [+ more]                      │
│  (pills off by default — tap to include)                      │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ What was discussed or communicated?                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  [Save]  [Cancel]                   [ ] Share with client      │
└────────────────────────────────────────────────────────────────┘
```

**Internal note — after clicking "📝 Note":**

```
┌────────────────────────────────────────────────────────────────┐
│  [📝 Note]  │  [✉ Email] [☎ Phone] [💬 SMS] [💚 WhatsApp] [more ▾]  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Add an internal note…                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  [Save]  [Cancel]                                              │
└────────────────────────────────────────────────────────────────┘
```

No direction toggle, no contact pills, no share toggle — internal notes don't need them.

### Step count after redesign

| Flow | Interactions |
|------|-------------|
| Outbound email | Click Email → (direction defaults to Outbound) → tap contact pills → type → Save = **3–4** |
| Inbound call | Click Phone → toggle to Inbound → tap contact → type → Save = **4** |
| Internal note | Click Note → type → Save = **2** |

### Channel row (primary vs overflow)

**Primary row:** Note | Email | Phone | SMS | WhatsApp  
**Overflow ("more ▾"):** Voicemail, Post  
*(Q3: decided — WhatsApp in primary row; Post to overflow.)*

Voicemail in overflow for V1 — reassess with usage data once available.

### Direction model

| Channel | Direction toggle shown? | Default |
|---------|------------------------|---------|
| Email | Yes | Outbound |
| Phone | Yes | Outbound |
| SMS | Yes | Outbound |
| WhatsApp | Yes | Outbound |
| Voicemail | Yes | Outbound ("voicemail left") *(Q4: decided — outbound default)* |
| Post | Yes | Outbound |
| Internal note | No | — |

### Contact selection

- Pills pre-shown for all contacts on the file (clients + solicitors if present)
- None selected by default *(Q2: decided — none pre-selected; accidental inclusion harder to spot than the tap cost)*
- Post-V1 enhancement: smart-default to contacts from the most recent comm

### What stays the same

- `logCommAction` server action — no schema changes
- `visibleToClient` toggle — moves to bottom row of panel
- Contacts stored as `contactIds` — same model
- The "Start over" / Cancel path — just becomes Cancel since there are no steps

---

## 5. Proposed New Card Layout

### Badge treatment (structural revision)

The badge is the **primary scan signal** for the activity feed. It carries direction + channel in one element. It needs pill weight — coloured background, channel icon prefix, concise label — not bare text. This should visually match the weight of the contact pills in the same card.

```
[✉ Outbound email]   vs current:   → Outbound   Email
```

### Comm card — proposed

```
┌──────────────────────────────────────────────────────────────┐
│ [✉ Outbound email]   [Mick]  [Sarah]                         │
│                                                              │
│ Content body                                                 │
│                                                              │
│ [◎ Ellis]   Today, 14:32                                     │
└──────────────────────────────────────────────────────────────┘
```

**Changes vs current:**

| Element | Current | Proposed |
|---------|---------|----------|
| Type badge | "→ Outbound" + "Email" separate | "Outbound email" — single pill, coloured bg, icon prefix |
| Contact names | Plain first-name text | Small pills (consistent with entry UI) |
| Author | Plain first name | Small author pill — uniform slate colour *(Q5: decided)* |
| Timestamp | `"19 May 2026"` — date only | Relative format with time (see below) |
| Channel icon | None | Inline with badge |

### Badge strings — full inventory

| Type + Method | Badge string | Icon | Colour |
|---|---|---|---|
| outbound + email | "Outbound email" | ✉ | coral/orange tint |
| inbound + email | "Inbound email" | ✉ | green tint |
| outbound + phone | "Outbound call" | ☎ | coral/orange tint |
| inbound + phone | "Inbound call" | ☎ | green tint |
| outbound + sms | "Outbound SMS" | 💬 | coral/orange tint |
| inbound + sms | "Inbound SMS" | 💬 | green tint |
| outbound + voicemail | "Voicemail left" | 📱 | coral/orange tint |
| inbound + voicemail | "Voicemail received" | 📱 | green tint |
| outbound + whatsapp | "WhatsApp sent" | 💚 | green tint |
| inbound + whatsapp | "WhatsApp received" | 💚 | green tint |
| outbound + post | "Letter sent" | 📮 | slate tint |
| inbound + post | "Letter received" | 📮 | slate tint |
| internal_note | "Internal note" | 📝 | amber tint (unchanged) |
| automated | "System email" | ✉ | indigo tint (unchanged) |

Colour convention: outbound = coral/orange family; inbound = green family; internal = amber; automated = indigo. Matches existing dot colours in the timeline.

### Author pill treatment

- **Agent-authored** (director, negotiator): `[Ellis]` — plain, no role suffix
- **SP/admin-authored** (sales_progressor, admin): `[Ellis · SP]` — middle-dot separator, consistent with the `·` pattern used in timestamps throughout the app *(Q7: decided)*
- Agents don't need the SP/admin distinction — `· SP` conveys "logged by the SP team, not us"
- Both `sales_progressor` and `admin` roles get `· SP` suffix; the internal distinction is irrelevant to agents
- Pill background: uniform slate for all authors *(Q5: decided)*

### Timestamp format

```typescript
function formatTimestamp(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isThisYear = date.getFullYear() === now.getFullYear();
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Today, ${time}`;
  if (isThisYear) return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${time}`;
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${time}`;
}
```

`"Today, 14:32"` — `"19 May, 14:32"` — `"19 May 2026, 14:32"`

---

## 6. Schema Change — `createdByRole` on `outboundMessage`

### Decision

Store the author's role at the moment of logging on the `outboundMessage` record. Do not resolve it at render time via a join.

### Rationale

Comms are immutable historical records — they should preserve state at write time:
- A negotiator promoted to director after logging a comm: their old entries should still show the role they held at the time
- An SP/admin who moves on: the record remains accurate without any external dependency
- Avoids a user table join on every activity timeline render

### Migration

New field: `outboundMessage.createdByRole String?`

Set at write time in `logCommAction` from `session.user.role`.

**Backfill:** existing records resolve `createdById → user.role` at migration time. Values will match current role, not historical role — acceptable trade-off for records already in the system. Going forward the field is authoritative.

### Render logic

```typescript
function authorLabel(createdByName: string | null, createdByRole: string | null): string {
  const name = createdByName ? extractFirstName(createdByName) : "System";
  const isInternal = createdByRole === "sales_progressor" || createdByRole === "admin";
  return isInternal ? `${name} · SP` : name;
}
```

---

## 7. Specific Component Files That Change

| File | Change |
|------|--------|
| `components/activity/CommsEntry.tsx` | Full redesign — always-visible, channel-first, single panel, direction toggle, contact pills pre-surfaced |
| `components/activity/ActivityTimeline.tsx` | Comm card: new badge (pill weight, icon, combined string), contact pills, author pill with role suffix, timestamp with time |
| `lib/utils.ts` | Add `formatTimestamp(date)` — date + time, relative for today/this year |
| `lib/services/comms.ts` | `ActivityEntry` type: add `createdByRole: string \| null`; populate in `getActivityTimeline` query |
| `app/actions/comms.ts` | `logCommAction`: write `session.user.role` to `createdByRole` at save time |
| `prisma/schema.prisma` | Add `createdByRole String?` to `OutboundMessage` model |

**No schema changes. No server-action changes.** All changes are UI layer only.

---

## 8. Decisions Log

| # | Question | Decision |
|---|----------|----------|
| Q1 | Always-visible or expand-on-click? | **Always-visible** — speed gain is the point |
| Q2 | Default contact selection? | **None selected** — safer; smart-default post-V1 |
| Q3 | WhatsApp in primary row or overflow? | **Primary row** — Post moves to overflow |
| Q4 | Voicemail direction default? | **Outbound** ("voicemail left"); reassess with data |
| Q5 | Author pill colour? | **Uniform slate** — avatar-matched adds noise |
| Q6 | Remove step indicator? | **Yes** — no steps in single-panel design |
| Q7 | SP/admin author pill format? | **`[Ellis · SP]`** — both sales_progressor and admin; stored as `createdByRole` at write time |
| Q8 | Edit-in-place on cards? | **Defer** — V1 is delete-and-re-log only (see below) |

---

## 9. Explicit Out-of-Scope for V1

### Edit-in-place *(Q8: decided — defer)*

Agents make typos in comm logs. Two paths:

- **(a) V1: delete-and-re-log only** — the delete button (×) already exists on cards. Cheaper, simpler. Add edit later if it proves to be a real pain point.
- **(b) V1: edit-in-place** — own comms only, within a 24h window.

**Decision: (a).** Edit-in-place is explicitly deferred to a future pass. The V1 card does not include an edit affordance. This is a conscious scope decision, not a hidden assumption.

---

## 10. Implementation Sequencing

**Stage 2 does not begin until:**
1. Arc 2 v4 lands and is approved
2. Arc 2 Stage 2 implementation ships
3. Ellis walks Arc 2 on real files for a working session

When Stage 2 opens, order of work:

1. **Schema** — add `createdByRole String?` to `OutboundMessage`; migration + backfill; apply to staging first
2. **`logCommAction`** — write `session.user.role` to `createdByRole` at save time
3. **`lib/utils.ts`** — add `formatTimestamp`
4. **`ActivityTimeline.tsx`** — new card layout (badge pill, channel icons, contact pills, author pill with role suffix, timestamp with time)
5. **`CommsEntry.tsx`** — new entry panel (always-visible, channel-first, single panel, direction toggle, contact pills pre-surfaced)

Steps 3–4 (card changes) are independent of step 5 (entry flow) and can ship separately if useful.
