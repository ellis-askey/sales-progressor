# Demo Sale — Guided Experience Plan

Status: **PLAN ONLY — not built.** Drafted 2026-09-02. Audit-backed.

This plan designs a guided walkthrough of the demo sale that feels like **TSP briefly taking a new agent through one of their real sales** — the interface moves around them, the product itself is the demonstration. Not a modal of paragraphs, not tooltip bubbles, not a slideshow.

It is written on top of a four-part forensic audit of the current code. Every architectural claim below is cited to `file:line`. The headline finding: **before any tour is built, the demo has to be made (a) safe and (b) rich enough on three tabs that currently render empty.** Sections 2 and 3 prove that; the tour design assumes those two fixes ship first.

---

## Contents

1. Existing demo architecture
2. Demo safety audit (**read this first — it blocks the build**)
3. Full demo seed audit + compatibility matrix
4. Missing / stale demo data
5. Property-file journey analysis
6. Recommended tour concept
7. Exact tour story / steps
8. Per-step detail
9. Motion specification
10. Mobile / responsive behaviour
11. Accessibility / reduced motion
12. Technical architecture
13. Tour state / persistence
14. Analytics
15. Failure / fallback behaviour
16. Demo seed changes required
17. Implementation sequence
18. Tests
19. What should NOT be in the tour
20. Decisions required from you
21. Storyboard table

---

## 1. Existing demo architecture

There are **two unrelated "demo" systems**. Do not confuse them:

| | On-demand demo (**the one the tour uses**) | Staging "Fairview" demo |
|---|---|---|
| Code | `lib/services/demo-sale.ts` → `createDemoSale()` (line 349) | `scripts/seed-demo.ts` → `runSeedDemo()` (line 689) |
| Trigger | "Explore demo sale" button → `getOrCreateDemoSaleAction` (`app/actions/demo.ts:14`) | `npm run demo:seed` / Reset Demo in `/command/admin/demo`. **Staging-only**, hard-blocked from prod (`assertDemoSafe`, seed-demo.ts:87) |
| Star file | **14 Beaumont Rise, Harpenden** (`DEMO_PRESET`, demo-sale.ts:81) — middle of a 3-link chain | 42 Hawthorn Road, Bristol |
| Runs on prod? | **Yes** — this is what a real agency sees | No |

Everything below concerns the **on-demand demo (14 Beaumont Rise)**, because that is the only demo a live agency can open. Spec: `docs/active/demo-sale/SPEC.md`.

**How it works today:**

- **CTA:** the hook `useDemoExplore()` (`components/transactions-v2/useDemoExplore.tsx`) renders an intro modal with a primary **"Explore demo sale"** button (line 110). On success it `router.push('/agent/transactions/${transactionId}')` (line 52), landing on the **middle/star file**. Consumed by every "no files yet" empty state: `DemoHeroCard`, `AllFilesEmptyState`, `HubEmptyState`, `CommsEmptyState`, `AnalyticsEmptyState`, `NewSaleFlow`.
- **Creation is lazy** (on click), not pre-seeded. `createDemoSale()` builds a 3-file chain — `TOP` 22 Rothamsted Ave (~24%), `MIDDLE` 14 Beaumont Rise (~62%, the star), `BOTTOM` 3 Leyton Court (~90%) — via `buildDemoFile()` (line 158), each through the **real** `createTransaction()` with `isDemo: true`.
- **Per agency:** each agency gets its own chain; the demo agent "Charlotte Hayes" is per-agency (`demo-agent+${agencyId}@example.com`, `User.isDemo = true`).
- **Dedup** is in the action, not the DB (`app/actions/demo.ts:19-28`): if a real sale exists it refuses; if a demo exists it **reuses** it. Clicking twice never duplicates (no unique constraint, so a truly-concurrent double-click is a theoretical edge).
- **isDemo** lives on `PropertyTransaction` (`schema.prisma:394-395`, `isDemo` + `demoExpiresAt`) and `User` (line 168). Contacts / completions / messages are **not** individually flagged — demo-ness is inferred from the parent transaction.
- **Persistence:** `buildDemoFile` sets `demoExpiresAt: null` (line 182) **deliberately** (Ellis, 2026-08-30). The `demo-cleanup` cron only deletes rows where `demoExpiresAt` is non-null and past, so it is currently a **no-op** — the demo lives forever until removed by hand. `removeDemoSale()` exists (line 396) but **no UI is wired to it** (`removeDemoSaleAction` / `addDemoSaleAction` are dead — only `getOrCreateDemoSaleAction` is live).

> ⚠️ **Contradiction to resolve (Law 6):** SPEC.md:15 still says the demo "auto-removes after a week" via `demoExpiresAt (~1 week)`. The code nulls it. Either the SPEC is stale or the null was a temporary choice. Decision D7 below.

---

## 2. Demo safety audit — **this blocks the build**

The demo's design premise is "everything is `isDemo`, so it's excluded." **That is true for reads, metrics and billing. It is false for outbound side-effects.** A demo file is a fully real `PropertyTransaction`: `status = active`, `serviceType = self_managed`, portal-eligible contacts with real-looking `@example.com` addresses and portal tokens, milestones with anchor dates 40–80 days old. The chase / email / reminder engines select on those properties and **never check `isDemo`**.

I verified the four load-bearing facts directly:

- `lib/services/billing-trigger.ts:60` — `if (txn.isDemo) return;` ✅ (the one real outbound-ish guard)
- `app/actions/milestones.ts` — **0** occurrences of `isDemo` ❌
- `lib/services/portal.ts` — **0** occurrences of `isDemo` ❌
- `lib/services/client-chase-cron.ts` — **0** occurrences of `isDemo` ❌

### Guarded correctly ✅

| Side effect | Guard |
|---|---|
| Exchange billing / invoice | `billing-trigger.ts:60` `if (txn.isDemo) return;` |
| Payment block / trial anchor | `transactions.ts:893` skips `assertCanCreateFile`; `:903` skips `stampTrialState` |
| Activation + `transaction_created` (event log + PostHog) | `transactions.ts:982` `if (!newTx.isDemo)` |
| Command Centre (revenue / retention / pipeline / adoption / signals / experiments) | every CC reader filters `isDemo: false` |
| Hub top-line counters | `hub.ts:93+` count `isDemo: false` |
| Reminders/Auto-emails page unlock | `self-managed-nav.ts:35` `isDemo: false` |
| Team pickers | demo agent `User.isDemo` excluded (`agency-team.ts:23`) |
| Chain invites | `buildChain` sets every link `inviteStatus: "CLAIMED"` (demo-sale.ts:334) so nothing is pending |

### UNGUARDED — real side-effects reachable from a demo ❌ (fix before the tour ships)

1. **Milestone-confirmation emails to the fake clients (loudest hole).** `confirmMilestoneAction` (`app/actions/milestones.ts:60`) has no `isDemo` check. On confirm it fires `sendAdminMilestoneNotificationToPortal` → `portal.ts:1503` → `sendRichMilestoneEmails`, which selects `portalEligible` contacts (default `true`, schema:781) and enqueues a **real** SendGrid email to `sarah.whitfield@example.com`. `@example.com` is non-deliverable, so no human is hit — but SendGrid **still processes and bounces it, harming sender reputation** and burning quota. Also unguarded on the confirm path: `fireAutoCounterpartEmails`, `scheduleOrSendCompletionPack`, `maybeSendReadyToExchangeEmail`, `maybeFireFirstExchangeEmail`. The SendGrid layer (`lib/email.ts`) has no `isDemo` and no `@example.com` blocklist.
2. **PostHog contamination.** `milestones.ts:207` fires `MILESTONE_CONFIRMED` and `:548` fires `MILESTONE_UNCONFIRMED` **unconditionally** (PostHog is not `isDemo`-filtered, unlike the internal event log).
3. **Reminder logs into the real work queue.** `confirmMilestoneAction:190` calls `evaluateTransactionReminders`; `reminders.ts` has no `isDemo` guard, so it writes live `ReminderLog`/`ChaseTask`. `work-queue.ts:34` (`txWhereWorkQueue`) filters agency + self-managed + active but **not `isDemo`**, so demo alerts can surface on a director's cross-file queue once a real self-managed file also exists.
4. **Automated client chasing.** `client-chase-cron.ts:188` selects `status: "active"`, no `isDemo`. The demo's old anchors already satisfy due-ness and its contacts are reachable — **the demo qualifies for real chase emails at rest**, stopped today only by the global env flag `CLIENT_CHASE_ENABLED !== "true"`, not by demo-awareness.
5. **Automated solicitor chasing.** `lib/solicitor-confirm/chase.ts` has no `isDemo` (whole dir: zero matches). Same shape, gated only by the `SolicitorChaseSettings` admin switch.
6. **Exchange-day emails.** Not guarded, but not normally reachable (demo never sets `exchangeDayStartedAt`). Lower risk.

**The tour deliberately drives the agent to confirm a milestone (Step 3), so hole #1, #2 and #3 are on the critical path.** The tour cannot ship until they're closed.

**Recommended structural fix (small, one concern):** a single `isDemo` short-circuit at the top of `confirmMilestoneAction` and `reverseMilestoneAction` that skips the outbound block (emails + PostHog + reminder eval) but still writes the `MilestoneCompletion` so the UI updates. Plus `isDemo: false` in the two chase-cron candidate queries as belt-and-braces. This is its **own PR, before the tour** (Law 5). See §16/§17.

---

## 3. Full demo seed audit + compatibility matrix

The demo is **structurally current** — right schema, right enums, no stale shapes, no broken reads. The Overview / Steps / Activity / People / Chain / Documents surfaces are genuinely rich (spread completion dates, varied confirmers, 9 comms including inbound client replies, a full 3-link CLAIMED chain, an attached MOS). **But three tabs render empty**, which directly contradicts the "active, well-maintained sale" premise.

Root cause: `seedMilestones` writes completions with a **direct `prisma.milestoneCompletion.update`** (demo-sale.ts:258-261), bypassing `completeMilestone()` — so **none** of the reminder / chase / task side-effects that a real confirmation produces ever fire. Fairview (seed-demo.ts:943) routes through `completeMilestone()` **and** explicitly seeds reminders / chase states / tasks, which is why it feels complete and the on-demand demo does not.

### Matrix (14 Beaumont Rise)

| Feature / UI area | Seeded? | What appears | Good enough? | What should change |
|---|---|---|---|---|
| Property hero (address, agency, status) | Yes | Full hero, status Active | ✅ | — |
| Price / tenure / purchase type | Yes | £625,000 · Freehold · Mortgage | ✅ | — |
| Target / predicted exchange | Yes | `expectedExchangeDate` (createdAt+84) + `refreshExpectedExchangeDate` | ✅ | — |
| Progress % / on-track | Yes | ~62% from milestones | ✅ | — |
| Property image | Partial | `demo/house.png`, signed at read | ✅ if asset present | Verify object exists per-env; null → gradient fallback (not broken) |
| Managing agent (hero + sidebar) | Partial | Charlotte Hayes; avatar = **public** URL `avatars/demo-agent.png` | ⚠️ | **No null-guard on a public `<img>`** — if not uploaded per env, it breaks. Confirm upload / add fallback |
| Seller / buyer + contacts | Yes | Sarah Whitfield / Daniel Okafor, phones, emails, tokens | ✅ | — |
| Solicitor firms + handlers | Yes | Harpenden & Ellwood / Margaret Ellwood; Verulam Legal / Priya Nair | ✅ | — |
| Milestones both sides + timestamps + confirmers | Yes | ~62%, spread dates, agent/solicitor/portal confirmers | ✅ | — |
| Milestone timeline strip | Yes | Renders across all tabs | ✅ | — |
| Activity feed / notes | Yes | 9 comms incl. inbound replies + internal notes | ✅ (best in class) | — |
| Next-action card | Partial | No reminder → falls back to next milestone ("No reminder yet") | ⚠️ Adequate | Reads far stronger with a live reminder (see P1) |
| **Reminders tab** | **No** | "No active reminders" | ❌ **P1** | Seed 1–2 `ReminderLog` (+`ChaseTask`) on the star file |
| **Chase timeline tab** | **No** | "No chases on this file yet" (this tab **is** shown to the agency on their self-managed demo) | ❌ **P1** | Seed chase threads |
| **To-Do tab** | **No** | Empty | ❌ **P1 (weak)** | Seed 1–2 `ManualTask` |
| Solicitor replies / confirmations | Yes | Portal + solicitor-attributed confirms; inbound client emails | ✅ | — |
| Chain | Yes (rich) | Full 3-link CLAIMED chain, all real files | ✅ | — |
| Fall-through risk / health | Derived | `RiskScoreWidget` computes; `FileHealthBanner` null when healthy | ✅ | Optionally nudge one factor so risk reads non-trivial |
| Documents tab | Partial | 1 MOS on star file | ✅ for star | Ensure `demo/mos.pdf` uploaded per env |
| Broker (Overview `BrokerSection`) | No | Mortgage file → "Add your recommended broker…" prompt | ⚠️ P3 | Seed a broker to avoid an "add me" prompt mid-tour |
| Referral (SolicitorSection) | No | None | Cosmetic | Optional |
| Client portal view | Partial | Milestones + visible updates render; no client-entered deposit/mortgage/SDLT → faded cost card | ⚠️ Acceptable | Optional: seed client cost inputs for a fuller portal step |
| Property intel card | External | Self-fetches Land Registry/EPC by address; fictional AL5 may return nothing → empty card | ⚠️ | Decide: seed cached intel or drop from tour |

---

## 4. Missing / stale demo data

**Nothing stale** (no legacy enums/shapes). The gaps are **unpopulated**, prioritised:

- **P1 — makes the file look inactive (must fix before the tour):** empty Reminders tab, empty Chase timeline, empty To-Do. All stem from `seedMilestones` bypassing `completeMilestone()`. Port the Fairview pattern (route the star file's completions through `completeMilestone`, or explicitly seed `ReminderLog` + `ChaseTask` + one `ManualTask`) into `demo-sale.ts` for the **star file only**.
- **P2 — asset dependencies that render *broken* not just empty:** `avatars/demo-agent.png` is a public URL with no null-guard. `demo/house.png` / `demo/mos.pdf` degrade gracefully. Verify all three exist in every environment the demo runs in.
- **P3 — cosmetic:** broker "add me" prompt on Overview, no referral, no client-entered portal costs, possibly empty `PropertyIntelCard` for the fictional address.

---

## 5. Property-file journey analysis

Route: `/agent/transactions/[id]` → `app/agent/transactions/[id]/page.tsx` (`AgentTransactionDetailPage`), inside `AgentShell`. Zones: hero (`PropertyHero`) → tab strip → always-visible 6-stage milestone strip (`MilestoneTimelineStrip`) → tab content grid.

Tabs (`page.tsx:299`): `overview` (**"Overview"**), `milestones` (**labelled "Steps"**), `reminders`, `chase` (conditional), `todos`, `documents`, `activity`, `whatsapp` (internal only). Switching is client `useState` in `PropertyFileTabs` (line 50), **also drivable programmatically via `TabContext.setActiveTab`** (`TabContext.tsx`) — the key hook for the tour. All panels are always mounted (inactive = `opacity-0 absolute inset-0 pointer-events-none`), so a tour can pre-measure anything.

Mapping the seven questions to real surfaces:

| # | Question | Surface |
|---|---|---|
| 1 | Where is this sale now? | Hero (status pill + % bar + on-track) + 6-stage strip |
| 2 | What has happened? | Activity & notes card (Overview) / Activity tab |
| 3 | What are we waiting for? | Next-action card (`NextActionCard`, "Waiting on: …") |
| 4 | What is TSP doing for me? | **Chase timeline tab** — auto vs manual chases + escalation ladder (strongest differentiator) |
| 5 | What can my clients see? | People card → Clients (portal invite state + "last viewed portal") |
| 6 | What needs my attention? | File-health banner + Reminders (badge + Up-next) |
| 7 | What does TSP know I'd otherwise work out? | Fall-through risk widget + predicted-exchange + chain spine |

**Stable anchors already in the DOM:** `glassId` on cards (`property-hero`, `milestone-timeline`, `overview-next-action`, `overview-risk`, `overview-reminders`), `id="risk-score"`, `id="chain-section"`, `role="list" aria-label="File progress stages"`, `.agent-tab` buttons with `aria-selected`. Sparse elsewhere → the tour will add a few `data-tour="…"` hooks.

**Gating caveat:** the **Chase timeline tab only renders** for Ellis **or** an agency user on their **own self-managed** file (`page.tsx:294`). The demo is self-managed, so on the demo it **is** present for the agency — good. But the tour engine must still read the live tab set rather than assume a fixed list (an outsourced real file wouldn't have it).

---

## 6. Recommended tour concept

**A spotlight walkthrough that runs *inside* the real file**, not an overlay pretending to be the product.

- The demo file opens normally. A small welcome moment (not a big modal) says one line, then the walkthrough begins.
- Each step: the real UI comes into focus — TSP switches a tab or smooth-scrolls to a real component, **dims the surrounding file** (frosted, not black), draws a **soft spotlight ring** around the real seeded element, and floats a **small guide card** near it with one sentence and a single **Continue** (or an action prompt).
- **Every movement follows an explicit user action.** No auto-advance, no carousel, no tab changing while they read.
- **Hybrid interaction:** early steps, TSP drives the movement (feels impressive). Middle step, the agent performs **one** real action (confirm a demo milestone — safe once §2 is fixed) so they learn where things live. No fake admin work.
- The guide card is the **only** new visual surface. It uses existing glass tokens so it still looks exactly like TSP — no separate onboarding visual language.

The explanatory UI is small:

```
┌────────────────────────────────┐
│ 3 of 6   What we're waiting on  │
│ TSP keeps the single next       │
│ action in view, and who it's    │
│ waiting on.                     │
│                                 │
│ Skip tour            Continue → │
└────────────────────────────────┘
```

Reuse, don't reinvent: `createPortal(→ document.body)`, the existing `agent-backdrop-overlay` dim class, `scrollIntoView({behavior: reducedMotion ? "auto" : "smooth"})` (the `PolicyShell.tsx:120` pattern), motion tokens from `design/tokens.ts`, and `TabContext.setActiveTab` for tab jumps. The **only net-new piece** is the "highlight one element + anchored callout + cut-out dim" component — no such spotlight exists today (only the centered-modal `TourSlides.tsx`).

---

## 7. Exact tour story / steps

Six steps. Every stop is a **real seeded element** on the demo. One deliberate tab jump (to Chase), one agent-performed action (confirm a milestone).

1. **Orientation** — Hero. "This is a live example sale. We'll show you how we'd keep it moving."
2. **Where the sale stands** — 6-stage milestone strip. What's done, what's next, always visible.
3. **What we're waiting on** — Next-action card. The single next action + who we're waiting on. *(Agent performs the action here — see §8.)*
4. **TSP working for you** — jump to Chase timeline tab. Auto vs manual chases + escalation ladder. The strongest beat.
5. **What needs you vs what we handle** — Fall-through risk widget. We flag danger before you'd spot it, separate from step progress.
6. **What your clients see** — People card (Clients). Portal invite state + "last viewed portal", with a real "Copy portal link" to open the actual portal. Finish here.

Finish card CTA: primary **"Add my first sale"**, secondary **"Keep exploring the demo"**.

Chain spine is an **optional Step 5.5** (`id="chain-section"`) if you want the onward/related story — recommend holding it out of the default six to keep momentum (see §19).

---

## 8. Per-step detail

Format per step: **where we are · UI target · what the screen does · what the agent does · microcopy · transition · why it earns its place.**

### Step 1 — Orientation
- **Where:** Overview tab (default landing).
- **Target:** hero card (`glassId="property-hero"` → add `data-tour="hero"`).
- **Screen:** file fades in; after ~500ms the rest of the page dims to a frosted veil, a soft ring settles around the hero; guide card floats bottom-left of the hero.
- **Agent does:** reads; clicks **Continue**.
- **Microcopy:** *"This is a live example sale — 14 Beaumont Rise. We'll show you how we'd keep it moving. Take a look around any time; it's just sample data."*
- **Transition:** dim lifts from hero, scroll nudges down to the milestone strip, ring re-forms.
- **Why:** answers "where am I / is this real?" in one beat and sets the "sample data, you're in control" frame.

### Step 2 — Where the sale stands
- **Where:** Overview.
- **Target:** 6-stage strip (`role="list" aria-label="File progress stages"` → `data-tour="stage-strip"`).
- **Screen:** smooth-scroll so the strip is centred; spotlight the strip; guide card above it.
- **Agent does:** Continue.
- **Microcopy:** *"The whole journey, always in view — instructed through to completion. Green is done, coral is live, the rest is forecast."*
- **Transition:** scroll to the next-action card.
- **Why:** "where is this sale now" at a glance; teaches that the strip follows them on every tab.

### Step 3 — What we're waiting on *(agent action)*
- **Where:** Overview.
- **Target:** next-action card (`glassId="overview-next-action"` → `data-tour="next-action"`).
- **Screen:** spotlight the card; guide card points at the "Mark complete" control.
- **Agent does:** clicks **Mark complete** on the seeded live reminder (safe once §2 lands — no email, no PostHog, no real reminder). The tick animates (`AnimatedTick`), the card advances to the next action. Tour detects the confirm and reveals **Continue**.
- **Microcopy (before):** *"We keep one next action in view, and who it's waiting on. Try it — mark this one done."* **(after):** *"That's it. The sale moves on and the next action steps up."*
- **Transition:** dim holds; TSP switches to the **Chase timeline** tab (`setActiveTab("chase")`) with a 280ms cross-fade.
- **Why:** the one hands-on moment — they learn where the primary action lives and feel the file respond. Highest-retention beat.
- **Depends on:** §2 safety fix + a seeded reminder (P1).

### Step 4 — TSP working for you
- **Where:** Chase timeline tab (TSP switched it).
- **Target:** the chase thread list (`ChaseTimeline` → `data-tour="chase-threads"`).
- **Screen:** tab content fades in; spotlight the thread list + the escalation-path ladder in the detail pane; guide card to the side.
- **Agent does:** Continue (optionally: "click a thread to see its history" as a soft, skippable prompt).
- **Microcopy:** *"Behind every step, we're chasing the right person — automatically first, escalating to you only when it matters. You're not the one remembering to nudge the solicitor."*
- **Transition:** TSP switches back to Overview, scroll to the risk widget.
- **Why:** the single most persuasive "it's not just a dashboard, it's working" moment; the tab jump itself is the demonstration. **Depends on:** seeded chase threads (P1).

### Step 5 — What needs you vs what we handle
- **Where:** Overview.
- **Target:** risk widget (`id="risk-score"` / `glassId="overview-risk"` → `data-tour="risk"`).
- **Screen:** scroll + spotlight; guide card names one triggered factor.
- **Agent does:** Continue.
- **Microcopy:** *"We score fall-through risk from what's actually happening on the file — separate from progress — so a sale that's on step but going quiet still gets flagged."*
- **Transition:** scroll to the People card.
- **Why:** "what does TSP know that I'd otherwise work out" — intelligence, not data entry. **Reads best if** one risk factor is non-trivial (P3 nudge).

### Step 6 — What your clients see *(finish)*
- **Where:** Overview, People card (Clients toggle) → `data-tour="people-clients"`.
- **Screen:** spotlight the client rows showing invite state + "last viewed portal"; guide card points at "Copy portal link".
- **Agent does:** optionally clicks **Copy portal link** (opens the real portal in a new tab — read-only, safe); then **Finish**.
- **Microcopy:** *"Your buyer and seller see this progress in their own portal — no chasing you for updates. You can even see when they last looked."*
- **Finish card:** *"That's the file. Add a real sale and we'll start building this for you."* — primary **Add my first sale** (→ `/agent/transactions/new`), secondary **Keep exploring the demo** (dismiss, stay on the file).
- **Why:** closes on client value + a clear next action; the portal link is a real, safe interaction.

---

## 9. Motion specification

Restrained, premium, same language as the app. Reuse `design/tokens.ts` motion tokens — **do not add a dependency** (framer-motion is deliberately not in the stack, `MOTION_GUIDE.md:138`).

- **Tab / step cross-fade:** 280ms `cubic-bezier(0.22,1,0.36,1)` (matches account-shell + modal-in family).
- **Smooth-scroll to target:** `scrollIntoView({behavior: "smooth", block: "center"})`, `"auto"` under reduced motion (`PolicyShell.tsx:120` pattern).
- **Dim veil:** reuse `agent-backdrop-overlay`, fade in 200ms (`backdropIn`). Frosted (backdrop-filter blur), **not black** — surrounding file stays faintly legible. Cut-out achieved with a spotlight ring, not a hard mask.
- **Spotlight ring:** a soft coral-tinted box-shadow/glow around the target's bounding box, 220ms ease-in, gently repositions (240ms) when the target changes. No pulsing, no bouncing arrows, no hotspots.
- **Guide card:** fade-up 200ms (reuse the `SectionReveal` feel), repositions with a 240ms ease when it moves between targets.
- **Tick on confirm:** existing `AnimatedTick` (`.todo-tick-path` stroke-draw).
- **Banned:** confetti, cartoon bounces, pulsing dots, auto-advancing carousels, anything that reads as "the site took over the computer."

The guide card and spotlight are the **only** new motion; everything else is a reuse of shipped primitives.

---

## 10. Mobile / responsive behaviour

The file layout changes materially below `lg` (`PropertyFileTabs:196`): desktop = content + sticky 288px sidebar; tablet = sidebar collapses to a "File details" accordion; mobile = sidebar inline, hero photo becomes a top strip, stat row → 2-col grid, tab bar scrolls horizontally and **auto-scrolls the active tab into view**.

Tour adaptations:

- **Guide card docks to the bottom** on `< md` (a bottom sheet, mirroring `PartnerPopup`'s ≤640px behaviour), instead of floating beside the target — a floating callout beside a narrow element is unusable on mobile.
- **Spotlight still rings the real element**, but the tour first scrolls it fully into view (accounting for the sticky tab bar `top-0 z-20` and, on tablet, the collapsed sidebar).
- **Tab targets** may be off-screen in the horizontal tab scroller — the tour must scroll the tab bar so the target tab is visible before spotlighting (the file already does this for the active tab).
- **Step 4's tab jump** works identically (state-driven), but on mobile the Chase timeline grid stacks — spotlight the thread list, skip the side-by-side detail-pane framing.
- Keep step count to six on mobile too; do not add mobile-only steps.

---

## 11. Accessibility / reduced motion

- **Reduced motion:** honour `prefers-reduced-motion` via `matchMedia` for JS-driven movement (the `PageFadeIn`/`SectionReveal` pattern) **and** swap scroll `behavior` to `"auto"`. Under reduced motion: no spotlight glow animation (instant ring), no scroll animation (instant jump), no cross-fade (instant tab swap). The tour still works, just without motion.
- **Focus management:** on each step, move focus to the guide card heading (like `Modal.tsx` initial-focus), restore focus on exit. Continue/Skip are real buttons, keyboard-reachable, visible focus ring.
- **Escape** exits the tour (same as modal convention). **Tab** cycles within the guide card while a step is active; the dimmed file is `aria-hidden` during a step so a screen reader isn't lost in dimmed content — except the spotlighted target, which stays in the a11y tree.
- **Announce steps:** `aria-live="polite"` region announces "Step 3 of 6, What we're waiting on" so non-visual users track progress.
- **z-index:** the guide card + veil must render at the `escalated` rung (1500) to clear the top bar (200) and sidebar (100) — a `default` (50) portal sits *below* nav (`Modal.tsx:56`, the known gotcha).
- **Contrast:** guide card meets AA on the frosted veil in both themes (theme-aware tokens).

---

## 12. Technical architecture

A **component-level tour engine**, not six `setTimeout`s and not brittle global DOM selectors.

**Model — a declarative step machine:**

```
type TourStep = {
  id: string;                      // "waiting-on" (stable, for analytics)
  tab?: TabKey;                    // pre-action: ensure this tab is active
  target: string;                  // data-tour value, e.g. "next-action"
  placement: "auto" | "bottom" | ...;
  copy: { title: string; body: string; actionHint?: string };
  userAction:                      // what advances the step
    | { kind: "continue" }
    | { kind: "confirm-milestone" }   // waits for the real confirm event
    | { kind: "click-target" }        // agent clicks the spotlighted thing
    | { kind: "optional", then: "continue" };
  onEnter?: () => void;            // e.g. setActiveTab(tab)
};
```

**Driver:** a `<DemoTourProvider>` mounted inside the file page (so it can consume `useTabContext()` and drive `setActiveTab`). It:
- resolves each `target` via `data-tour="…"` attributes (stable, survive re-render and responsive reflow — **not** class/nth-child selectors);
- waits for the target to be **mounted and measured** before spotlighting (ResizeObserver / `requestAnimationFrame` poll with a timeout — panels are always mounted but may be laid out late);
- recomputes the spotlight rect on scroll/resize (ResizeObserver + a throttled scroll listener);
- renders veil + ring + guide card through `createPortal(document.body)` at z 1500;
- advances only on the declared `userAction` (Continue click, or a real confirm event surfaced via a callback/event the confirm action already emits, or a click on the target).

**Why data-attributes over DOM selectors:** the audit found sparse ids; class/structure selectors break under the responsive reflow (sidebar collapse, tab reorder, hidden-but-mounted panels). A handful of `data-tour` hooks on the hero card, stage strip, next-action card, chase thread list, risk widget and people card is the robust, low-touch approach. These are added to existing components, not new wrappers.

**Robustness the engine must survive** (all called out because the file does each of them): responsive layout change, slow render, target not yet mounted, tab change, drawer opening, sticky scroll containers, the agent clicking elsewhere, refresh, exiting halfway, and the demo being removed. Strategy: every step is idempotent and re-entrant; if a target can't be resolved within a timeout, the step **degrades** (skip to next, or end gracefully with the finish card) rather than freezing (see §15).

**Do not** inject state into drawers/modals — they're controlled by their own local `useState` (hero `switchModalOpen`, sidebar `_sessionSidebarOpen`). The tour drives them by **clicking the real trigger**, never by reaching into their state.

---

## 13. Tour state / persistence

Three layers:

1. **Has the agent seen the tour?** Persist on **`User`** (new nullable `demoTourCompletedAt` / `demoTourSkippedAt`, or a single `demoTourState` enum). User-level (not Agency) because each teammate should get their own first-run. This drives auto-start (first demo open only) and the "Replay tour" affordance.
2. **In-progress step (resume):** `localStorage` keyed by user+demo tx id (`demoTour:{userId}:{txId}` → step index). Survives refresh without a DB write per step. Cleared on finish/skip.
3. **Ephemeral runtime:** React state in the provider (current step, spotlight rect, veil on/off).

Decisions this encodes (confirm in §20):
- **Auto-start** on the *first* demo open only; thereafter opening the demo just opens the file, with a persistent, low-key **"Replay walkthrough"** control on the `DemoFileMarker` pill/popover.
- **"Explore demo sale" clicked again** → opens the demo (existing reuse behaviour); does **not** force-restart the tour. Restart is explicit via Replay.
- **First visit vs later** distinguished by `demoTourCompletedAt/SkippedAt` being null.

---

## 14. Analytics

Reuse PostHog via `track()` (client) / `trackServerEvent()` (server) and the `ANALYTICS_EVENTS` taxonomy (`lib/analytics/events.ts`, `noun_verb` snake_case). **Client-fired events must be added to `ALLOWED_EVENT_NAMES` and any new prop to `ALLOWED_PROPS` in `lib/analytics/posthog.ts` or they are silently dropped.**

Events (client-side, since the tour is client-driven):

| Event | When | Props |
|---|---|---|
| `demo_opened` | demo file opened | `source` (cta origin), `isFirstOpen` |
| `demo_tour_started` | tour begins | `source`, `totalSteps` |
| `demo_tour_step_viewed` | step shown | `stepId`, `stepNumber`, `totalSteps` |
| `demo_tour_step_completed` | step advanced | `stepId`, `stepNumber`, `interactionType` (`continue`/`action`/`click`) |
| `demo_tour_skipped` | Skip/Escape | `stepId`, `stepNumber` |
| `demo_tour_completed` | Finish | `totalSteps` |
| `demo_first_real_sale_after_tour` | real sale created after a completed/ skipped tour | `stepsCompleted`, `didFinish` (fire from `transaction_created` path when the user has tour state) |

Props to sanction in `ALLOWED_PROPS`: `stepId`, `stepNumber`, `totalSteps`, `interactionType`, `source`, `isFirstOpen`, `stepsCompleted`, `didFinish`. Add a sanctioned **`deviceClass`** prop if you want mobile/desktop split on these events (no shared device-class helper exists today — it'd be a small addition; PostHog autocapture's `$device_type` covers it loosely but not on server events).

**Contamination:** these `demo_*` names are distinct from every real funnel, so they can't pollute product/sale dashboards **as long as we never reuse a real event name for a demo interaction**. There is **no central `isDemo` filter** in the analytics layer today — the precedent is per-callsite gating (`transactions.ts:982`). Keep demo analytics in its own event namespace; do not route demo interactions through real event names.

---

## 15. Failure / fallback behaviour

Every failure ends *gracefully*, never traps the agent:

- **Target never mounts / not found within timeout (~1.5s):** skip that step; if it's a pivotal step (3/4), fall through to the finish card. Log `demo_tour_step_skipped` with a `reason`.
- **Chase tab absent** (shouldn't happen on the self-managed demo, but defend): drop Step 4, renumber (`totalSteps` computed from resolvable steps at start).
- **Agent clicks elsewhere / opens a drawer mid-step:** the veil is non-blocking for the spotlighted element only; if they navigate away, the tour pauses and offers Replay rather than fighting them.
- **Refresh mid-tour:** resume from `localStorage` step, or if the file changed, restart cleanly from step 1.
- **Demo removed / real sale added mid-session:** provider detects `isDemo` gone → dismiss silently.
- **Reduced motion / JS disabled:** tour degrades to instant transitions; if the engine can't init at all, the file is fully usable without it (the tour is additive, never a gate).
- **Confirm action fails (Step 3):** show the error inline (existing confirm error handling), keep Continue available so the tour isn't stuck on a failed write.
- **Seed gap not yet fixed** (defensive): if a spotlighted panel is empty, the step still shows copy but the engine notes the empty target — this is why §16 seed fixes are a hard prerequisite, not a nice-to-have.

---

## 16. Demo seed changes required (prerequisite PRs)

Before the tour can be built, two changes to the demo itself:

**A. Safety short-circuit (own PR — §2):**
- `confirmMilestoneAction` / `reverseMilestoneAction`: early `isDemo` branch that writes the completion but skips the outbound block (milestone emails, counterpart/completion/exchange emails, `MILESTONE_CONFIRMED`/`_UNCONFIRMED` PostHog, `evaluateTransactionReminders`).
- `client-chase-cron.ts` + `lib/solicitor-confirm/chase.ts`: add `isDemo: false` to candidate queries.
- Optional belt: `@example.com` blocklist in `lib/email.ts` as a final backstop.

**B. Seed enrichment (own PR — §3/§4 P1):** in `demo-sale.ts`, for the **star file only**, produce the three empty tabs:
- 1–2 `ReminderLog` (+ matching `ChaseTask`) so Reminders + the next-action card are live.
- Chase threads so the Chase timeline renders (route the star file's completions through `completeMilestone()` **after** the safety fix so it auto-creates them without sending, or seed `ChaseTask`/`ClientChaseState` directly).
- 1 `ManualTask` (To-Do).
- Optionally: a broker (kills the "add me" prompt), one non-trivial risk factor, and cached property intel.
- Verify `avatars/demo-agent.png`, `demo/house.png`, `demo/mos.pdf` exist per environment; add a null-guard/fallback on the agent avatar `<img>`.
- **D7 — restore the ~1-week expiry:** set `demoExpiresAt` to `createdAt + 7d` in `buildDemoFile` (replacing the deliberate `null`), and update SPEC.md so code + spec agree. The `demo-cleanup` cron already deletes expired demos, so no cron change is needed. Confirm the "Explore demo" affordance reappears once the demo is gone and no real sale exists.

**C. `data-tour` anchors (part of the tour PR):** add `data-tour="…"` to hero card, stage strip, next-action card, chase thread list, risk widget, people-clients — small edits to existing components.

---

## 17. Implementation sequence

1. **PR 1 — Demo safety.** §16A. Ships independently; valuable on its own (stops bouncing SendGrid sends + PostHog pollution the moment anyone confirms a demo milestone). Tests: confirming a demo milestone sends no email, fires no PostHog, writes no reminder.
2. **PR 2 — Demo seed enrichment.** §16B. Reminders/Chase/To-Do populated on the star file; assets verified. Screenshot every tab of the demo showing no empty states.
3. **PR 3 — Tour engine (headless).** Provider + step machine + spotlight/veil/guide-card component + `data-tour` anchors + reduced-motion + fallbacks. Rendered in isolation (a `/dev` harness) first.
4. **PR 4 — Wire the six steps + auto-start + Replay + persistence** (`User` fields migration to staging first, Law 3).
5. **PR 5 — Analytics** (`demo_*` events + allow-list additions).
6. **PR 6 — Mobile pass + a11y pass + polish.**

Each PR is one concern (Law 5). Migration (User tour fields) → staging first (Law 3).

---

## 18. Tests

- **Safety (PR1) — highest value:** unit/integration asserting `confirmMilestoneAction` on an `isDemo` tx enqueues **no** SendGrid send, fires **no** PostHog, writes **no** `ReminderLog`; and that the two chase crons exclude `isDemo`.
- **Seed (PR2):** after `createDemoSale`, the star file has ≥1 `ReminderLog`, ≥1 chase thread, ≥1 `ManualTask`; Playwright loads each tab and asserts no empty-state string.
- **Engine (PR3):** step machine advances only on the declared action; target resolution times out → graceful skip; reduced-motion path uses instant transitions; z-index clears nav.
- **Journey E2E (PR4):** Playwright happy path — open demo → tour auto-starts → walk 6 steps (including the confirm at step 3 and the tab jump at step 4) → finish → "Add my first sale" routes correctly. Desktop 1280 + mobile 375 (Law 17/18).
- **Persistence:** second demo open does not auto-start; Replay does; refresh mid-tour resumes.
- **Analytics:** each step fires the right `demo_*` event with sanctioned props; nothing lands on a real event name.

---

## 19. What should NOT be in the tour

- **Documents, To-Do, WhatsApp tabs** as their own stops — dilute the "aha" (WhatsApp is internal-only and won't even render for director/negotiator).
- **Reminders as a separate stop** — the next-action card already conveys it.
- **Sidebar fee / file-time details** — not a differentiator.
- **Email-settings drawer, status control, service switch** — admin surfaces, not story beats.
- **Chain spine** — genuinely strong, but including all seven beats risks momentum. Recommend holding it as an **optional** step or folding one line about the chain into Step 1's hero (the chain node is visible there). Decision D4.
- **No fake admin work** beyond the single, real, safe milestone confirm.
- **No auto-advancing anything.**

---

## 20. Decisions — LOCKED (2026-09-02)

- **D1 — Backdrop.** ✅ On-demand demo (14 Beaumont Rise). Confirmed.
- **D2 — Safety fix.** ✅ Approved as PR1, independent of the tour.
- **D3 — The one agent action.** ✅ Yes — Step 3 has the agent confirm a demo milestone (safe once PR1 lands).
- **D4 — Step count.** ✅ Six steps. Chain gets a one-liner in Step 1, not its own stop.
- **D5 — Auto-start.** ✅ Auto-start on first demo open only; a "Replay walkthrough" control thereafter.
- **D6 — Tour state home.** ✅ `User` fields (per-teammate first-run).
- **D7 — Demo lifecycle.** ✅ **Demo expires after ~1 week** (restore `demoExpiresAt`; the `demo-cleanup` cron already deletes on expiry). Rationale (founder): by then they'll have added a real sale and the demo affordance is gone anyway; if they haven't, the demo clears and the "Explore demo" button reappears (original SPEC behaviour). The tour must therefore handle a demo that can vanish (§15 already covers this).
- **D8 — Device-class analytics.** ✅ Yes — add a sanctioned `deviceClass` prop to the `demo_*` events.
- **D9 — Portal step depth.** ✅ Keep the real "Copy portal link" that opens the live portal in a new tab.

---

## 21. Storyboard table

| Step | Screen / tab | Target | Screen movement | User action | Message | Product lesson |
|---|---|---|---|---|---|---|
| 1 | Overview | Hero (`data-tour="hero"`) | File fades in → dim veil → ring on hero, guide card bottom-left | Continue | "This is a live example sale — 14 Beaumont Rise. We'll show you how we'd keep it moving." | This is a real file; you're in control |
| 2 | Overview | 6-stage strip (`stage-strip`) | Smooth-scroll strip to centre, spotlight | Continue | "The whole journey, always in view — green done, coral live, the rest forecast." | Where the sale stands, at a glance |
| 3 | Overview | Next-action card (`next-action`) | Spotlight card, point at Mark complete | **Marks the reminder complete** → tick animates, card advances | "We keep one next action in view, and who it's waiting on. Try it." | The next action + who we're waiting on |
| 4 | Chase timeline (TSP switches) | Thread list (`chase-threads`) | Cross-fade to Chase tab, spotlight threads + escalation ladder | Continue | "We chase the right person automatically, escalating to you only when it matters." | TSP is working the file, not just showing it |
| 5 | Overview | Risk widget (`risk`) | Scroll back, spotlight risk score | Continue | "We score fall-through risk from what's happening — separate from progress." | TSP knows what you'd otherwise work out |
| 6 | Overview | People / Clients (`people-clients`) | Scroll to People, spotlight client rows + Copy portal link | Copy portal link (optional) → **Finish** | "Your clients see this progress in their own portal — and you can see when they last looked." | Clients stay informed without chasing you |
| Finish | Overview | Guide card (centred) | Veil lifts | Add my first sale / Keep exploring | "That's the file. Add a real sale and we'll start building this for you." | Convert to a real sale |
