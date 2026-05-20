# Claim Flow Redesign — Stage 1 Design Proposal v2

**Status:** Awaiting Ellis review  
**Changes from v1:** R1–R5 revisions incorporated; Q1–Q6 decisions applied; Q6 confirmed (leave chain NOT implemented — microcopy line removed)  
**Stage 2 gate:** Ellis approves v2 → build polish-pass page → walk → cut to production

---

## Open Question Decisions Applied

| Q | Decision | Change in v2 |
|---|---|---|
| Q1 Trust numbers | Skip entirely | Trust cluster section removed |
| Q2 Decline → Next.js page | Convert | Noted in architecture section |
| Q3 Forgot password | mailto link for now | Wired into copy strings |
| Q4 Claim after decline | Allow — DECLINED reclaimable within expiry | `/claim` guards updated in copy; CTA on decline page retained |
| Q5 Chain visual cap | ≤ 4 show all; > 4 show originator + neighbours + yours + "and N more" | Applied in chain visual spec |
| Q6 Leave chain | **NOT implemented.** DELETE only removes unclaimed stubs. "You can leave any time" line deleted from confirm page. | Microcopy removed |

---

## 1. Visual Direction (unchanged from v1)

Stripe (typographic confidence + depth), Linear (restraint), Vercel (gradient hero + CSS motion). Warm cream `#FDF9F5` background, coral→amber hero gradient, editorial type hierarchy. Full rationale in v1.

---

## 2. Bug Fix — "Sarah Hartwell at an estate agency"

**Root cause:** `app/claim/page.tsx` — `createdBy.firmName` is null; fallback "an estate agency" is wrong.

**Fix:** Add `agency: { select: { name: true } }` to the chain query. Priority: `createdBy.firmName` → `chain.agency.name` → null. When null, sentence drops "at X" entirely: "Sarah Hartwell has linked your sale to theirs."

---

## 3. Revision 1 — Hero Chain Visualisation

Three alternatives proposed below. **Option C is recommended** with reasoning.

---

### Option A — Horizontal linked strip

```
┌──────────┐    ┌──────────┐    ┌────────────────┐
│ ① Garden │────│ ② Acme   │────│ ③ Pending      │
│ Road     │    │ Street   │    │                │
│ Hartwell │    │ YOUR SALE│    │ Awaiting claim │
└──────────┘    └──────────┘    └────────────────┘
                [coral border,
                 elevated]
```

Horizontal row of rounded cards connected by solid lines. Your card is coral-bordered and slightly taller. Connectors are `4px` lines with small chain-link icons mid-connector.

**Problem:** At mobile widths (375px), 3+ links require horizontal scroll. Inverted agents open on phone between viewings — horizontal scroll is hostile. Breaks at > 3 links without truncation logic that's complex to implement. The physical chain metaphor is literal but not more informative than vertical.

**Verdict:** Ruled out. Mobile failure is too significant for the primary use case.

---

### Option B — Stacked depth cards

```
    ┌─────────────────────────────┐   ← shadow-3, z:3 — YOUR SALE
    │  ② 12 Acme Street           │     coral border, elevated 8px
    │  Your sale · Claim to join  │
    └─────────────────────────────┘
   ┌─────────────────────────────┐    ← shadow-2, z:2 — originator
   │  ① 42 Garden Road           │     white, 4px below
   │  Hartwell Partners          │
   └─────────────────────────────┘
  ┌─────────────────────────────┐     ← shadow-1, z:1 — pending
  │  ③ Pending sale             │     white 60% opacity, 4px below
  └─────────────────────────────┘
```

Cards stacked with 4px Y-offsets and increasing shadow depth. Your card is on top, coral border, most prominent. Further cards recede behind — like physical papers on a desk. Communicates "layered live documents."

**Problem:** Depth creates visual ambiguity about order. Which card is "higher" in the chain? Visual elevation competes with positional meaning. At 4+ links, bottom cards become nearly invisible. Reading order is ambiguous on first encounter. The "live document" feel is present but the positional information (which is the actual value) gets obscured.

**Verdict:** Strong aesthetically but sacrifices clarity. Hold as a secondary treatment (could work for a post-claim summary card where order matters less).

---

### Option C — Editorial ladder (recommended)

```
┌──────────────────────────────────────────────────────┐
│  [coral card, white text, 16px padding]              │
│                                                      │
│  01                                                  │
│  [32px, 800, coral/white]                            │
│  42 Garden Road, Hartwell               Tracking ✓  │
│  Hartwell Partners                                   │
│                                                      │
│  ┆ [4px dashed vertical rule, white 30%]             │
│                                                      │
│  02  ← YOU                                           │
│  [32px, 800, white]  ←── full-width highlight row    │
│  ┌──────────────────────────────────────────────┐   │
│  │  12 Acme Street, Birmingham                  │   │
│  │  Your sale · Claim to join →                 │   │
│  └──────────────────────────────────────────────┘   │
│  [white-tinted inner card, coral ring, rounded-8]    │
│                                                      │
│  ┆                                                   │
│                                                      │
│  03                                                  │
│  Pending sale                         Invited       │
│  ——                                                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Detail spec:**
- Outer container: coral→amber gradient card (full hero treatment), rounded-16, 20px padding
- Position numbers: `32px`, `font-weight: 800`, all-caps white, left-aligned — these ARE the composition, not decorative labels
- Connector: `4px` dashed vertical rule, white at 30% opacity, 12px tall between rows — minimal but present
- Your row: inner white-tinted card `rgba(255,255,255,0.15)` with `2px solid rgba(255,255,255,0.6)` border — clearly "you are here" without needing a label
- Claimed rows: full text, "Tracking ✓" status in white at 80% opacity, right-aligned
- Pending rows: address shown if available, "Invited" or "Awaiting" status, slightly muted (white 60%)

**At ≤ 4 links:** All shown.  
**At > 4 links:** Show originator (01), immediate neighbour, your row (YOU), then "— and N more —" as a single row in the same editorial style, then the last link if adjacent to yours. Maximum visual rows: 5.

**Why this works:**
- Large position numbers give the chain strong visual hierarchy — you immediately know where you are
- Dashed connectors read as "live sequence" without being literal chain-link icons
- The inner highlighted card for "your row" is unambiguous on first scan — agents opening this on a phone between viewings can parse it in one second
- The editorial style extends the design language established by the headline — the chain IS the typography, not a separate graphic element
- Works at all chain lengths because each row is the same height; the "and N more" row degrades gracefully

---

## 4. Page-by-Page Design Proposal (v2)

---

### 4.1 `/claim` — The Landing Page

#### Desktop layout (1024px+)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  THE SALES PROGRESSOR            [coral, 13px, 700]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ← 56px, cream bg, 1px warm border-bottom

  [max-width: 560px, centred, padding: 48px 24px 64px]

  ┌──────────────────────────────────────────────────────┐
  │  [HERO CARD — coral→amber gradient, rounded-20]      │
  │  [padding: 28px 24px]                                │
  │                                                      │
  │  SARAH HARTWELL · HARTWELL PARTNERS                  │
  │  [11px, 700, uppercase, 0.12em tracking, white 75%]  │
  │                                                      │
  │  Your sale is part of                                │
  │  a live chain.                                       │
  │  [38px, 800, white, -0.02em, lh 1.1]                 │
  │                                                      │
  │  Sarah has linked 12 Acme Street to their            │
  │  file. Join to see where the chain stands.           │
  │  [15px, white 85%, lh 1.65]                          │
  │                                                      │
  │  [20px gap]                                          │
  │                                                      │
  │  [EDITORIAL CHAIN — Option C, inside hero card]      │
  │  01 · 42 Garden Road            Tracking ✓           │
  │  ┆                                                   │
  │  02 · 12 Acme Street  ← YOU  [inner highlight card]  │
  │  ┆                                                   │
  │  03 · Pending                   Invited              │
  │                                                      │
  └──────────────────────────────────────────────────────┘

  [16px gap]

  [CTA SECTION — no card border, clean]

  [CLAIM THIS SALE]
  [coral, 48px, full-width, rounded-12, 700, 15px]

  [12px gap]

  Free to join · 30 seconds · No card required
  [12px, muted, centred]

  [12px gap]

  Already have an account? Log in →
  [13px, secondary, centred]

  [24px gap]

  ─────────────────────────────────────────────

  [8px gap]

  This isn't my sale — decline invite
  [12px, muted, centred, no underline, 8px padding]

  [40px gap]

  Sales Progressor helps UK estate agents track every
  sale in a chain together — so no-one's chasing what
  someone else already knows.
  [13px, secondary, centred, lh 1.7]

  [8px gap]

  Questions? support@thesalesprogressor.co.uk
  [12px, muted, centred]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

#### Mobile layout — 375px (primary design)

```
┌─────────────────────────────────────────────┐ 375px
│ THE SALES PROGRESSOR           [coral, 13px] │ 48px header
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐  │ 16px h-margin
│  │ [HERO CARD — full-width, rounded-16]  │  │
│  │ padding: 24px 20px                    │  │
│  │                                       │  │
│  │ SARAH HARTWELL · HARTWELL PARTNERS    │  │ 10px, caps, tracked
│  │                                       │  │
│  │ Your sale is part of                  │  │
│  │ a live chain.                         │  │ 28px, 800, white
│  │                                       │  │
│  │ Sarah has linked 12 Acme Street to    │  │
│  │ their file. Join to see where the     │  │ 14px, white 85%
│  │ chain stands.                         │  │
│  │                                       │  │
│  │ ─────────── chain ────────────────    │  │ hairline, white 20%
│  │                                       │  │
│  │ 01 42 Garden Road      Tracking ✓     │  │
│  │  ┆                                    │  │
│  │ 02 12 Acme Street                     │  │ ← YOU inner card
│  │  ┌──────────────────────────────┐     │  │
│  │  │ 12 Acme Street, B'ham        │     │  │ rgba white bg
│  │  │ Your sale · Claim to join →  │     │  │
│  │  └──────────────────────────────┘     │  │
│  │  ┆                                    │  │
│  │ 03 Pending              Invited       │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  CLAIM THIS SALE                      │  │ 52px, coral, full-w
│  └───────────────────────────────────────┘  │
│                                             │
│  Free to join · 30 seconds · No card        │ 11px, muted, centred
│                                             │
│  Already have an account? Log in →          │ 13px, centred
│                                             │
│  ─────────────────────────────────────────  │ hairline divider
│                                             │
│  This isn't my sale — decline invite        │ 12px, muted, centred
│                                             │
│  [32px gap]                                 │
│                                             │
│  Sales Progressor helps UK estate agents    │
│  track every sale in a chain together —     │ 13px, secondary
│  so no-one's chasing what someone else      │
│  already knows.                             │
│                                             │
│  Questions? support@...                     │ 12px, muted
│                                             │
└─────────────────────────────────────────────┘
```

**Mobile-specific behaviour:**
- Hero card: 16px horizontal margins (not full bleed — the rounded corners on cream bg look deliberate, not cramped)
- Chain visual: max 4 rows without scrolling; "> 4" collapses to originator + yours + "and N more" at single-row height
- CTA button: 52px touch target (up from 48px desktop)
- Decline link: `min-height: 44px` tap target even though font is 12px
- No sticky elements on `/claim` — it's short enough

---

#### State variants (mobile + desktop)

**State B — email matches existing account:**
CTA text: "Log in to claim this sale" → `/claim/login`  
Secondary link: "New to Sales Progressor? Create account"

**State C — already logged in:**
CTA text: "Claim this sale" → `/claim/confirm`  
Secondary link removed entirely

**State D — token expired:**
Full-page centred, cream bg, no hero card:
```
THE SALES PROGRESSOR [coral, 13px]

[32px coral dot — visual pause]

This invite has expired.
[28px, 800]

The link was valid for 7 days after it was sent.
Ask {originatorName} to resend it.
[14px, secondary, lh 1.7]

Questions? support@thesalesprogressor.co.uk
[12px, muted]
```

**State E — already claimed:**
```
This sale is already claimed.
[14px, secondary]
If you think this is a mistake, contact support.
```

**State F — already declined:**
```
You've declined this invite.
Changed your mind? Ask {originatorName} to send a fresh link.
```

---

### 4.2 `/claim/signup` — New Account

#### Desktop layout

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  THE SALES PROGRESSOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [max-width: 860px, centred, two-column on desktop]

  ┌──────────────────────┐   ┌─────────────────────────┐
  │                      │   │                         │
  │  Create your         │   │ [CHAIN PREVIEW PANEL]   │
  │  account.            │   │ [coral→amber gradient,  │
  │  [28px, 800]         │   │  rounded-16, h-fill]    │
  │                      │   │                         │
  │  You'll land inside  │   │  Joining                │
  │  the chain the       │   │  [11px, caps, white 75%]│
  │  moment you're in.   │   │                         │
  │  [15px, secondary]   │   │  12 Acme Street         │
  │                      │   │  Birmingham             │
  │  [20px gap]          │   │  [18px, 700, white]     │
  │                      │   │                         │
  │  ┌────────────────┐  │   │  ─────────────          │
  │  │ FORM CARD      │  │   │                         │
  │  │                │  │   │  01 · 42 Garden Rd  ✓  │
  │  │ Your name      │  │   │  ┆                      │
  │  │ [__________]   │  │   │  02 · 12 Acme St  YOU  │
  │  │                │  │   │  [inner highlight card] │
  │  │ Agency name    │  │   │                         │
  │  │ [__________]   │  │   │  Hartwell Partners      │
  │  │                │  │   │  invited you            │
  │  │ Work email     │  │   │  [12px, white 75%]      │
  │  │ [pre-filled]   │  │   │                         │
  │  │                │  │   └─────────────────────────┘
  │  │ Password       │  │
  │  │ [__________]   │  │
  │  │                │  │
  │  │ [CREATE ACCT]  │  │
  │  │ [coral, full-w]│  │
  │  │                │  │
  │  │ By creating an │  │
  │  │ account you    │  │
  │  │ agree to our   │  │
  │  │ Terms of Svc.  │  │
  │  └────────────────┘  │
  │                      │
  │  Free · No card      │
  │  required            │
  │  [12px, muted]       │
  │                      │
  │  Already have an     │
  │  account? Log in →   │
  │  [13px, secondary]   │
  │                      │
  └──────────────────────┘
```

**Column proportions:** Form: 55%, chain panel: 40%, gap: 5%. On screens < 768px: single column (chain panel moves above form as a compact horizontal strip).

---

#### Mobile layout — 375px

```
┌─────────────────────────────────────────────┐
│ THE SALES PROGRESSOR                        │ header
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  [CHAIN CONTEXT STRIP — coral grad,   │  │
│  │   compact, 72px tall]                 │  │
│  │                                       │  │
│  │  ← Back   Joining: 12 Acme Street     │  │
│  │           Hartwell Partners' chain    │  │ 11px, white
│  └───────────────────────────────────────┘  │
│                                             │
│  Create your account.        [28px, 800]    │ 16px h-pad
│                                             │
│  You'll land inside the chain               │
│  the moment you're in.        [14px, sec]   │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ FORM CARD (white, shadow-sm)          │  │
│  │                                       │  │
│  │ Your name                             │  │
│  │ [_________________________________]   │  │
│  │                                       │  │
│  │ Agency name                           │  │
│  │ [_________________________________]   │  │
│  │                                       │  │
│  │ Work email                            │  │
│  │ [pre-filled, editable]                │  │
│  │                                       │  │
│  │ Password              [show/hide ◉]   │  │
│  │ [_________________________________]   │  │
│  │                                       │  │
│  │ [CREATE ACCOUNT — coral, 52px]        │  │
│  │                                       │  │
│  │ By creating an account you agree to   │  │
│  │ our Terms of Service.  [11px, muted]  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Free · No card required    [12px, muted]   │
│                                             │
│  Already have an account? Log in →          │
│                                             │
└─────────────────────────────────────────────┘
```

**Mobile keyboard behaviour:**
- Context strip: `position: sticky; top: 0` — stays visible as the agent scrolls to fill the form. This is the anchor — they always know what they're signing up for.
- Form card inputs: `font-size: 16px` minimum to prevent iOS auto-zoom.
- CTA button: visible above keyboard when password field is focused (ensured by `ScrollIntoView` on the active input — no JS complexity, native browser handles this with `focus` events on 16px inputs).

---

### 4.3 `/claim/login` — Existing Account

#### Desktop layout

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  THE SALES PROGRESSOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [max-width: 440px, centred, single column]
  [padding: 48px 24px 64px]

  [CONTEXT STRIP — compact coral gradient, full-width]
  ┌──────────────────────────────────────────────────┐
  │ ← Back    Logging in to claim:                   │
  │           12 Acme Street, Birmingham             │
  └──────────────────────────────────────────────────┘
  [56px tall, rounded-12, 16px h-padding]

  [20px gap]

  Welcome back.
  [28px, 800]

  Log in to claim your position in this chain.
  [15px, secondary, lh 1.6]

  [20px gap]

  ┌────────────────────────────────────────────────┐
  │ FORM CARD                                      │
  │                                                │
  │ Email                                          │
  │ [pre-filled from stub, editable]               │
  │                                                │
  │ Password                      [show/hide ◉]   │
  │ [________________________________]             │
  │                                                │
  │ [LOG IN AND CLAIM — coral, 48px, full-width]   │
  │                                                │
  │ Forgot your password?                          │
  │ Email support@thesalesprogressor.co.uk         │
  │ [12px, muted, no link styling — plain text]    │
  └────────────────────────────────────────────────┘

  [16px gap]

  New to Sales Progressor? Create account →
  [13px, secondary, centred]
```

---

#### Mobile layout — 375px

```
┌─────────────────────────────────────────────┐
│ THE SALES PROGRESSOR                        │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ [CONTEXT STRIP — coral gradient]      │  │
│  │ ← Back    Logging in to claim:        │  │
│  │           12 Acme Street              │  │ sticky top:0
│  └───────────────────────────────────────┘  │
│                                             │
│  Welcome back.              [28px, 800]     │
│                                             │
│  Log in to claim your position in this      │
│  chain.                     [14px, sec]     │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Email                                 │  │
│  │ [pre-filled, editable]                │  │
│  │                                       │  │
│  │ Password              [show/hide ◉]   │  │
│  │ [_________________________________]   │  │
│  │                                       │  │
│  │ [LOG IN AND CLAIM — coral, 52px]      │  │
│  │                                       │  │
│  │ Forgot your password? Email           │  │
│  │ support@thesalesprogressor.co.uk      │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  New to Sales Progressor? Create account →  │
│                                             │
└─────────────────────────────────────────────┘
```

**Mobile notes:**
- Context strip sticky: same pattern as signup. Agent always knows which sale they're logging in to claim.
- Two fields only — email + password. Minimum possible friction.
- Forgot password: plain prose, no link element. Removes tap-target ambiguity on mobile, and honestly signals "this is a support action, not a forgot-password flow."

---

### 4.4 `/claim/confirm` — Commitment

#### Desktop layout (clean state)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  THE SALES PROGRESSOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [max-width: 480px, centred, padding: 48px 24px]

  You're joining the chain.
  [32px, 800, centred]

  [8px gap]

  12 Acme Street will link to Hartwell Partners' sale.
  [15px, secondary, centred, lh 1.6]

  [24px gap]

  ┌────────────────────────────────────────────────┐
  │  [SUMMARY CARD — 3px coral left border]        │
  │  [white, rounded-12, 20px padding]             │
  │                                                │
  │  Your sale     12 Acme Street, Birmingham      │
  │  Chain         Hartwell Partners · 2 links     │
  │  Your position  #2 of 2                        │
  │  Logged in as   agent@acme.co.uk               │
  │                                                │
  │  [rows: 12px label muted, 14px value primary,  │
  │   two-column, 8px row gap]                     │
  └────────────────────────────────────────────────┘

  [20px gap]

  [CONFIRM AND JOIN — coral, 48px, full-width]

  [12px gap]

  Logged in as the wrong account?
  Log out and try again →
  [12px, muted, centred]
```

#### Desktop layout (duplicate state)

```
  We found a matching file.
  [28px, 800, centred]

  You already have a file for 12 Acme Street. Link it
  to the chain, or start fresh — both work.
  [15px, secondary, centred]

  [24px gap]

  ┌────────────────────────────────────────────────┐
  │  ◉  Link my existing file                      │
  │     12 Acme Street · Created 14 May 2026       │
  │                                                │
  │  ○  Create a new file for this chain           │
  │     Your existing file stays separate          │
  └────────────────────────────────────────────────┘
  [white card, rounded-12, radio-as-card rows,
   selected row gets coral left border + light bg]

  [CONTINUE — coral, 48px, full-width]
```

---

#### Mobile layout — 375px (clean state)

```
┌─────────────────────────────────────────────┐
│ THE SALES PROGRESSOR                        │
├─────────────────────────────────────────────┤
│                                             │
│  You're joining the chain.   [28px, 800]    │ centred
│                                             │
│  12 Acme Street will link to Hartwell       │
│  Partners' sale.             [14px, sec]    │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  [SUMMARY CARD — coral left border]   │  │
│  │                                       │  │
│  │  Your sale                            │  │
│  │  12 Acme Street, Birmingham           │  │
│  │                                       │  │
│  │  Chain                                │  │
│  │  Hartwell Partners · 2 links          │  │
│  │                                       │  │
│  │  Your position                        │  │
│  │  #2 of 2                              │  │
│  │                                       │  │
│  │  Logged in as                         │  │
│  │  agent@acme.co.uk                     │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  [CONFIRM AND JOIN — coral, 52px]           │
│                                             │
│  Logged in as the wrong account?            │ 12px, muted
│  Log out and try again →                    │
│                                             │
└─────────────────────────────────────────────┘
```

**Note:** "You can leave the chain at any time" **removed** — this functionality is not implemented.

**Wrong account state:**

```
  Wrong account.
  [28px, 800]

  This invite was sent to stubEmail. You're logged
  in as sessionEmail.
  [14px, secondary]

  Ask {originatorName} to resend the invite to your
  account, or log out and try a different one.
  [14px, secondary]

  [LOG OUT AND TRY AGAIN — cream/border button]
  [CANCEL — text link, muted]
```

---

### 4.5 `/claim/decline` — Graceful Exit (v2)

**Architecture note:** Convert from `app/claim/decline/route.ts` (raw GET → inline HTML) to `app/claim/decline/page.tsx` (Next.js page). The token is in `searchParams`. This gives full React component access and eliminates the inline-HTML constraint. Route file removed; decline action on `/claim` already links to `?token=…` so URL stays identical.

#### Visual treatment — "soft coral breath"

The decline page gets a background composition that's present but quiet: cream base with a single soft coral radial bloom, `opacity: 0.12`, centred behind the content. Not the full hero gradient — that would feel incongruous on an exit page. Just enough warmth to signal "this is still the same product" without being assertive.

```
┌─────────────────────────────────────────────┐
│ THE SALES PROGRESSOR                        │
├─────────────────────────────────────────────┤
│                                             │
│         [radial coral bloom, opacity 0.12]  │
│                                             │
│         [coral ring, 48px, centred]         │
│          ┌────────────────┐                 │
│          │  ●  [coral]    │                 │ 48×48 circle,
│          └────────────────┘                 │ 1.5px border coral,
│                                             │ coral fill 10%
│       All noted.         [36px, 800]        │ centred
│                                             │
│   We've let them know this isn't your       │ max-w: 320px
│   sale. Estate agencies are busy —          │ centred
│   thanks for letting us know.               │ 16px, secondary
│                                             │
│   [24px gap]                                │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  [NUDGE CARD — warm cream, soft       │  │
│  │   border rgba(255,107,74,0.2)]        │  │
│  │                                       │  │
│  │  Changed your mind? This link is      │  │
│  │  valid until 26 May 2026.             │  │
│  │                                       │  │ 13px, secondary
│  │  [CLAIM AFTER ALL — ghost button,     │  │
│  │   coral border, coral text, 44px]     │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  [40px gap]                                 │
│                                             │
│  What is The Sales Progressor?              │ 12px, muted, centred
│  Estate agents use it to track every sale   │
│  in a chain together — so everyone knows    │
│  where the hold-up is before they pick      │
│  up the phone.                              │
│                                             │
│  Questions?                                 │
│  support@thesalesprogressor.co.uk           │ 12px, muted, centred
│                                             │
└─────────────────────────────────────────────┘
```

**Mobile (375px) — identical to above.** The decline page is intentionally short — no scroll required. The layout doesn't change at mobile width beyond horizontal padding (16px).

**Edge states:**

```
Expired token:
  H1: This invite has expired.
  Body: The link was valid for 7 days.
        No action needed — we haven't notified anyone.
  [No nudge card — link is expired, can't claim]

Already declined (second load):
  H1: Already noted.
  Body: We already let them know. Nothing more needed from you.

Already claimed:
  H1: This sale has been claimed.
  Body: No need to decline — someone has already joined.
```

**"Claim after all" behaviour (Q4 applied):** When an agent clicks "Claim after all," the link target is `/claim?token=…`. The `/claim` route must permit `inviteStatus = "DECLINED"` as a claimable state (not just SENT). This requires a one-line change to the guard in `app/claim/page.tsx`: remove DECLINED from the early-exit check, and allow the flow to proceed normally. The claim action itself (`app/api/claim/route.ts`) must similarly accept DECLINED status. **This is a code change for Stage 2, noted here.**

---

## 5. Component Inventory (v2)

| Component | Description | New / Updated |
|---|---|---|
| `ClaimShell` | Shared wrapper: cream bg, wordmark header, max-width, radial bloom (opacity param) | New |
| `ClaimHeroCard` | Coral→amber gradient card. Accepts: eyebrow, headline, sub, children slot | New |
| `ClaimChainVisual` | Editorial ladder — position numbers, dashed connectors, inner highlight card for "you are here". Cap logic (≤4 / >4) built in | New |
| `ClaimContextStrip` | Sticky compact coral gradient strip with back link + chain context. Props: address, chainName | New |
| `ClaimSummaryCard` | Coral left-border card. Accepts rows as `{label, value}[]` | New |
| `ClaimDuplicatePicker` | Radio-as-card chooser for duplicate state | New (replaces part of ClaimConfirmForm) |
| `ClaimDeclineExit` | Decline page body: coral ring, headline, nudge card, about text | New |
| `claim-flow.css` | Stylesheet: `--claim-*` tokens, gradient keyframes, context strip sticky utility, bloom utility | New |
| `ClaimSignupForm` | Keep logic entirely. Restyle only: inputs, button, terms text | Updated |
| `ClaimLoginForm` | Keep logic entirely. Restyle only | Updated |
| `ClaimConfirmForm` | Keep logic. Restyle + extract duplicate picker into its own component | Updated |

---

## 6. Copy Strings (v2)

### `/claim`

| Element | Copy |
|---|---|
| Wordmark | THE SALES PROGRESSOR |
| Hero eyebrow | `{originatorName} · {originatorAgency}` — drops "· agency" if null |
| H1 | Your sale is part of a live chain. |
| Sub | `{originatorName}` has linked `{stubAddress}` to their file. Join to see where the chain stands. |
| Chain — your row label | Your sale |
| Chain — your row sub | Claim to join |
| Chain — claimed row | Tracking ✓ |
| Chain — pending row | Invited / Pending |
| Chain — "and N more" | — and {N} more — |
| CTA (new user) | Claim this sale |
| CTA (known email) | Log in to claim this sale |
| CTA (logged in) | Claim this sale |
| Microcopy | Free to join · 30 seconds · No card required |
| Secondary link (new user) | Already have an account? Log in |
| Secondary link (known email) | New to Sales Progressor? Create account |
| Decline link | This isn't my sale — decline invite |
| About | Sales Progressor helps UK estate agents track every sale in a chain together — so no-one's chasing what someone else already knows. |
| Support | Questions? support@thesalesprogressor.co.uk |

Error states:

| State | H1 | Body |
|---|---|---|
| No token | Invalid link | This link is invalid or has expired. |
| Expired | This invite has expired. | The link was valid for 7 days after it was sent. Ask `{originatorName}` to resend it. |
| Claimed | This sale is already claimed. | If you think this is a mistake, contact support. |
| Declined | You've declined this invite. | Changed your mind? Ask `{originatorName}` to send a fresh link. |

---

### `/claim/signup`

| Element | Copy |
|---|---|
| Context strip | Joining: `{stubAddress}` · `{chainName}`'s chain |
| Back link | ← Back to invite |
| H1 | Create your account. |
| Sub | You'll land inside the chain the moment you're in. |
| Name label | Your name |
| Agency label | Agency name |
| Email label | Work email |
| Password label | Password |
| CTA | Create account |
| Terms | By creating an account you agree to our Terms of Service. |
| Bottom link | Already have an account? Log in |
| Microcopy | Free · No card required |
| Chain panel heading | Joining |
| Chain panel invite line | `{originatorName}` invited you |

---

### `/claim/login`

| Element | Copy |
|---|---|
| Context strip | Logging in to claim: `{stubAddress}` |
| Back link | ← Back to invite |
| H1 | Welcome back. |
| Sub | Log in to claim your position in this chain. |
| Email label | Email |
| Password label | Password |
| CTA | Log in and claim |
| Forgot password | Forgot your password? Email support@thesalesprogressor.co.uk |
| Bottom link | New to Sales Progressor? Create account |

---

### `/claim/confirm`

| Element | Copy (clean) |
|---|---|
| H1 | You're joining the chain. |
| Sub | `{stubAddress}` will link to `{originatorAgency}`'s sale. |
| Summary: your sale | `{stubAddress}` |
| Summary: chain | `{originatorAgency}` · `{N}` links |
| Summary: position | #`{n}` of `{N}` |
| Summary: logged in | `{sessionEmail}` |
| CTA | Confirm and join |
| Wrong account | Logged in as the wrong account? Log out and try again → |

| Element | Copy (duplicate) |
|---|---|
| H1 | We found a matching file. |
| Sub | You already have a file for `{stubAddress}`. Link it to the chain, or start fresh — both work. |
| Option A | Link my existing file |
| Option A sub | `{propertyAddress}` · Created `{date}` |
| Option B | Create a new file for this chain |
| Option B sub | Your existing file stays separate |
| CTA | Continue |

| Element | Copy (wrong account) |
|---|---|
| H1 | Wrong account. |
| Body | This invite was sent to `{stubEmail}`. You're logged in as `{sessionEmail}`. Ask `{originatorName}` to resend the invite to your account, or log out and try a different one. |
| Primary action | Log out and try again |
| Secondary | Cancel |

---

### `/claim/decline`

| Element | Copy |
|---|---|
| H1 | All noted. |
| Body | We've let them know this isn't your sale. Estate agencies are busy — thanks for letting us know. |
| Nudge card | Changed your mind? This link is valid until `{expiryDate}`. |
| Ghost CTA | Claim after all |
| About | What is The Sales Progressor? Estate agents use it to track every sale in a chain together — so everyone knows where the hold-up is before they pick up the phone. |
| Support | Questions? support@thesalesprogressor.co.uk |

Edge states:

| State | H1 | Body |
|---|---|---|
| Expired | This invite has expired. | The link was valid for 7 days. No action needed — we haven't notified anyone. |
| Already declined | Already noted. | We already let them know. Nothing more needed from you. |
| Already claimed | This sale has been claimed. | No need to decline — someone has already joined. |

---

## 7. Animation and Motion (unchanged from v1 — approved)

All CSS `@keyframes`. No JS on initial paint.

| Element | Animation | Duration |
|---|---|---|
| Page enter | `opacity 0→1`, `translateY 8px→0` | 200ms ease-out |
| Hero card | Same, 40ms delay | 240ms |
| Chain link rows | `opacity 0→1`, `translateY 4px→0`, 60ms stagger per row | 180ms |
| CTA button hover | `translateY -1px`, shadow deepen | 120ms |
| CTA button active | `translateY 0` | 80ms |
| Context strip | Fade with page | — |
| Form card | `opacity 0→1`, 80ms delay | 200ms |
| Decline coral ring | `opacity 0→1`, `scale 0.6→1.0` | 300ms ease-out-back |
| Coral radial bloom | Painted on load — no animation | — |

---

## 8. Stage 2 Code Notes

Items requiring code changes beyond visual restyling:

1. **Q4 — Allow claim from DECLINED status:** Remove `inviteStatus === "DECLINED"` from the early-exit guard in `app/claim/page.tsx`. Also allow in `app/api/claim/route.ts` if it checks status there.
2. **Q2 — Convert decline route to Next.js page:** Delete `app/claim/decline/route.ts`. Create `app/claim/decline/page.tsx`.
3. **Agency name bug:** Add `agency: { select: { name: true } }` to chain query in `app/claim/page.tsx` and update interpolation logic.
4. **inviteTokenExpiresAt on decline page:** The new page needs to fetch `inviteTokenExpiresAt` from the link to populate the nudge card copy.
