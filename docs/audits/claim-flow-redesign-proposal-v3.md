# Claim Flow Redesign — Stage 1 Design Proposal v3

**Status:** Awaiting Ellis review  
**Scope of this document:** Two targeted revisions to v2. Everything else in v2 stands unchanged.  
**Supersedes:** Section 3 / R1 chain visual in v2; Section 4.5 decline page coral ring in v2

---

## Change 1 — Hybrid Chain Visual

**Brief:** Option C's editorial structure (position numbers as anchors, no ordering ambiguity) + Option B's depth/shadow aesthetic (cards as physical objects, sense of documents on a desk). Legibility from C, memorability from B.

### Design logic

The depth illusion in Option B broke down when all cards had equal elevation — you couldn't tell which was "above" which in the chain. The fix: don't use depth to represent position. Use the Option C number system to represent position, and use depth to represent *presence* — specifically, your card's presence relative to others.

The metaphor becomes: **papers resting on a desk in order**. Your sale — the one the agent is being invited to claim — sits on top, most prominent, casting the most shadow. The originator's card rests beneath it. Pending sales are flat at the bottom, almost part of the desk.

Position (sequence in the chain) is read through the left-margin numbers.  
Importance (why this matters to you) is read through the elevation hierarchy.  
These two axes never compete.

---

### Full hybrid spec

**Container:** coral→amber gradient card, rounded-20, 20px padding. Same as v2.

**Left gutter:** 36px wide. Position numbers live here, vertically centred against their card. `24px`, `800`, white, right-aligned into the gutter. Numbers are outside the card — they don't move when cards shift depth.

**Card spec per row:**

| Card type | Elevation | Box-shadow | X-shift | Scale |
|---|---|---|---|---|
| Your card (YOU) | Highest | `0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10)` | `0px` | `1.00` |
| Originator / claimed | Mid | `0 4px 12px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.07)` | `3px` | `0.99` |
| Pending / invited | Flat | `0 2px 4px rgba(0,0,0,0.06)` | `5px` | `0.98` |

The X-shift is the key depth cue: cards that are "lower" in the physical stack sit slightly to the right (as if pushed back). Your card is perfectly centred; others recede. The effect is subtle — 3–5px — but readable.

**Connector between cards:** 12px vertical segment, centred between the bottom of card N and top of card N+1. Not a dashed line — a small chain of two `6px` hollow circles `○─○` in white at 40% opacity. Tight, iconic, unambiguous as a connector without being a literal chain icon.

---

### ASCII sketch — 3-link chain, agent is #2

```
┌──────────────────────────────────────────────────────┐
│  [coral→amber gradient hero card, rounded-20]        │
│                                                      │
│  SARAH HARTWELL · HARTWELL PARTNERS   [11px eyebrow] │
│                                                      │
│  Your sale is part of                                │
│  a live chain.              [38px, 800, white]       │
│                                                      │
│  Sarah has linked 12 Acme Street to their file.      │
│  Join to see where the chain stands.  [15px, w85%]   │
│                                                      │
│  ────────────────────────────── [hairline, w20%]     │
│                                                      │
│  [gutter]  [card body — right edge flush with hero]  │
│                                                      │
│  01  ┌──────────────────────────────────────────┐    │
│      │  42 Garden Road, Hartwell        ✓       │    │← flat, x+3px
│      │  Hartwell Partners            Tracking   │    │  shadow-sm
│      └──────────────────────────────────────────┘    │
│                                                      │
│       ○                                              │
│       │  [connector: two circles + line, w40%]       │
│       ○                                              │
│                                                      │
│  02  ┌──────────────────────────────────────────┐    │
│      │  12 Acme Street, Birmingham          YOU │    │← elevated,
│      │  ┌────────────────────────────────────┐  │    │  x+0px,
│      │  │  Your sale · Claim to join →       │  │    │  shadow-lg,
│      │  └────────────────────────────────────┘  │    │  2px white
│      │  [inner card: white 15%, white 2px border]│   │  border +
│      └──────────────────────────────────────────┘    │  coral ring
│                                                      │
│       ○                                              │
│       │                                              │
│       ○                                              │
│                                                      │
│  03  ┌──────────────────────────────────────────┐    │
│      │  Pending sale                  Invited   │    │← flattest,
│      │  ——                                      │    │  x+5px,
│      └──────────────────────────────────────────┘    │  shadow-xs,
│                                                      │  opacity 75%
└──────────────────────────────────────────────────────┘
```

**Your card detail (position 02):**
- Outer card: white `rgba(255,255,255,0.18)` bg, `2px solid rgba(255,255,255,0.5)` border, `shadow-lg` — this is the most substantial surface on the page
- Inner highlight card: white `rgba(255,255,255,0.20)` bg, `1px solid rgba(255,255,255,0.40)` border, `8px` border-radius, `8px 12px` padding — "you are here" nest
- YOU label: `10px`, `700`, white, `right-aligned` inside outer card
- Arrow `→` in inner card: white, 85% opacity — action affordance without a button

**Originator card detail (claimed, position 01):**
- Card: white `rgba(255,255,255,0.14)` bg, `1px solid rgba(255,255,255,0.25)` border
- Status `✓ Tracking`: right-aligned, `11px`, `700`, white 75%
- Rendered at `transform: translateX(3px)` — slightly receded

**Pending card detail (position 03):**
- Card: white `rgba(255,255,255,0.09)` bg, `1px solid rgba(255,255,255,0.15)` border
- `opacity: 0.75` on entire card — visually "not here yet"
- Rendered at `transform: translateX(5px)`

---

### Mobile rendering — 375px

The depth treatment survives at mobile widths because:
- The X-shift (3–5px) is proportional and invisible at a glance — it reads as "slightly different" not "misaligned"
- Shadow differentials are the primary depth signal on small screens where pixel shifts are marginal
- The left gutter narrows to 28px; numbers drop to `20px`; inner card text drops to `13px`
- Connector circles shrink to `5px`

The "and N more" row at > 4 links:
```
  ··  ┌──────────────────────────────────────────┐
      │  — and 2 more —                          │
      └──────────────────────────────────────────┘
```
Rendered with opacity 0.5, no shadow, no X-shift. It's a ghost row — present but clearly not a real card. Positioned between the last shown card and the next real card.

---

### Why this is stronger than Option C alone

Option C's ladder is legible. This hybrid is legible *and* tactile. The shadow differentials make your card feel selected — like a file you're about to pick up. The originator's card receding slightly reinforces: "they started this, you're being invited into it." The pending card's flatness communicates uncertainty without a status label doing the work.

The typography (numbers, address, status) handles the information. The depth handles the feeling. Neither competes with the other.

---

## Change 2 — Decline Page: Coral Ring Removed

**Ellis's question:** Is the `48px` coral ring above the H1 (a) a logo variant, (b) an icon, or (c) a decorative shape?

**Answer:** (c) — it was a decorative shape. It has no semantic meaning. It is removed.

**Reasoning:** A circle with no content isn't a visual pause — it's a question mark. It draws the eye and then delivers nothing. On a page that's already visually composed (wordmark in the header, soft coral radial bloom in the background, large H1, warm body copy), adding a decorative circle above the H1 creates a third focal point that fragments attention instead of directing it.

The radial bloom does the atmospheric work. The H1 "All noted." does the emotional work. The circle was a hedge — a feeling that the page needed something between the header and the headline. It doesn't. The whitespace between them is the breath.

**Revised decline page top section:**

```
┌─────────────────────────────────────────────┐
│ THE SALES PROGRESSOR              [header]  │
├─────────────────────────────────────────────┤
│                                             │
│     [coral radial bloom, opacity 0.12,      │
│      centred, 400px diameter — atmosphere]  │
│                                             │
│     [48px of intentional whitespace]        │
│                                             │
│         All noted.         [36px, 800]      │  ← H1 is the
│                                             │     first mark
│  We've let them know this isn't your sale.  │
│  Estate agencies are busy — thanks for      │
│  letting us know.      [16px, secondary]    │
│                                             │
│  [continues as v2...]                       │
└─────────────────────────────────────────────┘
```

The bloom sits behind everything at `position: absolute` — it affects the atmosphere of the page but is never a foreground element. The H1 lands on a warm cream surface, not on top of a shape that demands attention first.

---

## Summary of v3 Changes

| Section | v2 | v3 |
|---|---|---|
| Chain visual | Option C: editorial ladder, flat cards | Hybrid: editorial ladder + depth/shadow. Your card elevated, others recede with X-shift |
| Decline page top | Coral ring (48px circle, decorative) | Removed. Radial bloom + whitespace + H1 only |

Everything else in v2 stands. This document + v2 = complete Stage 1 spec.
