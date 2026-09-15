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

---

## Locked build plan (2026-09-15) — decisions + exact fee-feed map

Founder decisions:
- **Storage: Option A** — parallel `onwardBroker*` fields on `PropertyTransaction`.
- **Gaps: close them for BOTH buyer and onward** — broker fees also go into the
  CSV export, the completions screen, and the revenue warnings (they are absent
  today even for the buyer broker).
- **Analytics: MERGE** — onward broker fees fold into the same per-firm broker
  income figure (a firm can be a buyer-broker on one file and an onward-broker on
  another). No separate line.

### Schema (staging migration first)

Add to `PropertyTransaction` (mirrors the buyer set at schema.prisma:457-461):
`onwardBrokerFirmId`, `onwardBrokerContactId`, `onwardBrokerReferralFee Int?`,
`onwardBrokerReferralFeeReceived Boolean`, `onwardBrokerReferral Boolean`.

A second relation to `BrokerFirm`/`BrokerContact` forces **named relations** on
both sides (Prisma). Name the existing buyer relations and add the onward pair:
- `brokerFirm @relation("TxBuyerBroker")` + `onwardBrokerFirm @relation("TxOnwardBroker")`
- `brokerContact @relation("TxBuyerBrokerContact")` + `onwardBrokerContact @relation("TxOnwardBrokerContact")`
- back-relations on `BrokerFirm` / `BrokerContact` (`transactions` + `onwardTransactions`).
Relation names are Prisma-logical only — the migration adds columns + 2 FKs, nothing else.

### Exact places the buyer broker fee feeds today — onward must feed all of them

Verified by trace (2026-09-15):
1. **Add-sale "what you'll earn"** — `components/transactions-v2/EarningsBuilder.tsx:83,93`
   (`net = commission(incVAT) + solicitorRef + brokerRef − progressionCost`). Add
   `onwardBrokRef` term + a breakdown row.
2. **Property file "Fees" card** — `components/transaction/AgentFileSidebar.tsx:231-235,245`
   (`totalFeesPence` + `referrals`); source select in `SidebarPanel.tsx:128-129,332`
   and `OverviewPanel.tsx:217-218`. Add the onward term to both + a display row.
3. **Analytics broker income** — `lib/services/analytics.ts` `brokerReferralStatsFromWhere`
   (286-315). MERGE: widen `where` to also match `onwardBrokerFirmId`, select onward
   fee/received, add into `feeExpectedPence/feeReceivedPence/referralCount/pendingCount`.
   Auto-flows to the analytics card (`AnalyticsClientShell.tsx:631-660`) and Partners.

Progression-fee note: the broker referral is **always income, added on top**. Our
fee is only subtracted on **outsourced** files (self-progressed = nothing
subtracted). The onward broker fee is never netted against our fee.

### Gaps to CLOSE (decision b) — for BOTH buyer + onward

These ignore the broker fee today; add both buyer + onward broker fees:
1. **CSV export** — `app/api/agent/analytics-export/route.ts` (REFERRAL INCOME
   section sums `referralFee` only); requires selecting the broker fees in
   `getAgentTransactions` (`lib/services/agent.ts:137-139`).
2. **Completions** — `components/completions/CompletionsGroupList.tsx`,
   `CompletedSection.tsx`, `CompletionFileRowView.tsx` (agent fee only today);
   add broker fees to the row types + `groupFeeTotal` + row displays.
3. **Revenue warnings** — `lib/services/signals/detectors/revenue-at-risk.ts`
   (fires on missing agent fee) and `components/analytics/MissingFeeRow.tsx`.
   Decision within: flag a file where a broker is set but its fee is missing /
   unreceived, and include broker fees in the "at risk" figures.

### Side-aware components

- `components/transaction/BrokerSection.tsx` — add `side: "purchaser" | "vendor"`;
  switch heading, gating (buyer = `purchaseType === "mortgage"`; onward =
  `buyingOnward`), copy, the referred flag, and the field-set read/written.
- `app/actions/transactions.ts` `saveBrokerReferralAction` (~1438-1476) — add
  `side`, branch the `update` data to the buyer or onward columns; create-path
  (~1576-1622) accepts onward fields.
- `components/transaction/OverviewPanel.tsx` — render a second `BrokerSection`
  (`side="vendor"`) in Professionals, gated on `buyingOnward`.
- New-sale: `form/types.ts` (+ field + default), `Stage2Sections`/`SolicitorSection`
  (second broker slot, gated on chain/onward), `NewSaleFlow.tsx:887` (submit),
  draft round-trip, `createTransactionAction`.

### Build stages (each a commit, tsc-clean)

1. Schema + migration (staging) + `prisma generate`.
2. Side-aware save action + `BrokerSection` + Professionals second slot.
3. New-sale onward broker slot + add-sale total.
4. Property-file fee tot-up.
5. Analytics merge.
6. Gap-closing: export + completions + warnings (buyer + onward).
