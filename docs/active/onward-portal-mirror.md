# Onward portal mirror — build spec

**Status:** Phase 1 BUILT (2026-10-30) — ownership, person-tie, confirmable render
(both directions) and read-only fallback all shipped to staging. Remaining before
sign-off listed at the foot of this doc.
**Owner decision:** founder, this conversation. No prior spec — this file is the source of truth.

## Goal (one line)

When the place a client is buying is **a file we run** (same progressing team), the **"Your onward" tab** on their sale portal shows that purchase file's **real steps** — live, identical, and confirmable — instead of a separate set-up-and-tick tracker. And symmetrically: on the purchase link, the **"Your sale" tab** shows the real sale file.

Grounding example (live on prod): **Mario & Koula Achillea** sell **15 Emperor Close** (`cmvs1vjb70002y5ezaw5kc0j6`, freehold, cash-from-proceeds) and buy **Long Meadow** (`cmvs220ec003ey5ez8ixy8rgw`, freehold, mortgage). Both Akeman Residential, outsourced to TSP, already chain-linked (Long Meadow pos 0 above, Emperor Close pos 1). Today neither has an onward tracker, so the two files don't talk to each other at all.

## Behaviour

- **Onward/related we run** → the real steps component for that file, rendered in the side tab, confirmable. No set-up prompt, nothing to re-tick.
- **Onward/related we don't run** (bought/sold through another agent) → the current lightweight `OnwardTracker` panel, **unchanged**.
- It's the **real file**, not a copy: confirming a step in the side tab records it on the real file and fires that file's normal emails/chase/chain-checkins. No mirroring, no sync, no duplication.

## The three pieces of work

### 1. "Is the onward one of ours?" — team-aware (replaces agency-only)
Walk the chain to the neighbour file (link **above** for a seller's `onward_purchase`, **below** for a buyer's `related_sale`). Treat it as ours when run by the **same progressing team**:

- same **progression business** (external company), OR
- both **TSP-outsourced** (no business, serviceType outsourced), OR
- same **agency** (self-managed).

Pure decision: `isSameProgressingTeam(a, b)` in `lib/services/progressing-team.ts`.
Resolver: `resolveOwnOnwardFileId(transactionId, kind)` in `lib/services/onward.ts` (walks the chain, returns the live adjacent file id or null). `isLinkedSaleOwnAgency` is rewired onto this so `isOwnAgencyFile` is correct for all three service models.

### 2. Tie the same person across their two files (the privacy backbone)
Each portal link opens one file. To safely show + let a person confirm the *other* file's steps, we must be certain it's the **same person** on both.

- **Auto-link** when name/email match unambiguously across the two chain-linked files (strong match = same email). Where ambiguous, the **agent confirms/corrects**.
- When tied at a strong level → the side tab is **confirmable**. When we can't tie confidently → **read-only** (show the real progress, no confirm) — never expose the wrong person's file.
- Recorded at **chain-link time** (`selfLinkOwnSale`), when we already know it's the same client. *(Build-time: check whether the invite-to-move flow already stores client identity — reuse it if so.)*

### 3. Render the real steps in the side tab
On the portal progress page, when the neighbour is ours **and** the person is tied, render the real steps component (`PortalMilestoneList`) for the neighbour file using that person's own access to it — instead of `PortalOnwardPanel`. Confirmations go through the normal `portalConfirmMilestoneAction` against the real file. The correct side (vendor steps vs purchaser steps) renders automatically.

## Scenarios

| Situation | Behaviour |
|---|---|
| Both live, same team, person strongly tied | Real steps, confirmable (the Achilleas) |
| Onward file created after a manual tracker had ticks | On link, carry ticked steps into the real file once (reuse `getInheritedProgressForTransaction`), then switch to real steps |
| Onward bought through another agent | Unchanged lightweight tracker |
| Same team but person not confidently tied | Read-only real progress (no confirm) until tied |
| Neighbour file withdrawn / unlinked | Revert to lightweight/none via the existing withdrawal cascade |
| Buyer selling below to fund the purchase | Same mechanism, "Your sale" tab, other direction |

## Service models — all covered

| Run by | Covered by |
|---|---|
| Agency in-house (self-managed) | same agency |
| Outsourced to TSP | both TSP / same agency |
| Outsourced to a progression company (even cross-agency) | same progression business |

## Emails / side-effects

Unchanged. Both files stay independent and send their own milestone emails as today. A confirm in the side tab is a confirm on the real file → its normal emails fire, nothing extra, nothing suppressed. Clients already receive both files' emails (they're contacts on both). No double-fire: for own-files we bypass the lightweight tracker entirely, so there's no separate onward side-channel.

## New data / UI

- **Data:** a small "same person across files" contact link (tied at chain-link time). Optional cached neighbour-file pointer for speed. *(Phase 1 can auto-match read-time by email to avoid a migration; stored tie lands with the agent confirm/correct UI.)*
- **UI:** essentially none new — the side tab swaps its contents to the real steps. One small agent-side confirmation when linking people. Optional clarifying line on the portal.

## Phasing

1. **Phase 1** — team-aware ownership + resolver (this slice), then person-tie (read-time email match first) + render real steps (view & confirm), **both directions, both links**.
2. **Phase 2** — stored person-tie with agent confirm/correct; carry-over of prior manual ticks; withdrawal revert.
3. **Phase 3 (optional)** — clarifying copy / cross-links; far-side agent-only trackers.

## Decisions locked

- Confirm model: **B** — confirm from either side (because it's the real file, this is free).
- Tie people: **auto-link on unambiguous name/email, agent confirms otherwise.**
- Untied fallback: **read-only real progress.**
- Both directions in scope from the start.

## Built so far (staging)

- `lib/services/progressing-team.ts` + `resolveOwnOnwardFileId` (onward.ts) — team-aware ownership. Unit-tested.
- `lib/services/portal-twin.ts` — person-tie by unambiguous email. Unit-tested.
- `app/portal/[token]/progress/page.tsx` — `buildNeighbourStepsPanel`: confirmable real steps when tied, **read-only real steps when not**, both directions; falls back to the stand-in only when the neighbour isn't our live file.
- **Revert is automatic** — `resolveOwnOnwardFileId` gates on a live file, so a withdrawn/unlinked neighbour drops back to the stand-in with no extra code.
- **Neighbour's own state respected** — `saleActive` is passed from the neighbour's status, and all confirms run through the neighbour's own token so its server-side rules (availability, pause, auth) are enforced regardless of the UI.

## Remaining before sign-off

1. **Visual check** (needs eyes) — the nested side-tab layout on a tied pair, desktop + mobile. The one open risk in the built work.
2. **Phase 2 — stored, agent-confirmed person-tie** — schema (contact↔contact link) + migration (staging-first) + auto-match at `selfLinkOwnSale` + a small agent "same person?" prompt. Lets no-email pairs confirm. (The resolver should prefer the stored tie, then email.)
3. **Carry-over** — when `selfLinkOwnSale` links own files, carry any pre-existing manual stand-in ticks into the real file once (reuse `getInheritedProgressForTransaction`). Edge-case; writes to the milestone engine, so do it with the reconciliation path, not ad hoc.
4. **E2E test** — tied pair → side tab shows real steps → confirm writes to the real file. Needs a Playwright fixture + a tied pair.
5. **Polish** — a read-only step row still opens an (inert) confirm sheet; consider suppressing the sheet entirely in the read-only onward view.
