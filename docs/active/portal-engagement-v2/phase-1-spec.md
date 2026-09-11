# Portal Engagement v2 — Phase 1 build spec

**Status:** draft for founder review · created 2026-09-11
**Arc:** Portal Engagement v2 (audit → strategy → prototype → build)
**Prototype (approved placement):** returning-client recap sits *below the photo hero, above Progress overview*.
**This phase only:** the return payoff (the recap) + the minimum measurement to judge it. Notifications/install (Phase 2) and contextual services + Command Centre views (Phase 3) are out of scope here.

---

## 1. Why this phase, and its one rule

The audit could not attribute returns to anything — no client-email click tracking, no per-section view data, visit history only day-grain and only since 2026-08-13. So the rule for Phase 1 is: **ship the approved recap and wire the measurement in the same phase**, or we ship blind on a ~120-client pilot and learn nothing.

Success is judged on: does a returning client now land on "what changed / what's next / what's needed", and does that lift **return→action** and **repeat visits**. Both become measurable only once §3 lands.

## 2. Laws / constraints touched

- **Law 3 (migrations staging-first):** §4 adds `EventType` enum values. Apply to staging Supabase (`etidawkbqctarmsdjoxp`), verify, then production. Filename `YYYYMMDDHHMMSS_portal_engagement_events`.
- **Law 1 (source-of-truth first):** this doc is that source. Cite it in each PR.
- **Law 21 (voice gate):** all client-facing strings in §5 must pass `docs/reference/VOICE.md` (no em-dashes, no exclamation marks, no "the system"/"automatically", use "we'll"). Copy below is written to that bar but must be re-checked at PR time.
- **Law 5 (one concern per PR):** the steps below are deliberately separate PRs.
- **Law 4 (extend, don't duplicate):** measurement reuses the existing `Event` table + `recordEvent` (`lib/command/events/write.ts`), not a new store. No PostHog.

## 3. Measurement model (how client events fit the existing Event table)

`Event` (`prisma/schema.prisma:2742`) is user-centric: `agencyId`, `userId`, `isInternalUser`, `type` (enum), `entityType`, `entityId`, `metadata`. Clients are **not** `User` rows, so client/portal events map as:

- `type` = one of the new enum values (§4)
- `entityType` = `"Contact"`, `entityId` = `contact.id`
- `userId` = null, `isInternalUser` = false
- `agencyId` = the file's agency (so Command Centre scoping/filtering works)
- `metadata` = `{ transactionId, side: "vendor"|"purchaser", ...event-specific }`

**Every event carries `side` in metadata** so buyer vs seller can be split later (the single biggest gap in today's Command Centre). Volume at pilot scale is negligible; revisit sampling only if the table grows large.

A thin wrapper keeps call sites clean and guarantees the shape:

```ts
// lib/services/portal-events.ts  (new)
recordPortalEvent({
  type, contact /* {id, roleType, transaction:{id, agencyId}} */, metadata?
})
// → recordEvent({ type, entityType:"Contact", entityId:contact.id,
//     agencyId, isInternalUser:false, metadata:{ transactionId, side, ...} })
```

## 4. Migration — new EventType values (PR1, backend only, NOT client-visible)

Add to `enum EventType` (`prisma/schema.prisma:2697`). Phase-1 set only (Phase 2/3 add their own later):

```
// Portal engagement (client-side)
portal_returned          // a return visit (2nd+ distinct day), emitted from the visit path
portal_section_viewed    // overview / progress / updates tab opened
portal_recap_item_clicked
portal_action_confirmed  // client confirmed a step (mirrors milestone_confirmed but client-attributed intent)
portal_service_surfaced  // a service card was shown (survey/broker)
portal_service_clicked   // a service card was tapped
```

**Steps:** edit schema → `npx prisma migrate dev` on staging → `npx prisma generate` → verify enum on staging DB → prod via `migrate deploy` (Vercel) after staging is green. No UI. Nothing for the founder to review visually.

## 5. The recap — "Since you were last here" (PR3, CLIENT-VISIBLE — review on staging)

**Placement.** Immediately after the photo hero, before the Progress-overview stepper. These two are currently composed in one `overviewHero` block (`app/portal/[token]/page.tsx:597`). **Structural decision (recommended): split `overviewHero` into `heroPhotoCard` + `progressOverviewCard`** and render the recap between them. Do not restyle either sub-card. If splitting proves risky, fallback is to inject the recap as the block's first child between its two sub-cards — same visual result.

**Data.** No new data or migration. Reuses:
- `contact.lastVisitedPortalAt` (already selected)
- the existing newness computation (`page.tsx:136-138`: `isNew = createdAt > lastVisit`, `newCount`)
- the existing timeline (`getPortalTimeline`) and next-action (`nextAction`, `page.tsx:126-127`)

**Behaviour (three states — all in the approved prototype):**
1. **Something needs them** — a top "Needed from you" row (the next client-confirmable milestone, `who === "you"`), plus up to 2 recent changes. Confirm reuses `portalConfirmMilestoneAction` (same call as `PortalNextActionCard`).
2. **Progress only** — up to 2 recent changes, no action row.
3. **All caught up** — when `newCount === 0` and nothing is waiting, the block **renders nothing** (or a single quiet "you're up to date" line). The portal must stay calm; this is non-negotiable.

**Rules:**
- First-ever visit (`lastVisitedPortalAt` null): render nothing (matches current null-suppression).
- Each change item links to its timeline entry / the relevant Progress step. The action row links to the confirm sheet.
- Newness is derived at render as today; **no new "seen" state is stored** in Phase 1.

**Emits:** `portal_recap_item_clicked` (per item tap), `portal_action_confirmed` (on confirm).

**Client-facing copy (voice-pass at PR time):**
- Eyebrow: `Since you were last here`
- Relative time: `since {weekday}` / `since {date}`
- Action pill: `Needed from you`
- Foot link: `View all updates`
- Caught-up line (if shown): `You're all caught up. Nothing new since {when}.`

## 6. Updates-tab unread badge (PR4, CLIENT-VISIBLE — review on staging)

Today `PortalShell.tsx:144-148` only ever *clears* the OS badge on open; the in-app Updates tab never signals unread. Change: when `newCount > 0`, show a count badge on the Updates bottom-nav item (`PortalShell.tsx:282-298`). Clear it when the client opens the Updates tab, not merely on portal open. Keep the OS-badge clear behaviour. Emits nothing new (covered by `portal_section_viewed`).

## 7. Emit points for the passive events (PR2, backend only, NOT client-visible)

- `portal_returned` — in the visit path (`app/portal/[token]/layout.tsx:93-122`), inside the existing 5-min debounce, only when this is a 2nd+ distinct `PortalVisit` day for the contact (so it means "returned", not "first visit").
- `portal_section_viewed` — on Overview / Progress / Updates render (`page.tsx`, `progress/page.tsx`, `updates/page.tsx`), debounced per tab per session.
- `portal_service_surfaced` — where the survey/broker cards decide to render (`page.tsx` `showSurveyQuote` / `showBrokerCard`).
- `portal_service_clicked` — on the survey card `Link` and the broker card CTA.

All via `recordPortalEvent`, best-effort, never blocking render.

## 8. PR sequence + what the founder reviews

| PR | Title | Client-visible? | Founder review on staging |
|----|-------|-----------------|---------------------------|
| 1 | `portal: add engagement EventType values (staging→prod)` | No | Confirm migration applied clean on staging DB; no UI change |
| 2 | `portal: emit passive engagement events` | No | Nothing visual; spot-check `Event` rows appear on staging with correct `side`/`transactionId` |
| 3 | `portal: "since you were last here" recap` | **Yes** | **Review on staging:** placement below hero/above progress, all 3 states, calm when nothing new, confirm flow works, voice-passed copy |
| 4 | `portal: unread badge on Updates tab` | **Yes** | **Review on staging:** badge shows when new, clears on opening Updates |

PR3 and PR4 are the only ones you look at; 1 and 2 are plumbing you verify by querying the staging DB.

## 9. Verification (staging)

- After PR1: enum values present; `recordPortalEvent` writes a test row.
- After PR2: open a staging portal a few times across days → `portal_returned`, `portal_section_viewed` rows exist with `metadata.side` set; service cards produce `portal_service_surfaced`.
- After PR3/PR4: walk the three scenarios on a real staging file; confirm a step and see it reflected; confirm the recap disappears when caught up.
- `npx tsc --noEmit` clean before each commit (Law 2).

## 10. Success metrics (read once ~2–4 weeks of post-ship data exist)

- **Return→action rate:** of `portal_returned` sessions, share that produce a `portal_action_confirmed` or `portal_recap_item_clicked`.
- **Repeat visits:** distinct `PortalVisit` days per contact, buyer vs seller, before/after ship.
- Guardrail: no rise in "gone quiet" (`portal_gone_quiet`) and no drop in time-to-first-action.

Caveat: pilot N is small; read as direction, evaluate sequentially (before/after), not as a powered A/B.

## 11. Decisions (resolved 2026-09-11)

1. **Recap seam:** SPLIT `overviewHero` (§5) — approved, on the condition it is **visually identical to the client** (no change to how either the photo hero or the Progress-overview card looks or behaves; the split is internal only).
2. **Household concept:** SET UP NOW. Define "side engaged = any principal on that side engaged". Phase 1 stores `side` on every event (§3) and adds the helper; Phase 2/3 consume it for nudge-suppression + activation counting.
3. **Recap item cap:** 2 changes shown.

## 12. Out of scope (later phases)

- Phase 2: install-led notification/PWA rework (`PortalOnboardingToasts.tsx`), fix permanent-dismiss, value-moment timing.
- Phase 3: survey top-of-funnel diagnosis + trust copy; Command Centre buyer/seller/household splits and the survey shown→requested→booked funnel; email→portal click redirect (coordinated with the separate client-email overhaul).
