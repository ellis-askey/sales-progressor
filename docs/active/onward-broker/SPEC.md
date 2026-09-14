# Seller's onward-purchase broker — spec (Phase 2)

Status: proposed (2026-09-14). Founder-agreed direction; build gated on the
onward-tracker rework settling (see "Dependency" below).

Owner: brokers + onward/chain trackers.

Builds on Phase 1 (shipped 2026-09-14): brokers moved off the Clients tab onto
the Professionals tab; the "Broker / IFA" client role removed; the referral
broker (`BrokerSection`) now sits with the other professionals.

## Why

Today the agency's referral broker is **buyer-only** — a single broker on the
file (`PropertyTransaction.brokerFirmId` + `purchaserBrokerReferral` +
`brokerReferralFee`) that powers the buyer's portal broker card and its fee.

When our **seller is also buying onward**, they need a broker for that onward
purchase too — and the agent often arranges it. Recording it means:

- **Another broker referral fee per file** where the seller buys onward.
- **More accurate fee analytics** (broker revenue currently under-counts onward).
- A truer reflection of the work the agent actually does on the chain.

The only per-side broker we have today is the one the **client** enters
themselves (`ClientMoveInfo.ownBrokerName`, per side, read-only on the file).
That is not a fee-earning agent referral. Phase 2 adds the agent's onward
referral broker.

## Scope + locked decisions

- **Fee-earning, like the buyer's broker** (founder call): the onward broker is a
  full referral with a fee + received toggle, not a plain note. It feeds the same
  broker-fee analytics as the buyer's broker.
- **Only when the seller is buying onward.** Gated on the onward signal
  (`buyingOnward` + a known onward address). No onward → no onward-broker slot.
- **Agent-side only for now.** The onward broker does **not** surface on any
  portal in Phase 2 (see Phase 3).
- **Two brokers, clearly labelled** on an onward file: "Buyer's broker" (existing)
  and "Seller's onward broker" (new), both on the Professionals tab.

## Where the agent records it (entry points)

The onward broker only makes sense once the chain / onward is established, so the
slot appears at exactly those moments — both feeding the same stored value:

1. **New-sale flow** — after the chain step, once the seller is marked as buying
   onward.
2. **Property file → Overview → Professionals** — once the chain is established, a
   second broker slot ("Seller's onward broker") shows beside the buyer's broker.

## Data model (staging migration first — Law 3)

Two clean options; recommend Option A for symmetry with the existing buyer broker.

**Option A — parallel fields on `PropertyTransaction` (recommended):**
- `onwardBrokerFirmId String?`
- `onwardBrokerContactId String?`
- `onwardBrokerReferral Boolean @default(false)` (the seller-side "referred" tick)
- `onwardBrokerReferralFee Int?` (pence)
- `onwardBrokerReferralFeeReceived Boolean @default(false)`

Mirrors the buyer fields exactly, so the UI, save action and analytics
generalise by side with minimal new surface.

**Option B — a per-side broker-referral table** (`BrokerReferral` with a `side`
column). More general (handles future multi-broker cases) but a bigger change and
a data migration of the existing buyer fields. Only worth it if we expect more
than two broker slots per file.

## Reuse (what this hangs off that already exists)

- **UI:** `BrokerSection` / `BrokerPicker` — parameterise by side (buyer vs
  onward) instead of duplicating.
- **Save:** `saveBrokerReferralAction` — extend to accept a side, or add an
  `onward` variant.
- **Gating:** the onward signal (`getOnwardSignalForFile` / the onward tracker's
  `buyingOnward`).
- **Analytics + fees:** the existing broker-fee reporting — include the onward
  fields so onward fees roll up alongside buyer fees.

## Dependency (why this is Phase 2, not now)

The buyer/seller onward tracker is being reworked in parallel (see
`docs/active/chain-far-side/SPEC.md` and `docs/active/onward-visibility/`). The
onward broker attaches to that onward data. Build it **after** the onward-tracker
rework lands so the two don't collide — attach to whatever shape that work
settles on rather than the current one.

## Phase 3 (optional follow-up)

Surface the seller's onward broker on the **seller's portal** — a "speak to a
broker for your onward" card, symmetric with the buyer's broker card. This is the
already-deferred seller-onward portal broker card; do it only once Phase 2 and the
onward-tracker rework are live, so we're not building portal UI on a moving base.

## Build order (Phase 2)

1. Migration (staging) — Option A fields.
2. `saveBrokerReferralAction` side-aware; onward broker resolution helper.
3. Property file — "Seller's onward broker" slot on the Professionals tab, gated on `buyingOnward`.
4. New-sale flow — onward broker step after the chain step.
5. Analytics — include onward broker fees.
6. (Phase 3, separate) seller-portal onward broker card.
