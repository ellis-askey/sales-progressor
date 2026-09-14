# Chain far-side steps — spec

Status: proposed (2026-09-14). Investigation done, UI decision locked (toggle).
Owner: chain / onward + related-sale trackers.
Builds on: `docs/active/onward-visibility/00-discovery.md` (onward tracker, live
prod), `docs/active/related-sale/00-spec.md` (related-sale tracker, staging only),
and the reconciliation-on-claim carry-over.

## Why

The onward-purchase and related-sale trackers each show only **one** party's
steps — "our person's" side of the neighbour deal:

- **Onward purchase** tracks our **seller** acting as the *buyer* (purchaser/PM steps).
- **Related sale** tracks our **buyer** acting as the *seller* (vendor/VM steps).

Each neighbour deal has two parties. The **far side** — the person our seller is
buying *from* (the onward seller), and the person buying our buyer's *old* home
(the related buyer) — isn't tracked at all. An agent often knows that side's
progress because they can ring the agent above/below. This adds the far side so
the agent can record it.

## Scope + locked decisions

- **Agent-only. Never the client portal.** A client can't reliably know what the
  party two doors down has done; an agent can, by calling the neighbour agent.
  So the far side is confirmable only by the agent (`source: "agent"`), on
  internal surfaces only. No portal panel, no portal action.
- **Two far sides added:**
  - Onward purchase → the **onward seller's** steps (vendor/VM set).
  - Related sale → the **related buyer's** steps (purchaser/PM set).
- **UI: a toggle** within each neighbour card switching between the near side and
  the far side ("Buyer's steps" / "Seller's steps"). One list at a time.
- **Private, same as today** — never shown cross-agency, never on the portal.

## The architecture already fits

The tracker service is side-generic: a per-kind `DIRECTION` config
(`lib/services/onward.ts:46`) sets which milestone side (`purchaser`/`vendor`),
prefix (`PM`/`VM`), and gate/exchange/completion codes a tracker follows. The DB
already allows several trackers per file (`@@unique([transactionId, kind])`,
`schema.prisma:3810`). Step generation, ordering, lock/unlock, confirm and undo
are all side-agnostic and work unchanged for a new side.

## Build

### 1. Data model
Add two `OnwardTrackerKind` values (`schema.prisma:3813`):
- `onward_purchase_seller` — the onward property's vendor (VM steps).
- `related_sale_buyer` — the related sale's purchaser (PM steps).

Migration: enum-value additions only. Staging first (Law 3). No other schema
change — the far side reuses `OnwardTracker` + `OnwardStepConfirmation` exactly.

### 2. Engine config — new `DIRECTION` entries (`lib/services/onward.ts:46`)
- `onward_purchase_seller`: `side: "vendor"`, `prefix: "VM"`, gate `VM18`,
  exchange `VM19`, completion `VM20`, no survey/mortgage codes,
  `completionGateOurCode: null`, `requiresPurchaseType: false`.
- `related_sale_buyer`: `side: "purchaser"`, `prefix: "PM"`, gate `PM25`,
  exchange `PM26`, completion `PM27`, survey `["PM9","PM10"]`, mortgage
  `["PM5","PM6","PM11"]`, `completionGateOurCode: null`, `requiresPurchaseType: true`.

### 3. Type facts — read from the sibling (no double entry)
The far side is the **same property** as its near side, so it shares tenure:
- `onward_purchase_seller` reads `tenure` + `isShareOfFreehold` from the sibling
  `onward_purchase` tracker; needs no `purchaseType` (vendor side). No new input.
- `related_sale_buyer` reads `tenure` from the sibling `related_sale` tracker but
  needs a **new** `purchaseType` (how the related buyer is buying) — a small
  agent input, mirroring the existing "Buying with" control.

Rule: far-side trackers never re-ask tenure; they inherit it from the near-side
sibling (single source of truth for the property). Only `related_sale_buyer`'s
`purchaseType` is captured on the far side.

### 4. Confirm / undo (agent-only)
Reuse `confirmOnwardStep` / `undoOnwardStep` (already take a `kind`), stamped
`source: "agent"`, guarded by `requireTxInScope`. Add agent actions for the two
new kinds in `app/actions/onward.ts`. **No** portal actions.

### 5. UI — toggle (`components/transaction/OnwardPurchaseCard.tsx`)
`OverviewPanel` fetches the far-side views alongside the near-side ones
(`getOnwardTrackerView(txId, "onward_purchase_seller")` etc.). The card gains a
two-option toggle at the top:
- Onward purchase card: **Buyer's steps** (near, our seller) / **Seller's steps** (far).
- Related sale card: **Seller's steps** (near, our buyer) / **Buyer's steps** (far).
Each side renders the existing step list + Reported X/Y + Confirm/Undo. Far side
shows the same "reported, not confirmed by the neighbour agent" provenance note.

### 6. Carry-over on claim (extend the existing mechanism)
When a neighbour's real file is claimed, the reconciliation wizard already
pre-fills from the near-side tracker. Extend it to also pull the far side, so a
claimed neighbour file gets **both** its sides pre-filled:
- `getOnwardInheritanceForLink` (`onward.ts:635`) also reads
  `onward_purchase_seller` (VM) → pre-fills the claimed file's vendor side.
- `getRelatedSaleInheritanceForLink` (`onward.ts:706`) also reads
  `related_sale_buyer` (PM) → pre-fills the claimed file's purchaser side.
- `supersede*ForLink` and the withdrawal cascade (`onward.ts:660/728`,
  `lib/chain/withdrawal.ts:139`) also retire the far-side trackers.

### 7. Out of scope
- No portal surface for the far side (permanent).
- No auto-cascade of exchange/completion into the far side from our own
  milestones (agent confirms it manually from what the neighbour agent says).
- No cross-agency visibility change.

## Open details (sensible defaults, confirm if you disagree)
- **Completion gating:** the far side is ungated by our-file gates
  (`completionGateOurCode: null`) — the agent reports what the neighbour tells
  them, no chain-order lock. (The near-side onward keeps its existing VM20 gate.)
- **Neighbour notifications:** far-side confirms are agent-only, so no client
  digest; leave the `ChainNeighbourUpdate` nudge to the near side as today.

## Sequencing note
The **related-sale tracker is on staging only, not prod.** The
`related_sale_buyer` far side rides along with the related-sale prod push; the
`onward_purchase_seller` far side can ship on prod with the (already-live) onward
tracker.

## Proposed build stages (reviewable)
1. **Backend** — schema (2 kinds) + DIRECTION + sibling type-facts + agent
   confirm/undo actions + unit tests. No UI yet.
2. **UI** — the toggle + far-side views in the card.
3. **Carry-over** — inheritance + supersede + withdrawal wiring for the new
   kinds + tests.

## Definition of done
- Agent can open a neighbour card, toggle to the far side, set the buyer's
  purchase method (related only), and confirm/undo the far side's steps.
- Nothing far-side appears on the client portal or cross-agency chain view.
- On claim of a neighbour file, both sides' reported steps pre-fill the wizard.
- `tsc` clean; unit tests for the new directions + carry-over; staging first.
