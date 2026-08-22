# Onward-Purchase Visibility — Discovery & Open Decisions (spec v0)

Status: **DISCOVERY. Nothing agreed. Nothing built.** This document maps current
reality and lays out every decision the logic hangs off. Each decision is marked
**OPEN** with a recommendation. We agree the logic here before any code.

Author: session 2026-08-22, from Ellis's note.

---

## The note this came from

> If seller has onward but agent above not claimed, allow them to confirm steps so
> we have an idea of their onward. Logic to agree before building. First thought:
> what if agent above our sale claims — do they inherit the progress confirmed by
> seller? They should get the notifications as well as us? They catch up on the
> buyer's side upon claim (is that already in place)? What questions do we need to
> ask to get to the bottom of the logic — so much that would hang off it.
>
> A few agents have said on their outsourced files it would be good to see where
> their onward is. If agent above doesn't claim, the buyer's side won't get filled
> in, but that doesn't stop them confirming practically the same steps our buyer
> would (though they'd have to confirm what type of property it is and purchase
> method otherwise we won't know what steps).

---

## Part 1 — Current-state ground truth (verified against code, 2026-08-22)

Every claim below is evidenced by file:line. This is what is *actually* real, not
what the specs say should be real.

### 1.1 What a "chain" is, structurally

- A chain is a set of **separate `PropertyTransaction` files**, linked only by an
  integer `position` inside a shared `chainId`. There is **no** FK between two
  transactions (no `onwardTransactionId`, no `purchaseTransactionId`). Verified:
  `prisma/schema.prisma` `PropertyChain` (1654), `ChainLink` (1671),
  `PropertyTransaction.chainLinkId` (450).
- **Position 0 = top of chain = the final seller with no onward above them.**
  Lower position = up the chain ("the agent above" / the seller's onward purchase).
  Higher position = down the chain (our buyer). Walk is array-index, not pointer:
  `orderBy: { position: "asc" }` (`lib/services/chains.ts`).
- "The agent above" for a seller = the `ChainLink` at `position - 1`.

### 1.2 A stub is empty. A claim creates the file.

- An unclaimed link is a **stub**: `transactionId = NULL`, carrying only
  `stubPropertyAddress`, `stubAgencyName`, and optional contact. It has **no
  transaction, therefore no milestones of any kind** (`docs/chain-feature/01-data-model.md:40`).
- Claiming (`POST /api/claim`, `action: "create"`) creates a brand-new
  `PropertyTransaction` owned by the claiming agent, links it, and marks the link
  `CLAIMED`. Verified: `app/api/claim/route.ts:159-208`.
- **The stub carries no `tenure` and no `purchaseType`.** The claiming agent must
  supply both at claim time — they are *mandatory* or the claim 400s. Verified:
  `app/api/claim/route.ts:132-172`.

### 1.3 Reconciliation-on-claim is LIVE (answers "is that already in place?")

- When an agent claims and picks **"Already in progress,"** they get a **two-step
  wizard (vendor side, then purchaser side)** to tick what's already done. Each tick
  writes a `MilestoneCompletion` stamped `reconciledAtClaim = true`, with an optional
  real-world `eventDate` (or null = "complete, date unknown"), and a non-templated
  summary so the activity feed doesn't falsely say "Sarah confirmed X." Verified:
  `app/actions/milestones.ts:1047` (`reconcileClaimMilestonesAction`), wired at
  `app/api/claim/route.ts:236`, UI `components/claim/ClaimConfirmForm.tsx:196`.
- **But it is entirely self-service and starts blank.** The wizard is populated by
  the agent's own memory. Nothing the seller knew feeds it. **This is the gap the
  feature fills.**

### 1.4 There is NO cross-file propagation. Anywhere.

- No file's milestone completion ever writes onto another file. Verified absence;
  confirmed as a known gap (`docs/audits/chain-system-gaps.md:103`) and explicitly
  deferred (`docs/chain-feature/10-deferred.md:74`).
- The only cross-file firing is an **email** to claimed chain-mates at exchange
  (`VM19`/`PM26`) and completion (`VM20`/`PM27`). It writes emails, not milestones.
  Verified: `lib/services/milestones.ts:1220`, `lib/email/chainNotifications.ts:603`.

### 1.5 Cross-agency visibility is a rolled-up % only

- On another agency's link, an agent sees: **address, agency name, claim-status
  badge, and one overall weighted progress %.** No milestone breakdown, no
  stuck-step, no price (stripped to null). Verified: `lib/services/chains.ts:514`.
- So today, "see where my onward is" = one blunt percentage, and only if the agent
  above has claimed. If unclaimed, the seller sees nothing but the stub.

### 1.6 The portal already touches "onward" — but only as self-reported text

- The seller's portal shows their **onward agent** (the chain link above, with
  `editState: editable | invited | claimed`) in the "Your team" card. Verified:
  `getPortalChainAgent`, `lib/services/portal.ts:412`. The `claimed` state is
  exactly "the agent above has claimed the file."
- The portal **Information tab** lets a seller self-report three flat fields:
  `buyingOnward`, `onwardReadyToExchange`, `onwardMortgageOfferExpiry` on
  `ClientMoveInfo`. Verified: `components/portal/PortalInformationTab.tsx:139-165`.
  **This is free-text status, not step-by-step progress.**

### 1.7 The portal cannot confirm steps on a different file (the hard constraint)

- Every portal action is hard-scoped: token → `Contact` → `contact.roleType` →
  `side` → milestones on **`contact.propertyTransactionId` only**. A vendor can only
  confirm vendor steps on their own sale file. There is **no code path** for a
  contact to confirm anything on a *different* transaction (their onward purchase).
  Verified: `portalCompleteMilestone`, `lib/services/portal.ts:791-834`; explicitly
  documented as a constraint (`docs/active/client-chase-arc-complete.md:440`).
- Six/eight codes are hard-blocked from client self-confirm even on their own file:
  `VM18/PM25, VM19/PM26, VM20/PM27, PM20/VM21` (`lib/chase/portal-agent-only-codes.ts`).

### 1.8 What determines "which steps apply"

- Exactly two axes: **`tenure` (freehold | leasehold)** and **`purchaseType`
  (mortgage | cash_buyer | cash_from_proceeds)**. Verified: `lib/milestone-auto-nr.ts`.
  - Freehold → drops VM8/VM9/PM12 (leasehold management-pack steps).
  - Cash → drops PM5/PM6/PM11 (mortgage steps); cash-from-proceeds also drops PM24.
- Nothing else in the schema changes the step set (no house/flat, new-build, FTB).
  So "confirm what type of property + purchase method" in the note = precisely these
  two fields. This is the minimum onboarding for any onward tracker.

### 1.9 Relevant prior decisions (Law 6 — surfaced, not reconciled)

- **Portal "Chain view" was DEFERRED** — "Ellis found it unnecessary in practice,
  will revisit at some point" (`docs/active/portal-feature-ledger.md:42`). This
  feature is a **narrower, action-oriented slice** (one onward link, progress-only),
  not full chain visibility — but the deferral is the nearest prior call and should
  be weighed, not ignored.
- **Self-link (scenarios A/B/C) is NOT built.** No self-link code exists. Not a
  blocker, but "our agency owns both the sale and the onward" has no clean path today.
- **`chainSetupPending`** already flags files where the agent said "don't know yet"
  about the onward at relist, and the hub nudges them to resolve it. This feature may
  be the natural "resolve" destination.

---

## Part 2 — What the feature actually is (restated precisely)

Three distinct capabilities are tangled in the note. Naming them separately is the
key to staging:

- **CAP-A — Capture:** record the seller's onward-purchase progress somewhere,
  including the two type fields (tenure + purchaseType) so we know which steps apply.
- **CAP-B — Visibility:** surface that progress to us / the file-below agent (the
  outsourced-file motivation) — and possibly to the wider chain and the seller.
- **CAP-C — Inheritance:** when the agent above eventually claims, hand the captured
  progress into their reconciliation wizard so they don't start blank.

CAP-C only has value if CAP-A exists. CAP-B is the thing the agents actually asked
for. They can be staged: **A → B → C.**

---

## Part 3 — The forks. Every decision, with a recommendation. All OPEN.

### FORK 1 — Who confirms the onward steps? (the actor) — **gates everything**

The note says "allow *them* to confirm" (ambiguous: the seller? our team?) but the
motivation is "*agents* want to see their onward on outsourced files."

- **1a — Client-driven.** The seller confirms onward steps in their own portal. They
  are the buyer on the onward, they get the emails from their onward solicitor/agent,
  they genuinely know. Pro: self-service, authoritative-ish, scales to self-managed
  tier for free. Con: burdens the client; they may not understand PM-step language;
  data quality; they're reporting on a file we don't manage.
- **1b — Agent-driven.** Our internal team logs onward progress from what the seller
  tells them, on the file. Pro: controlled, we already chase these clients. Con:
  manual load on us; only serves the outsourced tier; doesn't help self-managed
  agencies who wanted the same visibility.
- **1c — Both.** Client self-reports; agent can log/override. Most capable, most build.

**Recommendation:** design the **data home** (Fork 2) to be actor-agnostic, and ship
**agent-driven (1b) first** because that's who asked and it dodges the portal's
hard cross-file constraint (§1.7) entirely. Layer client self-report (1a) as a later
stage once the shape is proven. **Your call — this decides which surface we build first.**

### FORK 2 — Where does the onward progress live? (data home) — **the architectural spine**

- **2a — A real (ghost) `PropertyTransaction`** created now for the onward, linked as
  the chain link above, later inherited on claim. Pro: reuses everything. Con: creates
  a transaction for a file *another agency* will claim; collides head-on with the
  claim flow, which **creates a fresh transaction** and doesn't hand over a
  pre-populated one (§1.2). Would need the claim flow reworked to "adopt" a ghost.
  Also wrong when the onward is a new-build/top-of-chain nobody will ever claim.
- **2b — A lightweight "shadow tracker"** attached to the seller's side (on the
  `ChainLink` stub, or the seller's file), holding: tenure, purchaseType, and a set of
  confirmed onward steps *as reported by the seller*. Not a real transaction. On claim
  we offer to import it into the claiming agent's reconciliation wizard. Pro: honest
  to the trust boundary (it's our seller's report, not the other agency's file); no
  ghost transaction; works even when nobody will ever claim above. Con: a new data
  structure; the import-on-claim bridge is new.
- **2c — Extend `ClientMoveInfo`** (already has `buyingOnward` etc.). Minimal, but it's
  a flat info record, not a progress model; no clean path to reconciliation import.

**Recommendation: 2b (shadow tracker).** It matches how reconciliation already treats
reality — a *reported* catch-up, stamped as such, never presented as first-party
truth. It also survives the "onward is a new-build, no agent will ever claim" case,
which 2a cannot. **This is the biggest single decision. Everything downstream forks
off it.**

### FORK 3 — What do we track, and how much?

- **Type fields first (mandatory):** tenure + purchaseType. Without them we can't
  know which steps apply (§1.8). This is the tracker's onboarding gate.
- **Which steps:** the onward = seller-as-buyer = **PM (purchaser) side**. Options:
  full PM set (consistent with reconciliation import) vs a **simplified milestone
  spine** (e.g. instructed solicitor → searches → mortgage offer → enquiries →
  exchange-ready → exchanged → completed) to reduce client/agent burden.
- **Agent-only codes:** `PM20/PM25/PM26/PM27` are normally agent-only. But "onward
  exchanged / completed" is exactly the chain-critical signal we want. Decision:
  are those confirmable in the shadow tracker (with a clear "reported" label), or
  excluded?

**Recommendation:** simplified spine for capture UX, mapped onto real PM codes
underneath so CAP-C import is clean. Allow "onward exchanged" and "onward completed"
as reported milestones (they're the whole point) but label them "as reported."

### FORK 4 — Inheritance on claim (CAP-C)

- Does the claiming agent inherit the seller-reported progress? **Recommendation: yes,
  as a pre-fill of the existing reconciliation wizard, never as silent fact.** The
  claiming agent is authoritative on their own file; seller data is a starting hint
  they review, edit, and accept. This reuses `reconcileClaimMilestonesAction` and its
  `reconciledAtClaim` honesty stamp — minimal new surface.
- Tenure/purchaseType: pre-fill from the seller's report; the claiming agent can
  override (their reality wins).

### FORK 5 — Notifications ("they should get the notifications as well as us?")

- **Before claim:** the agent above doesn't exist yet. Notifications on onward-step
  capture go to **us / the file-below agent** (that's the visibility they asked for).
  Open: do we nudge the *stub contact* (the onward agent) — "there's activity on your
  chain, claim to see it" — as a viral hook? Powerful but risks noise/privacy.
- **After claim:** existing chain notifications (exchange/completion emails to
  chain-mates) already cover them (§1.4). No new work unless we want per-milestone
  chain notifications, which are deferred for good reason (volume).

**Recommendation:** pre-claim, notify the file-below agent only; hold the
stub-contact nudge as an explicit later decision. Post-claim, rely on existing emails.

### FORK 6 — Visibility: who sees the onward progress?

- File-below agent / our team: **yes** (the point).
- The seller: **yes** if client-driven; they reported it.
- The wider chain summary: today cross-agency shows only a rolled-up % (§1.5). Do we
  surface seller-reported onward progress as a chain %? That's showing agency B's
  status *as reported by agency A's client* — must be clearly labelled "reported /
  unconfirmed," or kept out of the shared chain view entirely.

**Recommendation:** show it on our own file and the seller's portal, clearly labelled
"as reported by the seller." Keep it OUT of the cross-agency shared chain % until the
agent above claims and it becomes first-party — avoids polluting the trust boundary.

### FORK 7 — Trust boundary / provenance

The onward is another agency's file (or an unrepresented private sale). Everything
captured here is **second-hand by construction** and must be labelled so, everywhere
it renders. Never let seller-reported onward data masquerade as authoritative chain
data. (Reconciliation already models this honesty — reuse the pattern.)

### FORK 8 — Tiers: outsourced-only or universal?

Motivation came from outsourced files, but the capability (and client self-report)
works identically for self-managed agencies. **Recommendation: build tier-agnostic;
if we must scope the first release, gate the *surface* not the data model.**

### FORK 9 — Lifecycle & edge cases (each needs an answer before build)

- Onward falls through / seller switches to a different onward property.
- Seller was wrong about tenure/purchaseType; agent above later contradicts on claim.
- **Recursion:** the seller's onward agent also has an onward. Do we go deeper?
  **Recommendation: one level only in v1** (the immediate onward). "So much hangs off
  it" — depth is where it explodes.
- Seller disengages → graceful empty state, no half-built dead controls (Law 13).
- **Onward is top-of-chain (new-build / no agent above to ever claim).** Strong case
  for shadow model (Fork 2b); CAP-C simply never fires, CAP-B still delivers.
- No chain exists yet at all: do we auto-create a stub/chain to hang the tracker on,
  or attach onward progress directly to the seller's file? (Ties to `chainSetupPending`.)

### FORK 10 — Interaction with existing surfaces

- `chainSetupPending` nudge → could be the entry point into this capture.
- `ClientMoveInfo` onward fields → subsume into the tracker, or keep as the
  lightweight "do you have an onward at all?" gate that opens the tracker.
- Deferred portal "Chain view" → surfaced (§1.9); this is narrower, weigh it.
- Reconciliation-on-claim → the CAP-C bridge (Fork 4).
- Client-chase → if client-driven, do we chase the seller for onward updates? Almost
  certainly not v1.

---

## Part 4 — Proposed staging (only after logic agreed)

Indicative, not committed. Sequenced so each stage ships value alone:

1. **Stage 0 — Decide Forks 1 & 2.** Nothing else can be designed until actor +
   data home are fixed.
2. **Stage 1 — CAP-A capture (type fields + step spine)** on the chosen surface.
3. **Stage 2 — CAP-B visibility** to the file-below agent (the asked-for value).
4. **Stage 3 — CAP-C inheritance** — pre-fill reconciliation from the tracker on claim.
5. **Stage 4 — extend actor** (add client self-report if we started agent-driven, or
   vice-versa) and decide the stub-contact viral nudge.

---

## Part 6 — Agreed answers (Ellis feedback 2026-08-22)

LOCKED = confirmed. OPEN = needs one more call from Ellis.

- **Q1 Actor — BOTH: seller confirms AND agent can edit. LOCKED.** The seller confirms
  onward steps from their portal using the *exact same confirmation drawer and
  behaviour* as the real buyer's steps (reuse the existing portal step UI). Your team
  can also fill/correct on the file. Scope honesty: the drawer + step-list UI are
  reused; behind them a new "shadow tracker" store and its read/write path are new (the
  confirm writes to the tracker, not to real milestone rows). So "reuse the front, build
  the data path behind" — modest, not literally just wiring.
- **Q2 Data home — SHADOW TRACKER on the seller's own file. LOCKED.**
- **Q3 Steps — FULL buyer step set (not a spine), with real unlock ordering. LOCKED
  in principle; two OPEN sub-calls below.** Show the seller (majority of) the real
  buyer steps, gated by the two type facts, and mirror the real prerequisite/unlock
  order (can't tick searches-back before draft-contract-pack, etc.).
  - Chain-event logic (Ellis): exchange runs top-down, completion runs bottom-up.
    So the onward's **exchange** happens at the same moment as our own sale's exchange,
    and the onward **cannot complete before our own sale completes** (funds flow up).
  - **3a — exchange/completion behaviour. LOCKED.** The seller CAN click exchange and
    completion themselves, but only when they legitimately should be able to:
    (i) "onward completed" is gated — cannot be confirmed before OUR sale completes;
    (ii) when we confirm exchange on OUR sale, it auto-marks the onward as exchanged too
    (if the seller hasn't already). So: manual click allowed within the ordering gates,
    PLUS our own exchange cascades down to theirs.
  - **3b — placement in the portal. DEFERRED TO BUILD.** Confirmed NOT the Information
    tab. Exact home (overview vs progress vs a dedicated surface) is unresolved — risk is
    it feels squished/shoved in. Decision: prototype placement options during the build
    and review visually before settling. (Ellis: "maybe we'll have to build and then work
    it out.")
  - Note: the normal "agent-only" block on exchange/ready/completion is relaxed inside
    the tracker (it's reported status about another sale, with no cascade), which is
    what lets the seller mark exchanged/completed at all.
- **Q4 Inheritance — pre-filled reconciliation wizard. LOCKED.**
- **Q5 Notifications — no chasing, no emails, in v1. LOCKED.** The seller (or agent)
  confirms; nothing chases them. Unlock ordering mirrors the real steps (see Q3).
  Client-chasing the seller for onward updates is explicitly deferred past v1.
- **Q6 Chain visibility — PRIVATE, never in the cross-agency chain view. LOCKED.**
  Reinforced reasoning (Ellis): only an agent's word is trusted as gospel; a client may
  tick things not-quite-accurately, so reported onward progress must NOT be pushed out
  to other agencies. It shows only on our own side.
  - **OPEN 6a — agent-side placement.** Where on the seller's file (agent view) does
    the reported onward tracker live? Proposed: a card on the file-detail page beside
    the existing chain widget, titled "Onward purchase — reported."
- **Q7 Provenance — "reported" labelling everywhere. LOCKED, with copy-approval gate.**
  Ellis reviews and approves all reported-status phrasing before it ships (Law 21 voice).
- **Q8 Tier — UNIVERSAL. LOCKED.**
- **Q9 Depth — ONE LEVEL ONLY. LOCKED (clarified).** Meaning: we track only the
  seller's *own* onward purchase — the property they are buying. We do NOT try to track
  the onward's onward (two links up) or beyond. Rationale: our seller only has knowledge
  of the property they're buying; they can't report on the sale above that. So one link
  above our seller is both the sensible and the only knowable scope.
- **Q10 Meshing — LOCKED.** Existing `buyingOnward` toggle is the gate that opens the
  tracker; `onwardReadyToExchange` / `onwardMortgageOfferExpiry` fold into the relevant
  steps (no duplicate surfaces); the existing `chainSetupPending` nudge is a second
  doorway in. No onward client-chasing in v1.

### Round-two resolution (2026-08-22)
All decisions settled. Only open item is **3b portal placement**, deliberately deferred
to build-time prototyping. Logic is agreed — proceed to the staged build spec (Part 7).

---

## Part 7 — Staged build spec (for approval before any code)

Four stages, each independently shippable. Staging first on every migration (Law 3).

### The data model (the shadow tracker)

Two new models, additive, no change to existing tables:

- **`OnwardTracker`** — one per seller transaction (nullable; only exists once
  `buyingOnward = true` opens it).
  - `id`, `transactionId` (unique FK → the seller's `PropertyTransaction`)
  - `tenure`, `purchaseType`, `isShareOfFreehold` — the two type facts (+ the no-effect one)
  - `status` — `ACTIVE | EXCHANGED | COMPLETED | ABANDONED | SUPERSEDED`
    (`SUPERSEDED` = the agent above claimed; the real file now owns the truth)
  - `createdAt`, `updatedAt`
- **`OnwardStepConfirmation`** — one row per confirmed onward step.
  - `id`, `trackerId` (FK)
  - `milestoneDefinitionId` (FK → a PM-side `MilestoneDefinition`, so it maps 1:1 into
    the reconciliation payload later)
  - `eventDate` (nullable — "done, date unknown" allowed, mirroring reconciliation)
  - `source` — `seller | agent` (provenance)
  - `confirmedByContactId?` / `confirmedByUserId?`, `confirmedAt`

"Which steps apply" reuses `computeAutoNrCodes(purchaseType, tenure)`; "which steps are
available/unlocked" reuses the existing PM prerequisite graph, computed over the
tracker's confirmations instead of real `MilestoneCompletion` rows. No new ordering
logic — the real engine's rules are applied to tracker data.

### Stage 1 — Foundation + agent-side capture (delivers the asked-for value alone)

- Migration: the two models above (staging → verify → prod).
- The `buyingOnward` toggle opens the tracker; capture tenure + purchaseType.
- Compute applicable + available PM steps from the two type facts and the prereq graph.
- **Agent file view:** a card beside the chain widget — "Onward purchase — reported" —
  showing the step list with availability, letting the agent confirm/edit steps, all
  clearly labelled "reported." (Q6a)
- This ships the outsourced-file visibility the agents asked for, before any portal work.

### Stage 2 — Seller portal capture

- New onward-progress surface in the seller portal, reusing the existing buyer-step
  confirmation drawer; writes to the tracker. **Placement prototyped and reviewed (3b).**
- Exchange/completion gating (3a): seller may confirm within the ordering gates;
  "onward completed" blocked until our sale completes.
- Hook on our own sale's exchange (VM19 on the seller's file): auto-mark the tracker's
  exchange step if not already set. Set `tracker.status = EXCHANGED`.
- Fold `onwardReadyToExchange` / `onwardMortgageOfferExpiry` into the relevant steps;
  retire the duplicate Info-tab fields (Q10, no same-screen duplication).

### Stage 3 — Inheritance on claim

- When the agent above claims the link above the seller, detect the seller's tracker.
- Pre-fill the existing claim reconciliation wizard from the tracker's confirmations
  (+ type facts), for the claiming agent to review/edit/accept. Reuses
  `reconcileClaimMilestonesAction`; nothing written silently.
- On successful claim, set `tracker.status = SUPERSEDED` and retire the reported card;
  the seller's onward view reverts to the normal (already-built) "claimed onward agent"
  display, and the real chain link now owns the truth.

### Stage 4 — Cross-links, lifecycle, deferred hooks

- `chainSetupPending` nudge becomes a second entry point into tracker setup.
- Lifecycle controls: "this onward is no longer happening" → `ABANDONED`; onward
  property changed → reset. Graceful empty states (Law 13, no dead controls).
- Parked for a later, separate decision: nudging the stub onward-agent to claim;
  client-chasing the seller for onward updates.

### Lifecycle summary

`buyingOnward=true` → tracker `ACTIVE` → steps confirmed (seller/agent) →
our exchange cascades → `EXCHANGED` → (agent above claims → wizard pre-filled →
`SUPERSEDED`, real file takes over) OR (onward falls through → `ABANDONED`).
The tracker is only ever a pre-claim stand-in; once a real file exists above, it retires.

### Explicitly out of scope (v1)

- Recursion beyond one link (Q9).
- Any cross-agency exposure of reported progress (Q6).
- Emails/chasing of the seller (Q5).
- Live real-time chain progress propagation (already deferred, unchanged).

## Part 5 — The open questions, listed for sign-off

1. **Actor:** client-driven, agent-driven, or both? (Fork 1)
2. **Data home:** shadow tracker vs ghost transaction vs ClientMoveInfo extension? (Fork 2)
3. **Step depth:** full PM set or simplified spine? Are onward exchange/completion
   confirmable-as-reported? (Fork 3)
4. **Inheritance:** pre-fill reconciliation on claim, agent confirms? (Fork 4)
5. **Notifications:** file-below only pre-claim? Nudge the stub onward-agent to claim? (Fork 5)
6. **Chain visibility:** keep reported onward progress off the cross-agency % until
   claimed? (Fork 6)
7. **Recursion depth:** one level only in v1? (Fork 9)
8. **Tier scope:** universal or outsourced-first? (Fork 8)
9. **Prior decision:** does the deferred portal "Chain view" change the appetite here? (§1.9)
</content>
</invoke>
