# Chain agent chase + chain tab + insert-between — Spec (v1)

Status: **LOGIC BEING AGREED (2026-09-15). Nothing built.** Working source of
truth. Plain-English-first, technical anchors at the end. Migrations staging-first
(Law 3). One concern per PR (Law 5) — this arc is three independent PRs.

Related, already-shipped substrate this arc builds on (do not rebuild):
- **Far-side trackers** (prod 2026-09-14) — `onward_purchase_seller` (agent above's
  side) + `related_sale_buyer` (agent below's side). Record what the neighbour
  agent reports; already compute the next outstanding step in locked order.
  `docs/active/chain-far-side/SPEC.md`.
- **Outbound neighbour-update pipeline** — `lib/services/chain-neighbour-updates.ts`.
  Already emails the stub agent above/below (agency-branded sender, stub contact
  fields, unsubscribe, dedup). The outbound twin of the chase below.
- **Chase phrasing engine** — `app/api/ai/generate-chase/route.ts` + action-holders
  + derive-ask + milestone glossary + voice profile. Milestone-code aware.

---

## Decisions locked (Ellis, 2026-09-15)

1. **Chase target = specific step, default.** The chase is driven by the far-side
   tracker's next outstanding step, in locked order, phrased by the existing
   glossary engine. General "any update" is the fallback when there is no tracker.
2. **Reuse the existing ChaseDrawer** via a new `chain_agent` recipient kind — gated
   so the solicitor and client (`vendor`/`purchaser`/`broker`) branches never apply.
   Reuses tone / AI / voice profile. (Ellis's rule: never touch the solicitor or
   client chase paths.)
3. **Chain moves to a property-file tab** by extracting a shared `ChainView`
   component. The tab renders it inline; the drawer wraps it for the Chains page
   (where you're not on a file). One source of truth.
4. **Insert-between = a hover "+" on the connector** between two cards. Clean,
   tucked away, lives in the gap where the new link goes.

---

## Part A — Insert a link between two links

### Why (the gap today)
New links go only to the **top** of a ladder (position 0, everything shifts down)
or the **bottom** (max+1), or as a new branch. Even the existing "add above link X"
(`addAboveLink`, `lib/services/chains.ts:1178`) inserts at the **top of X's whole
column**, not directly above X. Reordering is single-step adjacent swaps only, and
only while every link is your own unclaimed stub. So to slot a sale between two
existing links you currently have to delete and re-add — the thing Ellis wants gone.

### What we build
- **Server:** a true positional insert. Within the anchor's `branchKey`, shift
  every link with `position >= anchor.position` down by one, then create the new
  link at the anchor's position (insert-above) / `anchor.position + 1` (insert-below).
  The unique index `@@unique([chainId, branchKey, position])` supports this; shift
  highest-first to dodge collisions (same pattern `addChainLink` already uses).
- **UI:** on hover over a `ChainConnector` (the line between two cards,
  `components/chain/ChainDrawer.tsx:998`), a small inset "+" appears — "insert a sale
  here". Opens the existing `AddNodeDrawer` in a new "insert between" mode. No big
  button; it lives on the connector.
- **Permissions:** widen `canAddAbove`/`canAddBelow` from person-based to the
  agency-aware model (`canEditNodeIntel`), closing the flagged follow-up from
  `docs/active/chains-agency-rollout/00-spec.md` (a director can now add nodes to a
  colleague's chain). Same gate applies to the new insert.

### Notes / open
- Confirm the connector affordance also appears on branch ladders, not just the
  spine.
- The existing `addAboveLink` column-top semantics stay as-is for the per-column
  "+ Add sale above" button; the new insert is a distinct code path.

---

## Part B — Chain tab on the property file

### Why
The chain is reachable on the file only via Overview → `PropertyChainCard` →
"Open chain" → the slide-over `ChainDrawer`. Ellis wants the full chain on its own
tab of the property file, with the drawer retained for the Chains page.

### What we build
- **Extract `ChainView`** — the chain body `ChainDrawer` renders (fetch state,
  tree render, add-node delegation, summary + activity cards) moves into one
  component.
- **`ChainDrawer`** becomes a thin slide-over wrapper around `ChainView` — used by
  the Chains page (`components/chain/ChainCard.tsx` via `ViewChainButton`) and any
  off-file context.
- **New "Chain" tab** on the property file: add an entry to the `tabs` array
  (`app/agent/transactions/[id]/page.tsx:301`) and the matching panel child at the
  same index inside `<PropertyFileTabs>` (children are zipped to tabs by index —
  order must match), rendering `ChainView` inline. Add a `chain` icon key to
  `TAB_ICONS` (`components/transaction/PropertyFileTabs.tsx:18`).
- The Overview `PropertyChainCard` stays (the compact spine summary). **DECIDED
  (Ellis 2026-09-15): on the property file, "Open chain" always routes to the new
  Chain tab** (`useTabContext().setActiveTab("chain")`) — no drawer on-file.
  **Off-file (the Chains page `ChainCard` via `ViewChainButton`) keeps opening the
  drawer**, since there's no file to land a tab on. So the drawer survives purely as
  the off-file container around `ChainView`.

### Risk
This is the one piece with real regression surface — it moves a lot of stateful
rendering. Behavioural baseline before/after (Law 17); screenshot the drawer on the
Chains page and the new tab, desktop + mobile.

---

## Part C — Chase agent above/below

### Why
An agent often knows the neighbour's progress by ringing the agent above/below —
the far-side tracker lets them *record* it, but there's no way to *solicit* it. This
adds a manual, agent-initiated chase to the neighbour agent asking for an update.
It is the inbound-request twin of the outbound neighbour-update pipeline.

### Geometry (what "above/below" means)
- **Above = onward purchase.** The agent above handles the property our seller is
  buying. Their side = the `onward_purchase_seller` far-side tracker (VM steps).
- **Below = related sale.** The agent below handles the sale of our buyer's old
  home. Their side = the `related_sale_buyer` far-side tracker (PM steps).
- Chasing the neighbour agent asks them to confirm the **next outstanding step on
  the far-side tracker**; their reply is what you then tick on that tracker. The two
  features close one loop.

### Scope
- **Target unclaimed stub neighbours only** (`ChainLink.transactionId === null`
  with a `stubAgentEmail`) — agents not on our platform. **DECIDED (Ellis
  2026-09-15): exclude claimed neighbours** — a claimed neighbour is another agency
  already on the platform getting their own reminders; no email chase to them. The
  chase button does not render on a claimed link.
- **Agent-side only. Never the portal.** Same as the far-side tracker.
- **Never touches the solicitor or client chase paths.** The `chain_agent` recipient
  is a stub (not a `Contact`, not a `SolicitorContact`), so it must be a distinct
  recipient kind that skips `roleType`-keyed solicitor/client branches entirely.

### What we build
- **New recipient kind `chain_agent`** in `ChaseDrawer` (`components/chase/ChaseDrawer.tsx`),
  sourced from the neighbour link's `stubAgentEmail` / `stubAgentName`. Reuses tone,
  channel (email only — no WhatsApp to a cold agent), AI draft, and voice profile.
  Skips: solicitor CC symmetry, client-Contact logging, broker logic.
- **Ask derivation:** default to the far-side tracker's next unlocked milestone code
  → the existing glossary/derive layer phrases "please confirm whether [step] has
  happened on [address]". A dedicated small ask path (not the on-file action-holder
  map, which is about who holds the action on *our* file). General fallback when no
  tracker/next step.
- **Sender:** agency-branded via `resolveChainInviteSender` (replies go to the
  agency), mirroring the neighbour-update pipeline — not the client/solicitor sender.
- **Logging:** record like the solicitor path (empty `contactIds`) but with a new
  `recipientType: "chain_agent"` for honest reporting; do not write stub ids into
  `contactIds`.
- **Button placement:** primary on the far-side view of the neighbour card
  (`components/transaction/OnwardPurchaseCard.tsx`, next to the near/far toggle where
  the outstanding step is visible); mirrored on the stub `LinkCard`
  (`components/chain/LinkCard.tsx`) in `ChainView`. Confirm both, or card-only.

### Guardrails
**DECIDED (Ellis 2026-09-15): same rules as a manual client/solicitor chase.** A
manual, agent-initiated chase that sends on click — **no** agency opt-in gate,
**no** invited-only requirement, **no** dedup throttle. The only bar is a valid
email address. This is deliberately simpler than the *automated* outbound
`chain-neighbour-updates` pipeline (which carries opt-in / invited-only /
unsubscribe / dedup precisely because it fires cold and unattended).

Unsubscribe edge case: matching solicitor behaviour (solicitors have no unsubscribe;
their chase always sends), a previously-unsubscribed stub agent **still receives** a
manual chase. Revisit only if Ellis wants it honoured.

---

## Build order (each stands alone; one concern per PR)
1. **Part A — insert-between** (smallest, self-contained; also fixes the add-node
   permission follow-up).
2. **Part B — chain tab** (the `ChainView` extraction refactor).
3. **Part C — chase agent above/below** (reads best once the tab exists; depends on
   nothing structurally).

## Open decisions for Ellis (perfect before build)
1. ~~On-file chain: keep drawer or route to tab?~~ **DECIDED: on-file → always tab;
   off-file → drawer.**
2. ~~Chase button placement?~~ **DECIDED (Ellis 2026-09-15): primary on the
   neighbour card (Overview) where the outstanding step is visible; secondary
   quick-action on the stub card in the chain tab.**
3. ~~Chase to claimed neighbours?~~ **DECIDED: excluded — unclaimed stubs only.**
4. ~~Chase guardrails?~~ **DECIDED: same as a manual client/solicitor chase — sends
   on click, no opt-in/invited-only/dedup; only bar is a valid email.**
5. General-fallback chase copy — surfaced during Part C build; Ellis polishes.
   **DEFERRED to build.**

## Risks
- **Two-tab hazard** (`[[feedback_shared_repo_two_tabs]]`): `OnwardPurchaseCard.tsx`,
  `OverviewPanel.tsx`, and chain files were recently touched by the other tab's
  broker + far-side arcs. Path-scope commits; verify markers land in HEAD.
- Part B moves stateful rendering — the main regression surface (Law 17 baseline).

---

## Appendix — technical anchors (verified 2026-09-15)

- Chase drawer: `components/chase/ChaseDrawer.tsx` (recipient/tone/channel;
  solicitor fork keyed on `roleType`). Recipients helper:
  `lib/services/chase-recipients.ts` (`CLIENT_ROLES`, `isSolicitorRecipient`).
- Chase phrasing: `app/api/ai/generate-chase/route.ts` (+ `PROMPT_SPEC.md`),
  `lib/chase/derive-chase-ask.ts`, `lib/chase/action-holders.ts`,
  `lib/chase/milestone-glossary.ts`, `lib/chase/voice-profile.ts`.
- Chase logging/send: `app/api/comms/route.ts` → `lib/services/comms.ts`
  (`createCommunicationRecord`, `recipientType`); `app/api/chase/send-email/route.ts`
  (SendGrid). Models: `ChaseTask`/`OutboundMessage`/`ReminderRule` in
  `prisma/schema.prisma`.
- Outbound neighbour pipeline: `lib/services/chain-neighbour-updates.ts`
  (`enqueueOnwardNeighbourUpdate`/`enqueueRelatedSaleNeighbourUpdate`, sender via
  `resolveChainInviteSender`, `ChainLink.stubAgentEmail`).
- Far-side trackers: `lib/services/onward.ts` (`DIRECTION` per `OnwardTrackerKind`;
  `onward_purchase_seller` / `related_sale_buyer`), card
  `components/transaction/OnwardPurchaseCard.tsx`.
- Chain model: `PropertyChain` + `ChainLink` (`prisma/schema.prisma` ~2076/2105);
  order = `position` within `@@unique([chainId, branchKey, position])`; no
  linked-list/sortOrder.
- Add-link service: `lib/services/chains.ts` (`addChainLink:1098`,
  `addAboveLink:1178`, `addChainBranch:1232`, `selfLinkOwnSale:1282`,
  `moveChainLinkAdjacent:1425`). Route: `app/api/chains/[id]/links/route.ts`.
  Permissions: `lib/chain/permissions.ts` (`canAddAbove`/`canAddBelow`),
  `lib/chain/intel.ts` (`canEditNodeIntel`, agency-aware).
- Chain UI: `components/chain/ChainDrawer.tsx` (`ChainConnector:998`),
  `LinkCard.tsx`, `ViewChainButton.tsx`, `AddNodeDrawer.tsx`,
  `ChainCard.tsx`, `app/agent/chains/page.tsx`, `ChainsWorkspace.tsx`.
- Property file tabs: `app/agent/transactions/[id]/page.tsx:301` (tabs array +
  positional children), `components/transaction/PropertyFileTabs.tsx:18` (`TAB_ICONS`),
  `OverviewPanel.tsx` (renders `PropertyChainCard`).
