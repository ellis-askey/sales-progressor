# Referral ledger — spec

Status: proposed (awaiting build go-ahead)
Author: Ellis + Claude
Date: 2026-09-28

## Problem

Referral income lives in three fixed column-sets on `PropertyTransaction`
(solicitor, buyer-broker, onward-broker). One buyer, one slot each. When a sale
falls through and a new buyer is introduced (a relist), the previous buyer's
referral has nowhere to go, so it is either overwritten (revenue lost) or left in
place and misattributed to the new buyer.

Broker referrals are the sharp case: a broker pays out at mortgage
submission/offer, i.e. BEFORE completion, so a fall-through can leave a genuinely
earned fee that must not be wiped. Solicitor referrals pay on completion, so a
fall-through usually means unearned — except the single generic slot doesn't say
whether the referred solicitor was the buyer's (gone) or the seller's (stays and
completes with the new buyer).

## Decisions (locked 2026-09-28)

1. **Solicitor referral is split into buyer-side and seller-side.** On relist the
   buyer-side referral is voided (unearned, that buyer is gone); the seller-side
   referral carries untouched (the seller completes with the new buyer).
2. **A broker referral counts as "earned" once the mortgage application is
   submitted (milestone PM5).** After that point relist must never wipe it.
   Before it (still pending) a relist voids it.
3. **No clawback feature.** A fee that reverses is handled manually (edit/zero
   the fee on the file). Status set is therefore `pending | earned | received`.
4. **Full ledger** (rows), not a JSON snapshot on the archived round.

### How referrals get captured (clarified 2026-09-28)

A referral is recorded when a firm is chosen for the file AND that firm is one of
the agency's saved partner/recommended firms — the agent gets a "mark as referral"
tick at that point (applies to both solicitor and broker). No partner firm = no
referral option. This is the single capture path for new referrals, and it's what
the relist new-buyer flow reuses: when the agent sets the new buyer's solicitor,
if it's a partner firm they can tick it as a referral there too.

- The **seller's** solicitor referral simply carries across a relist. It is never
  announced — the seller and their solicitor haven't changed.
- The **old buyer's** referral is shown in that buyer's archived-round drawer
  (its history), not on the live file.

## Model

```prisma
enum ReferralKind {
  buyer_solicitor   // round-attributed; wiped on relist if unearned
  seller_solicitor  // file-level; carries across relist (seller unchanged)
  buyer_broker      // round-attributed; kept if earned (PM5+), else voided
  onward_broker     // file-level; the seller's onward-purchase broker
}

enum ReferralStatus {
  pending   // recorded, not yet earned
  earned    // broker: PM5 reached. solicitor: completion reached
  received  // fee actually collected
}

model Referral {
  id               String         @id @default(cuid())
  transactionId    String
  buyerRoundId     String?        // set for buyer_* kinds; null for seller_*/onward
  kind             ReferralKind
  // Typed FK by kind (SolicitorFirm vs BrokerFirm are separate tables) plus a
  // name snapshot so the record survives firm edits/deletes (mirrors QuoteRequest).
  solicitorFirmId  String?
  brokerFirmId     String?
  brokerContactId  String?
  firmNameSnapshot String
  feePence         Int?
  vat              FeeVatTreatment @default(plus)
  status           ReferralStatus  @default(pending)
  earnedAt         DateTime?
  receivedAt       DateTime?
  notes            String?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  transaction PropertyTransaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  buyerRound  BuyerRound?         @relation(fields: [buyerRoundId], references: [id], onDelete: SetNull)

  @@index([transactionId])
  @@index([buyerRoundId])
  @@index([kind, status])
}
```

Attribution rule: `buyer_*` rows carry the round's `buyerRoundId`; `seller_*` and
`onward_broker` rows have `buyerRoundId = null` (file/seller-level, one active at
a time across all buyers).

## Relist behaviour (the whole point)

At relist, for the OUTGOING round:

| Kind | On relist |
|---|---|
| `buyer_broker`, status `earned`/`received` (PM5 was reached) | **Keep**, stays attached to the archived round. Real revenue, correctly attributed. |
| `buyer_broker`, status `pending` (PM5 not reached) | **Void** (delete). Never earned. |
| `buyer_solicitor` (any status short of a real completion) | **Void**. That buyer is gone; solicitor referral only earns on completion, which didn't happen. |
| `seller_solicitor` | **Keep, untouched.** Seller completes with the new buyer. |
| `onward_broker` | **Keep, untouched.** Seller's onward move, nothing to do with the buyer. |

The new round starts with no buyer referrals. The new buyer's broker/solicitor
referral is captured fresh (see new-buyer flow).

## Lifecycle hooks

- `buyer_broker`: flips `pending → earned` (+ `earnedAt`) when PM5 completes on
  that round. `earned → received` when the fee is marked collected.
- `buyer_solicitor` / `seller_solicitor`: `pending → earned` on completion
  (VM20/PM27). `→ received` when collected.
- All manual-editable (fee, status) from the file's Referral/Broker sections and
  the Command Centre.

## Phases

**Phase 0 — interim safety (no schema change).** Relist stops wiping the broker
referral columns (the current "wipe if not received" can bin an earned-but-unpaid
fee). Preserve broker untouched until the ledger lands. Buyer-side field clears
already shipped stay; broker piece reverts to preserve.

**Phase 1 — model + migration.** Add `Referral` + enums. Staging first, verify,
then prod (Law 3).

**Phase 2 — backfill.** One-shot script maps existing column-sets to rows:
buyer-broker → `buyer_broker` on the active round (status from
`brokerReferralFeeReceived` + PM5 state); onward → `onward_broker`. For the single
solicitor slot the side is INFERRED, not guessed: match `referredFirmId` against
the file's `purchaserSolicitorFirmId` → `buyer_solicitor`, against
`vendorSolicitorFirmId` → `seller_solicitor`. If it matches neither (or both),
flag that row for one-time manual classification in the Command Centre. Registered
in SCRIPTS_REGISTRY with a deletion date (Law 15).

**Phase 3 — rewire, one consumer at a time (Law 16).** Point every reader/writer
at the ledger: the file Referral + Broker sections, fees card + net-income maths
(`fees.ts` `feeExVat` sites), completions dashboard totals (`agent.ts`),
intro-call, Command Centre revenue view, and the QuoteRequest link (surveyor/
broker quotes already carry their own `referralFeePence`/`referralFeeCollected` —
candidate to fold in later). Keep the old columns as a read-through mirror until
every consumer is moved, then drop them in a final migration.

**Phase 4 — relist behaviour on the ledger.** Implement the table above in
`relistTransactionImpl`, replacing the Phase-0 preserve with the proper
keep/void rules. Add the PM5 earned-flip hook.

**Phase 5 — new-buyer flow + capture + Command Centre.**
- Referral capture at firm-select: when the agent picks a solicitor or broker that
  is one of the agency's partner/recommended firms, offer a "mark as referral"
  tick (fee prefilled from the partner's default, editable). This is the general
  capture path; the relist new-buyer solicitor/broker step reuses it.
- Archived-round drawer shows the previous buyer's referral(s) as history.
- The seller's referral carries silently — no prompt.
- Command Centre: per-file referral history across rounds, and the solicitor-side
  manual-classification control for any backfilled rows Phase 2 couldn't infer.

No clawback phase (decision 3 — manual).

## Out of scope

- Automatic clawback / un-earn (manual only).
- Unifying QuoteRequest referral tracking into this model (candidate follow-up,
  noted in Phase 3, not built here).

## Resolved (2026-09-28)

- Existing solicitor slot side: INFERRED at backfill by matching `referredFirmId`
  to the file's purchaser/vendor solicitor firm; only genuine no-match rows go to
  manual classification. (No blanket default.)
- Reporting: `earned` counts as forecast income, `received` as banked, shown
  separately (fees card + analytics).
- Referral capture is gated on the firm being a partner/recommended firm; seller
  referrals carry silently; the old buyer's referral lives in the archived-round
  drawer.
