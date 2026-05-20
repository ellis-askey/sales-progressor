# Claim Flow Redesign — Stage 1 Design Proposal

**Status:** Awaiting Ellis review  
**Scope:** `/claim`, `/claim/signup`, `/claim/login`, `/claim/confirm`, `/claim/decline`  
**Stage 2:** Polish-pass test page at `/agent/polish/claim-flow` after approval

---

## 1. Visual Direction

### Design language statement

These pages sit at the edge of the product — they're the first thing an invited agent sees, before they have any context for what The Sales Progressor is. The design needs to do three things simultaneously: signal quality, communicate value, and remove friction. The current pages do none of those things at brand level.

The direction is: **editorial confidence over SaaS utility**. Warm background, large deliberate type, one strong visual moment per page, generous whitespace. Marketing-page energy applied to a transactional flow.

### Reference 1 — Stripe.com/payments
`https://stripe.com/payments`

What we're borrowing:
- The relationship between headline size and page width. Stripe uses type as a layout element — the H1 isn't inside a card, it *is* the hero. We'll do the same: `/claim` headline runs edge-to-near-edge at 36–40px on desktop.
- The background gradient treatment — Stripe's pages use subtle radial gradients against off-white to create depth without a photo. We'll use a warm cream base (`#FDF9F5`) with a coral radial bloom behind the hero card.
- Visual layering: the chain visualisation card floats with a shadow over the gradient field, creating the sense of a live document rather than a form.

### Reference 2 — Linear.app
`https://linear.app/`

What we're borrowing:
- Restraint. Linear puts one strong thing per section and surrounds it with space. The claim landing page could easily become a checklist of benefits — we won't let it. One headline, one chain visual, one CTA, one trust cluster. That's it.
- The `eyebrow → headline → subheadline` typographic stack. Linear's eyebrow labels (small caps, tracked, muted) add context without weight. We use the same pattern for the inviting agent's name.
- Horizontal rule / hairline dividers as section transitions rather than card borders.

### Reference 3 — Vercel.com
`https://vercel.com/`

What we're borrowing:
- The gradient hero card. Vercel uses a dark gradient container with white text to create a "stage" effect. We invert this: coral-to-amber gradient background, white type — this becomes the `/claim` landing hero panel.
- The trust number cluster (Vercel: "1M+ projects deployed"). We'll use a minimal version: two or three numbers that answer the agent's unspoken question: "is this a real product?"
- Motion feel: Vercel's animations are instant-feeling, CSS-based, no JS required on first paint. Every animation we write will be `@keyframes` + `animation` — no JS transition orchestration.

### Palette

| Role | Value | Notes |
|---|---|---|
| Page background | `#FDF9F5` | Warm cream — never pure white |
| Hero gradient start | `#FF6B4A` | Coral |
| Hero gradient end | `#FFB347` | Warm amber |
| Text primary | `#1a1d29` | Near-black navy |
| Text secondary | `#4a5162` | Slate |
| Text muted | `#8b91a3` | Grey |
| Border | `rgba(26,29,41,0.08)` | Warm-tinted, never cold grey |
| Card surface | `#FFFFFF` | White cards on cream background |
| CTA button | `#FF6B4A` | Coral, full-width, 48px tall |

---

## 2. Bug Fix — "Sarah Hartwell at an estate agency"

**Root cause:** `app/claim/page.tsx` line 95:
```tsx
const originatorAgency = link.chain.createdBy?.firmName ?? "an estate agency";
```
`firmName` is a field on `User`, not on `Agency`. It's null for users who didn't set it during signup or whose agency name was not copied across. The fallback "an estate agency" exposes this gap.

**Fix in the rebuild:** Add `agency: { select: { name: true } }` to the chain query and use that as the canonical fallback. The lookup chain becomes:
```
createdBy.firmName → chain.agency.name → null (and we drop the "at X" entirely)
```

When agency name is unknown, the sentence reads "Sarah Hartwell has linked your sale to theirs" — grammatically complete, not broken. The "at X" phrase only renders when a name is actually available.

---

## 3. Page-by-Page Design Proposal

---

### 3.1 `/claim` — The Landing Page

**Purpose:** Convert a cold, surprised estate agent into a willing participant in 10 seconds.

**States to design:**
- **A** — Default: not logged in, email not in system → signup path
- **B** — Not logged in, email matches existing account → login path
- **C** — Already logged in → direct claim path (one tap)
- **D** — Token expired
- **E** — Already claimed
- **F** — Already declined

#### Layout (State A — primary)

```
┌────────────────────────────────────────────────────────────┐
│  THE SALES PROGRESSOR          [coral wordmark, 14px caps] │  <- 56px header, cream bg
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  CORAL→AMBER GRADIENT HERO CARD (border-radius 20px)       │
│                                                            │
│  [eyebrow — white, 11px, 700, tracked uppercase]           │
│  SARAH HARTWELL · HARTWELL PARTNERS                        │
│                                                            │
│  [H1 — white, 36px, 800, -0.02em tracking]                 │
│  Your sale is part of a                                    │
│  live chain.                                               │
│                                                            │
│  [body — white 85% opacity, 15px, 1.6 line-height]         │
│  Sarah has linked 12 Acme Street to their file.            │
│  Join to see where the chain stands in real time.          │
│                                                            │
│  ┌──────────────────────────────────────────────┐         │
│  │ CHAIN VISUALISATION (white glass card)        │         │
│  │                                               │         │
│  │ ① [coral ring] 42 Garden Road           #1   │         │
│  │   Hartwell Partners · Tracking               │         │
│  │       │                                      │         │
│  │ ② [coral dashed ring] 12 Acme Street    #2   │         │
│  │   Your sale · Claim to join               ← YOU        │
│  └──────────────────────────────────────────────┘         │
│                                                            │
└────────────────────────────────────────────────────────────┘

[16px gap]

┌────────────────────────────────────────────────────────────┐
│  CTA AREA (white card, 24px padding)                       │
│                                                            │
│  [CLAIM THIS SALE — coral, 48px, full-width, rounded-12]   │
│                                                            │
│  Free to join · 30 seconds · No card required             │
│  [12px, muted, centered]                                   │
│                                                            │
│  Already have an account?  Log in →                       │
│  [13px, secondary]                                         │
│                                                            │
│  ─────────────────────────────────────────────────────    │
│                                                            │
│  This isn't my sale — decline invite                       │
│  [12px, muted, centered, no underline]                     │
└────────────────────────────────────────────────────────────┘

[24px gap]

┌────────────────────────────────────────────────────────────┐
│  TRUST CLUSTER (no border, cream background, 3 columns)    │
│                                                            │
│   [?] agents    · Free for all  ·  Live since [year]       │
│  on the platform    invited agents                         │
│  [see Open Qs]                                             │
└────────────────────────────────────────────────────────────┘

[24px gap]

  ABOUT (no card, inline text, centred)
  
  Sales Progressor helps UK estate agents track every sale in  
  a chain together — so no-one's chasing what someone else     
  already knows.                                              
  
  [12px muted] Questions? support@thesalesprogressor.co.uk

```

#### State B — email matches existing account
Same layout. CTA becomes "Log in to claim this sale." The "Create account" link swaps to "New to Sales Progressor? Create account."

#### State C — already logged in
Same layout. CTA becomes "Claim this sale" → goes directly to `/claim/confirm`. No login link shown.

#### State D — token expired
Drop hero card. Full-page centred:
```
[coral wordmark]
H1: This invite has expired.
Body: The link is valid for 7 days after it's sent. Ask [originator name] to resend it.
Muted: Need help? support@…
```

#### State E — already claimed
```
H1: This sale has already been claimed.
Body: If you think this is a mistake, contact support.
```

#### State F — already declined
```
H1: You've already declined this invite.
Body: Changed your mind? Ask [originator name] to send a fresh link.
```

#### Hero composition (mobile)
- Hero card: full-width minus 16px margins, gradient preserved
- H1 drops to 28px
- Chain visual collapses to 2 rows max (clipped if more)
- CTA button: 52px tall on mobile (touch target)
- Trust cluster: stacks vertically, centred

---

### 3.2 `/claim/signup` — New Account

**Purpose:** Get the agent in with the minimum friction that doesn't compromise security. Make it feel like onboarding, not a form.

#### Layout

```
┌────────────────────────────────────────────────────────────┐
│  THE SALES PROGRESSOR                                      │
└────────────────────────────────────────────────────────────┘

  [CHAIN CONTEXT PILL — full-width, cream/coral-tinted bg]
  ┌────────────────────────────────────────────────────────┐
  │  ← Back to invite    Joining: 12 Acme Street, B'ham   │
  │                       Hartwell Partners' chain         │
  └────────────────────────────────────────────────────────┘

  [H1 — 28px, 800, left-aligned]
  Create your account.
  
  [sub — 15px, secondary]
  You'll land inside the chain the moment you're in.

  ┌────────────────────────────────────────────────────────┐
  │  FORM CARD (white, shadow-sm, rounded-16)              │
  │                                                        │
  │  Your name                                             │
  │  [________________________________]                    │
  │                                                        │
  │  Agency name                                           │
  │  [________________________________]  ← pre-fill stub   │
  │                                                        │
  │  Work email                                            │
  │  [pre-filled from stub if available, editable]         │
  │                                                        │
  │  Password                                              │
  │  [________________________________]                    │
  │                                                        │
  │  [CREATE ACCOUNT — coral, full-width, 48px]            │
  └────────────────────────────────────────────────────────┘

  Already have an account? Log in →
  
  [12px muted, centred]
  Free · No card required · Cancel any time
```

#### Notes
- 4 fields only. No phone number, no confirm-password, no terms checkbox on this screen (terms as inline text under CTA: "By creating an account you agree to our Terms").
- Agency name pre-filled from `stubAgencyName` if available.
- Work email pre-filled from `stubAgentEmail` if available, but editable.
- Password: show/hide toggle, no strength meter on this screen.

#### Mobile
- Full-screen, scroll-friendly
- Context pill sticks to top on scroll (position: sticky)

---

### 3.3 `/claim/login` — Existing Account

**Purpose:** Let a returning agent log in and land immediately in the claim confirmation. Minimal copy — they know who they are.

#### Layout

```
┌────────────────────────────────────────────────────────────┐
│  THE SALES PROGRESSOR                                      │
└────────────────────────────────────────────────────────────┘

  [CHAIN CONTEXT PILL — same as signup]
  Logging in to claim: 12 Acme Street, Birmingham

  [H1 — 28px, 800]
  Welcome back.

  [sub — 15px, secondary]
  Log in to claim your position in this chain.

  ┌────────────────────────────────────────────────────────┐
  │  FORM CARD                                             │
  │                                                        │
  │  Email                                                 │
  │  [pre-filled from stub, editable]                      │
  │                                                        │
  │  Password                                              │
  │  [________________________________]                    │
  │                                                        │
  │  [LOG IN AND CLAIM — coral, full-width, 48px]          │
  │                                                        │
  │  Forgot password? Reset it →                           │
  └────────────────────────────────────────────────────────┘

  New to Sales Progressor? Create account →
```

#### Notes
- Button copy is "Log in and claim" — explicit about what happens next, not just "Log in".
- Forgot password link: currently no forgot-password flow exists — this should link to `mailto:support@...` or render inline copy "Email support@thesalesprogressor.co.uk to reset your password." Flag as open question.

---

### 3.4 `/claim/confirm` — Commitment

**Purpose:** Final confirmation before the claim is locked in. Make it feel meaningful, not bureaucratic.

**States:**
- **Clean** — no duplicate detected
- **Duplicate** — we found an existing transaction that matches

#### Layout (Clean state)

```
┌────────────────────────────────────────────────────────────┐
│  THE SALES PROGRESSOR                                      │
└────────────────────────────────────────────────────────────┘

  [H1 — 32px, 800, centred]
  You're joining the chain.

  [sub — 15px, secondary, centred]
  12 Acme Street, Birmingham will link to
  Hartwell Partners' sale.

  ┌────────────────────────────────────────────────────────┐
  │  SUMMARY CARD (coral-tinted left border, 3px)          │
  │                                                        │
  │  Your sale         12 Acme Street, Birmingham          │
  │  Chain             Hartwell Partners · 2 links         │
  │  Your position     #2 of 2                             │
  │  Logged in as      agent@acme.co.uk                    │
  └────────────────────────────────────────────────────────┘

  [CONFIRM AND JOIN — coral, full-width, 48px]
  
  [12px muted, centred]
  This connects your file to the shared chain view.
  You can leave the chain at any time.
```

#### Layout (Duplicate state)

```
  [H1 — 28px, 800, centred]
  We found a matching file.

  [sub — 15px, secondary, centred]
  You already have a file for 12 Acme Street in your dashboard.
  Link that file to the chain, or create a new one.

  ┌────────────────────────────────────────────────────────┐
  │  OPTION A — coral ring                                 │
  │  ○  Link my existing file                              │
  │     12 Acme Street · Created 14 May 2026               │
  └────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────┐
  │  OPTION B                                              │
  │  ○  Create a new file for this chain                   │
  │     Your existing file stays separate                  │
  └────────────────────────────────────────────────────────┘

  [CONTINUE — coral, full-width, 48px]
```

#### Notes
- Duplicate state: reframe "we found a transaction" (system language) as "we found a matching file" (agent language). The choice feels like help, not interrogation.
- "Wrong account" sub-state (email mismatch): same page, but replace summary card with a clear explanation + "Log out and try again" + "Ask them to resend to your account".

---

### 3.5 `/claim/decline` — Graceful Exit

**Purpose:** Close the loop with dignity. The agent is doing the right thing by declining rather than ignoring.

**Note on current implementation:** `/claim/decline` is a raw GET route returning inline HTML. For the redesign it should become a proper Next.js page at `app/claim/decline/page.tsx`. The GET route can redirect to it, or it can be replaced entirely. This is flagged as an open question.

#### Layout

```
┌────────────────────────────────────────────────────────────┐
│  THE SALES PROGRESSOR                                      │
└────────────────────────────────────────────────────────────┘

  [Large coral dot, centred, 40px — visual full stop]
  
  [H1 — 36px, 800, centred]
  All noted.

  [body — 16px, secondary, centred, max-width 380px]
  We've let them know this isn't your sale.
  No further action needed from you.

  [8px gap]

  ┌────────────────────────────────────────────────────────┐
  │  EXPIRY NUDGE CARD (cream bg, warm border, no shadow)  │
  │                                                        │
  │  Changed your mind? The link is valid until            │
  │  26 May 2026. Claim it any time before then.           │
  │                                                        │
  │  [CLAIM AFTER ALL — ghost button, coral border]        │
  └────────────────────────────────────────────────────────┘

  [32px gap]

  [12px muted, centred]
  What is The Sales Progressor?
  Estate agents use it to track every sale in a chain together —
  so everyone knows where the hold-up is before they pick up the phone.

  [12px muted, centred, 8px gap]
  Questions? support@thesalesprogressor.co.uk
```

#### Expired token state (accessed after expiry)

```
  H1: This link has expired.
  Body: It was valid for 7 days after it was sent. If you'd like to join,
        ask [originator name] for a fresh invite.
```

---

## 4. Component Inventory

New components required for Stage 2:

| Component | Description | Used on |
|---|---|---|
| `ClaimShell` | Shared layout wrapper: warm-cream bg, wordmark header, max-width container | All 5 routes |
| `ClaimHeroCard` | Coral→amber gradient card with eyebrow + H1 + sub + slot for chain visual | `/claim` |
| `ClaimChainVisual` | Vertical linked-card chain diagram showing positions, claimed/unclaimed states | `/claim`, `/claim/confirm` |
| `ClaimContextPill` | Sticky top bar showing chain context on sub-pages | `/claim/signup`, `/claim/login`, `/claim/confirm` |
| `ClaimSummaryCard` | Coral left-border card: your sale, chain, position, logged-in-as | `/claim/confirm` |
| `ClaimTrustCluster` | 3-column trust numbers cluster | `/claim` |
| `ClaimDeclineExit` | Decline confirmation with expiry nudge and ghost CTA | `/claim/decline` |
| `ClaimCtaSection` | CTA button + microcopy + secondary links block | `/claim` |
| `claim-flow.css` | New stylesheet: marketing-page tokens, gradient keyframes, layout utilities | All 5 routes |

Existing components to keep (restyled via new CSS):
- `ClaimSignupForm` — keep logic, restyle inputs + button
- `ClaimLoginForm` — keep logic, restyle
- `ClaimConfirmForm` — keep logic, restyle duplicate picker

---

## 5. Copy Strings

All visible strings, voice-checked against VOICE_GUIDELINES.md. Ready for Ellis review.

### `/claim` — landing

| Element | Copy |
|---|---|
| Wordmark | THE SALES PROGRESSOR |
| Hero eyebrow | `{originatorName} · {originatorAgency}` (or just `{originatorName}` if no agency) |
| H1 | Your sale is part of a live chain. |
| Sub | `{originatorName}` has linked `{stubAddress}` to their file. Join to see where the chain stands in real time. |
| Chain visual — your position label | Your sale |
| Chain visual — your position sub | Claim to join |
| Chain visual — claimed position sub | Tracking |
| Chain visual — unclaimed position | Sale pending |
| CTA button (state A: new user) | Claim this sale |
| CTA button (state B: known email) | Log in to claim this sale |
| CTA button (state C: logged in) | Claim this sale |
| Microcopy under CTA | Free to join · 30 seconds · No card required |
| Secondary link (state A) | Already have an account? Log in |
| Secondary link (state B) | New to Sales Progressor? Create account |
| Decline link | This isn't my sale — decline invite |
| Trust cluster label 1 | [?] agents on the platform *(see Open Questions)* |
| Trust cluster label 2 | Free for invited agents |
| Trust cluster label 3 | UK-built |
| About copy | Sales Progressor helps UK estate agents track every sale in a chain together — so no-one's chasing what someone else already knows. |
| Support line | Questions? support@thesalesprogressor.co.uk |

**Error states:**

| State | H1 | Body |
|---|---|---|
| No token | Invalid link | This link is invalid or has expired. |
| Token expired | This invite has expired. | The link is valid for 7 days after it's sent. Ask `{originatorName}` to resend it. |
| Already claimed | Already claimed. | This sale is already part of the chain. If you think this is a mistake, contact support. |
| Already declined | You've declined this invite. | Changed your mind? Ask `{originatorName}` to send a fresh link. |

---

### `/claim/signup` — new account

| Element | Copy |
|---|---|
| Wordmark | THE SALES PROGRESSOR |
| Context pill | Joining: `{stubAddress}` · `{originatorAgency}`'s chain |
| Back link | ← Back to invite |
| H1 | Create your account. |
| Sub | You'll land inside the chain the moment you're in. |
| Field: name | Your name |
| Field: agency | Agency name |
| Field: email | Work email |
| Field: password | Password |
| CTA | Create account |
| Terms microcopy | By creating an account you agree to our Terms of Service. |
| Bottom link | Already have an account? Log in |
| Microcopy | Free · No card required |

---

### `/claim/login` — existing account

| Element | Copy |
|---|---|
| Context pill | Logging in to claim: `{stubAddress}` |
| H1 | Welcome back. |
| Sub | Log in to claim your position in this chain. |
| Field: email | Email |
| Field: password | Password |
| CTA | Log in and claim |
| Forgot password | Forgot password? *(links to support — see Open Qs)* |
| Bottom link | New to Sales Progressor? Create account |

---

### `/claim/confirm` — commitment

| Element | Copy (clean state) |
|---|---|
| H1 | You're joining the chain. |
| Sub | `{stubAddress}` will link to `{originatorAgency}`'s sale. |
| Summary row 1 | Your sale · `{stubAddress}` |
| Summary row 2 | Chain · `{originatorAgency}` · `{N}` links |
| Summary row 3 | Your position · #`{n}` of `{N}` |
| Summary row 4 | Logged in as · `{email}` |
| CTA | Confirm and join |
| Microcopy | This connects your file to the shared chain view. You can leave any time. |

| Element | Copy (duplicate state) |
|---|---|
| H1 | We found a matching file. |
| Sub | You already have a file for `{stubAddress}` in your dashboard. Link it to the chain, or start fresh. |
| Option A label | Link my existing file |
| Option A sub | `{propertyAddress}` · Created `{date}` |
| Option B label | Create a new file for this chain |
| Option B sub | Your existing file stays separate |
| CTA | Continue |

| Element | Copy (wrong account state) |
|---|---|
| H1 | Wrong account. |
| Body | This invite was sent to `{stubEmail}`. You're logged in as `{sessionEmail}`. Log out and try the account this invite was sent to, or ask `{originatorName}` to resend the invite to `{sessionEmail}`. |
| Primary link | Log out and try a different account |
| Secondary link | Cancel |

---

### `/claim/decline` — exit

| Element | Copy |
|---|---|
| H1 | All noted. |
| Body | We've let them know this isn't your sale. No further action needed from you. |
| Expiry nudge | Changed your mind? The link is valid until `{expiryDate}`. |
| Ghost CTA | Claim after all |
| About copy | What is The Sales Progressor? Estate agents use it to track every sale in a chain together — so everyone knows where the hold-up is before they pick up the phone. |
| Support | Questions? support@thesalesprogressor.co.uk |

**Error / edge states:**

| State | H1 | Body |
|---|---|---|
| No token / not found | Invalid link | This link is invalid or has expired. |
| Already declined | Already declined. | We've already passed this on. No further action needed. |
| Already claimed | This sale has been claimed. | No need to decline — someone has already joined. |
| Expired (decline attempt) | This invite has expired. | The link was valid for 7 days. No action needed from you. |

---

## 6. Animation and Motion Direction

**Principle:** Motion communicates state, never decoration. Everything is CSS-only. No JS on initial paint.

| Element | Animation | Duration | Trigger |
|---|---|---|---|
| Page enter (all pages) | `opacity: 0→1`, `translateY: 8px→0` | 200ms, ease-out | `@keyframes claim-enter`, applied to main container |
| Hero card enter | Same as page, 40ms delay | 240ms | Stagger after page enter |
| Chain links (visual) | Each card: `opacity: 0→1`, `translateY: 4px→0`, 60ms stagger per link | 180ms | Stagger after hero enter |
| CTA button hover | `background: darken 4%`, `transform: translateY(-1px)`, `box-shadow: deepen` | 120ms | `:hover` |
| CTA button active | `transform: translateY(0)` | 80ms | `:active` |
| Context pill (signup/login) | Fade in with page | — | With page enter |
| Form card | `opacity: 0→1`, 80ms delay | 200ms | After page enter |
| Decline dot | `opacity: 0→1`, scale `0.6→1.0` | 300ms ease-out-back | Page enter |

**What we are NOT doing:**
- No parallax
- No scroll-triggered animations (these pages are short and mobile-first)
- No skeleton loading states (data is loaded server-side before render)
- No lottie / SVG path animations
- No modal transitions on these pages

---

## 7. Open Questions for Ellis

**Q1 — Trust numbers**
The trust cluster on `/claim` needs real numbers. Options:
- "Used by X agencies" — requires a count query on Agency table
- "X sales progressed" — requires a count on PropertyTransaction
- "Free for invited agents" + "UK-built" + launch year only — no count needed, no risk of embarrassingly small number
- Fake a plausible number until real volume exists (e.g. "Built for UK estate agents")

**Recommendation:** Skip the count for now. Use: "Free for invited agents · No sign-up cost · Built for UK estate agents." Revisit when you have a number worth showing.

---

**Q2 — Decline page: Next.js page vs raw route**
Currently `/claim/decline` is `app/claim/decline/route.ts` — a GET handler returning raw HTML. Converting it to a proper Next.js page (`app/claim/decline/page.tsx`) gives us full design control and React components, but the URL would need to be a page-based route consuming the token from `searchParams` rather than the GET handler approach.

The alternative is keeping it as a route and rebuilding the raw HTML template to match the new design (doable but limited — no React components, inline styles only).

**Recommendation:** Convert to a Next.js page. The GET handler can be replaced entirely since the token already lives in `searchParams` on the page.

---

**Q3 — Forgot password flow**
`/claim/login` will need a "Forgot password" link. Currently no forgot-password flow exists. Options:
- Link to `mailto:support@thesalesprogressor.co.uk` with pre-filled subject
- Build a basic reset-by-email flow (out of scope for this pass)
- Hide the link for now

**Recommendation:** For Stage 2, link to `mailto:support@thesalesprogressor.co.uk?subject=Password+reset+request`. Note it prominently on the page so agents aren't stuck. Schedule the real flow separately.

---

**Q4 — /claim/decline: "claim after all" — does it work after a DECLINED status?**
Once a link is declined (`inviteStatus = "DECLINED"`), the `/claim` page shows "Already declined" and blocks claiming. If we show a "Claim after all" button on the decline page, tapping it would hit that block.

Two options:
a) Don't show the "Claim after all" button — just note the expiry date
b) Update the decline route to revert `inviteStatus` from DECLINED to SENT on claim, or allow claiming from DECLINED state

**Recommendation:** Option (b) is cleaner — allow claiming from DECLINED status (treat it as SENT for the claim flow). This matches user expectation: "I changed my mind" should work. Confirm before Stage 2.

---

**Q5 — Chain visual on `/claim`: how many links to show?**
A chain could have 5+ links. The landing page chain visual should probably cap at a visible number. Options:
- Show all links, scroll within the card
- Show max 3, clip with "and N more"
- Show originator link + your link only (always 2)

**Recommendation:** Show all if ≤ 4. If > 4, show originator + immediate neighbours + your link, with "and N more" in the middle. Confirm this is acceptable UX.

---

**Q6 — /claim/confirm: "leave the chain any time" — is this true?**
The confirm page microcopy says "You can leave the chain at any time." Confirm this is actually implemented — can a claimed agent remove their link from a chain? If not, remove this line.
