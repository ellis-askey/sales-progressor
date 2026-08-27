# Solicitor portal — the app redesign (living plan)

**Status:** planning. Nothing built yet. Gated on the data-sharing decisions in §5 — those get confirmed before the two sensitive cards are built.
**Captured:** 2026-08-28 from Ellis's new mock (the "Good morning, Harrison" full-app screen).
**Supersedes the skin of** [01/00-discovery](00-discovery.md) stages — the five-stage `/s` build stays as the behavioural foundation; this redesigns the surface into a full portal app matching the client portal.

---

## 1. What this is

Level the `/s/[token]` page up from a single scroll into a **full portal app** that mirrors the client portal: a top bar with a greeting, a hero with the progress ring, stacked cards, and a bottom Overview / Progress / Updates tab bar. We keep the **flow, layout and functionality from the mock**, but build it in the **client portal's design language** — its glass cards, sizing, motion, tokens — in a **professional blue palette** (the mock is blue, not the client's warm coral).

One deliberate difference from the client portal, per your note: the hero is a **distinct frosted glass card sitting over the blue image**, not the client portal's trick where the photo dissolves into the page. We use the image opaque and float a real card on it.

---

## 2. The design language we adopt

Everything below already exists and is cloneable (file refs in §3):

- **Glass cards** — `PortalGlassCard` + the `.glass-vNN` system. For a solid, readable card over the blue photo, the purpose-built variant is **v08 "deep frost"** (white 14% + `blur(40px)`, bright top edge) — it reads as a card, not a blend.
- **The progress ring** — a 96px SVG arc (`stroke-dasharray`), "N of 6" centred. Reused verbatim, recoloured blue.
- **The 6-stage strip** — `ProgressTile` (desktop row) / `TimelineRow` (mobile timeline), fed by the same `OverviewTile` shape.
- **Chrome** — the greeting with its per-letter typewriter, the hamburger, the glass bottom nav (Overview/Progress/Updates), the pure-CSS `portal-reveal-stack` load cascade, the menu bottom-sheet.
- **Tokens** — the `P` sizing/spacing/radius/shadow set and `PortalPill`.

**Palette:** we keep the client portal's *structure and motion* but swap the accent from coral to a **professional blue** (hero navy-blue gradient, blue ring, blue "View full timeline" link) — matching the mock and our earlier "restrained professional" lock. This reconciles "look like the client portal" with "a solicitor, not a consumer."

---

## 3. What we reuse (nothing built from scratch)

**From the client portal (design):**
- `components/portal/PortalShell.tsx` — greeting/typewriter, hamburger, glass-v04 nav surfaces, bottom-tab structure + routing, menu drawer.
- `components/portal/PortalOverviewHero.tsx` — image backdrop, `HeroRing` (the SVG arc), the tile strip.
- `components/portal/PortalGlassCard.tsx` + `lib/glass/variants.ts` + `app/styles/glass.css` — the glass card + variants.
- `components/portal/portal-ui.tsx` — `P` tokens + `PortalPill`.
- `app/globals.css` — `.portal-reveal-*` (load motion), `.portal-ambient` (we'll use a cool variant).

**From what we already built for `/s` (behaviour/data):**
- The signed `(file, side)` token + 30-day expiry, the confirm/date/note actions, the MOS surfacing, `resolveDisplayStages` (the 6 stages), `solicitorCodesForSide` (the due steps).

**Data services we'd tap (see §5 for the gated ones):**
- `getPortalMilestones(txId, otherSide, scope)` — the other side's states + dates (`lib/services/portal.ts`).
- `getChainForTransactionV2` / `getOnwardTrackerView` / `getPortalChainAgent` (`lib/services/chains.ts`, `lib/services/onward.ts`).

---

## 4. The screen, section by section (from the mock)

| Mock section | Built from | Data sensitivity |
|---|---|---|
| Top bar: "Good morning, {solicitor}", hamburger, bell | Portal chrome | Own — greet by `SolicitorContact.name`. Bell = **decision D**. |
| Hero: seller-matter pill, address, price/tenure, acting-for + firm, ring "2 of 6", last-updated | Hero + glass card (v08) | Shared sale facts. Fine. |
| Progress Overview: 6-stage strip + "View full timeline" | `resolveDisplayStages` → tiles | The shared sale journey. Fine (already agreed). |
| Open Updates: the due steps ("Management pack — Requested…", Mark as received / Add update) | Our `SolicitorRespond`, reskinned | Own-side. Fine. |
| **Other Side (Buyer): mortgage offer / searches / survey / enquiries / ready-to-exchange + dates** | `getPortalMilestones(otherSide)` | **COUNTERPARTY-PRIVATE — decision A.** |
| **Chain Summary: first-time-buyer / this matter / onward, each with a status** | chain services | **PARTLY PRIVATE — decision B.** |
| Bottom nav: Overview / Progress / Updates | Portal chrome | Own. |

---

## 5. Data-sharing decisions (THE GATE — confirm before building A & B)

The investigation surfaced a sharp line: **most of the mock is shared sale facts, but two cards would newly expose the buyer's private progress.** We build the shell, hero, progress overview and open-updates freely; the two below wait for your call.

### Decision A — the "Other Side (Buyer)" card
The mock shows the buyer's **mortgage offer received (22 Aug), searches received (23 Aug), survey completed (24 Aug), replies-to-enquiries awaiting, ready-to-exchange not-yet** — with dates.

Reality: this is the **buyer's own progress** (their mortgage, their survey). The data exists, but the **client portal deliberately shows the other side as a tick only, no dates.** So the mock would newly expose the counterparty's states *and* their dates (a mortgage-offer date is a sharp financial signal). That said — a seller's solicitor legitimately wants to know "is the buyer's finance in, are searches back" to judge readiness; solicitors exchange exactly this between themselves anyway.

Options:
- **A1 — Full, with dates** (as the mock). Most useful, most exposure.
- **A2 — States only, no dates** (e.g. "Searches ✓" / "Enquiries — awaiting", but not "23 Aug"). *My lean* — keeps the usefulness, drops the sharpest personal-financial signal.
- **A3 — Shared/bilateral facts only** — just "ready to exchange / exchanged / completed" (things both sides are told anyway); hide mortgage/survey/searches entirely.
- **A4 — Don't show the other side at all.**

### Decision B — the "Chain Summary" card
The mock shows each chain link with a **status word** ("First time buyer — Ready", "Onward purchase — Searches").

Reality: our **onward-visibility privacy is locked** — a neighbour's per-step status is **private to that link's owner** and reported onward progress "never leaves our own side" (it's second-hand and a client may have mis-ticked). Today only a **rolled-up % + address + claim status** crosses between agencies. So per-link status words would newly expose private operational state and **conflict with a locked decision**.

Options:
- **B1 — Full status words** (as the mock). *Conflicts with the locked onward-visibility rule.*
- **B2 — Chain shape + rolled-up progress only** — show the links (first-time-buyer → this matter → onward), each with the one already-shared rolled-up % (as a small ring/bar) + address + claim badge; **no status words, no onward-tracker detail.** *My lean* — consistent with what we already share cross-agency.
- **B3 — Minimal** — just "you're in a chain of N; this is your matter"; no per-link detail.
- **B4 — Don't show the chain.**

### Decision C — "Last updated … by {agency}"
Low sensitivity (it's the managing agency). *Lean: keep as shown.*

### Decision D — the notification bell
The client portal has **no bell** (notifications are a settings toggle). The mock adds one. A real notification feed for a solicitor is net-new.
- **D1 — No bell** (match the client portal; keep notifications in the menu). *Lean.*
- **D2 — A bell that opens the menu's notification settings** (cosmetic, no feed).
- **D3 — A real notification feed** (net-new build).

---

## 6. Staged build plan (after A/B/C/D are set)

1. **The shell** — top bar (greeting + hamburger + bell-per-D), bottom Overview/Progress/Updates tabs, new routes `/s/[token]/progress` + `/updates`, cool ambient background, the load-reveal cascade, the menu sheet (Documents = MOS, Settings = stop-emails/pause). Blue professional palette.
2. **The hero** — your blue image + the distinct v08 glass card over it: seller-matter pill, address, price/tenure, acting-for + firm, the "N of 6" ring, last-updated.
3. **Progress Overview card** — the 6-stage tile strip + "View full timeline".
4. **Open Updates card** — the due steps reskinned (Mark as received / Add update); summary on Overview, full list on the Updates tab.
5. **Other Side (Buyer) card** — per decision A. *(gated)*
6. **Chain Summary card** — per decision B. *(gated)*
7. **Progress + Updates tabs** — the two bottom-nav destinations (full timeline; activity/updates feed).
8. **First-impression polish** — motion timing, empty/loading/error states, reduced-motion, MOS in Documents, final QA on your image at mobile + desktop.

Each stage ships to **staging** and you see it before the next (as we've been doing). No migrations expected — it's presentation + reads over data that already exists.

---

## 7. Open questions
- **Q1:** confirm A, B, C, D above.
- **Q2:** greeting name — the solicitor **contact's** first name (e.g. "Harrison" from `SolicitorContact.name`), or the **firm**? (Mock says "Harrison"; firm is "Harrison Legal Llp" — so likely the contact.)
- **Q3:** the blue hero image — one shared image for all, or per-property later? (You're providing the image.)
- **Q4:** does the "Open Updates" framing ("Mark as received") replace our current "Confirm this is done" wording? (Mock uses received/update; our steps are confirmations.)
