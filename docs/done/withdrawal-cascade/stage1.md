# Withdrawal Cascade — Stage 1 Investigation

**Arc:** Chain system  
**Stage:** 1 of its own arc (investigation + design proposal)  
**Companion docs:** `docs/audits/chain-system-inventory.md`, `docs/audits/chain-system-gaps.md`  
**Date:** 2026-05-19  
**Status:** Awaiting Ellis approval before Stage 2 (implementation spec)

---

## Current behaviour (facts)

The withdrawal flow today:

1. Agent opens status dropdown on transaction detail (`StatusControl.tsx`)
2. Selects "Withdrawn"
3. Modal appears: reason picker (Buyer withdrew / Seller withdrew / Chain broke / Mortgage issue / Survey issues / Gazundering / Gazumping / Solicitor delays / Personal circumstances / Other)
4. Agent confirms → `changeStatusAction(transactionId, "withdrawn", reason)` fires
5. Server: updates `status = "withdrawn"` and `fallThroughReason = reason` on PropertyTransaction
6. Creates internal note: "X changed status from Active to Withdrawn. Reason: Y."
7. If status `"completed"` gate: completion surveys sent. No equivalent gate or side-effect for `"withdrawn"`.
8. **Nothing chain-related happens.** Chain-mates are not notified. `ChainLink.withdrawalStatus` is never written.

The hook point for a cascade is `changeStatusAction` at `app/actions/transactions.ts:317` — immediately after the `prisma.propertyTransaction.update()` call, where `status === "withdrawn"` can be detected.

---

## Data access path for finding chain-mates

Given a `transactionId` being withdrawn:

```
PropertyTransaction.chainLinkId
  → ChainLink (the withdrawing agent's link)
  → ChainLink.chainId
  → PropertyChain
  → PropertyChain.links (all ChainLinks in the chain)
  → filter: inviteStatus === "CLAIMED" AND transactionId !== null AND transactionId !== withdrawingTransactionId
  → each remaining link → claimedByUserId → User.email / User.name
  → each remaining link → transaction → propertyAddress, status
```

This is a straightforward join. `getChainForTransactionV2()` in `lib/services/chains.ts` already does most of this — a new `getChainMatesForWithdrawal(transactionId)` helper can be thin.

If `PropertyTransaction.chainLinkId` is null (not in a chain), the cascade is a no-op.

---

## The 7 open questions — proposed answers

### Q1. Who gets notified?

**All claimed chain-mates.** Not just adjacent positions.

Reason: in a 5-link chain [A – B – C – D – E], if C withdraws, D and E are affected even though they're not adjacent to C. Limiting to adjacent links (B and D) would leave E uninformed. The chain is a single transaction pipeline — a break anywhere affects everyone.

Scope: all `ChainLink` rows in the same chain where `inviteStatus === "CLAIMED"` and `transactionId IS NOT NULL` and `transactionId != withdrawingTransactionId`.

---

### Q2. What options are offered to chain-mates?

The schema has `ChainWithdrawalStatus`: WITHDRAWN / REMARKETING / WAITING.

Proposed meaning:

| Option | What it means | What it triggers |
|---|---|---|
| **REMARKETING** | "I'm working to find a new buyer/seller to fill the gap" | Records response; originator sees it in ChainDrawer |
| **WAITING** | "I'm watching to see if the chain reforms before acting" | Records response; originator sees it |
| *(implicit)* **Also withdrawing** | Agent withdraws their own file separately | Standard withdrawal flow on their transaction — not a cascade option |

For the stopgap version: no response options offered at all — email is purely informational ("your chain-mate at [address] has withdrawn, contact them directly"). ChainLink.withdrawalStatus remains unset.

For the full version: response options offered via two links in the notification email (similar to the existing claim/decline pattern — GET routes that record the response). The withdrawing agent then sees aggregated responses in ChainDrawer ("2 remarkets, 1 waiting").

---

### Q3. What does the withdrawing agent see?

**Stopgap:** Nothing additional. Existing withdrawal confirmation is unchanged.

**Full version:** After confirming withdrawal, a toast or confirmation note: "We've notified 3 chain-mates." Over time, a summary in ChainDrawer showing which links responded (REMARKETING / WAITING / no response) with timestamps.

---

### Q4. Does PropertyChain.status change?

**Stopgap:** No schema change. Chain status stays ACTIVE. ChainDrawer shows the individual link with "Withdrawn" status on the transaction.

**Full version:** Two options:

Option A — Add `BROKEN` to `ChainStatus` enum (new schema migration):
- Chain transitions to `BROKEN` when any claimed link withdraws
- ChainDrawer header shows a broken-chain state
- Cleaner data model; easy to query "all broken chains"

Option B — Derive chain health from link states at query time:
- No new enum value
- `getChainForTransactionV2()` computes health on read: if any transaction in the chain is `withdrawn`, return `health: "broken"`
- No migration; slightly more complex query

**Recommended:** Option A (BROKEN enum) for the full version. Cleaner, easier to filter in reporting later.

---

### Q5. Does withdrawal trigger anything on the withdrawing agent's own file?

No. The agent has already acted — they changed status to withdrawn. Nothing further should happen automatically to their file. The cascade is entirely outbound.

One edge case: if the chain itself goes to BROKEN status (Q4, Option A), the withdrawing agent's ChainDrawer would reflect that — same as every other chain member. That's acceptable.

---

### Q6. Re-entry path — what does REMARKETING mean mechanically?

For the stopgap: REMARKETING is purely a response label — no mechanical action. It records intent.

For the full version, two sub-scenarios:

**Scenario A: The chain-mate is a purchaser** (buying from the withdrawn seller)
- REMARKETING means they're finding a new property to buy
- Mechanically: they would remove the withdrawn stub, add a new stub above for a replacement seller, and invite that new agent
- Existing "add link above/below" and "remove link" flows handle this — no new mechanics needed

**Scenario B: The chain-mate is a vendor** (selling to a buyer in the chain)
- REMARKETING means they're finding a new buyer
- Mechanically: they would need to update the link below them with new stub details
- Same existing flows apply

**WAITING** means no mechanical action — agent is watching before committing.

The re-entry mechanics are already covered by existing "add link / remove link" flows. No new code needed for re-entry itself; just the right UX guidance after a withdrawal.

---

### Q7. Timing and urgency

The email must fire immediately when `changeStatusAction` confirms the withdrawal — not batched, not deferred. A chain-mate who doesn't hear for 24 hours may have instructed their solicitor to press on, incurring costs.

For the stopgap: fire-and-forget (same pattern as `sendChainInvite` — called after the DB update, not awaited in the request). Errors caught and logged but not surfaced to the withdrawing agent.

For the full version: same async pattern. No delivery confirmation mechanism needed — the risk of a lost email is low and the cost of adding delivery confirmation infrastructure is high.

---

## Proposed design

### Stopgap (Phase 1 minimum — ships before first external invites)

**What it does:**
- When `changeStatusAction` sets `status = "withdrawn"` on a transaction with `chainLinkId !== null`, fire an async notification to all claimed chain-mates
- Email is purely informational: no response links, no option recording
- No schema changes
- No UI changes

**New function:** `notifyChainMatesOfWithdrawal(transactionId, withdrawnByUser, fallThroughReason)` in `lib/chain/invite.ts` (or a new `lib/chain/withdrawal.ts`)

**Email:**
- **To:** each claimed chain-mate agent's email
- **Subject:** `Chain update — [address] has withdrawn`
- **Body:** "[Agent name] at [agency name] has marked [property address] as withdrawn. Reason: [reason]. You're in the same chain. Please contact them or your own client directly to assess your position. You may wish to update your chain view at [link to their transaction]."
- **From:** platform sender (same as invite emails)
- **Note:** Does NOT expose the chain-mate's contact details to other chain-mates. Each email is individual.

**Hook point:** `app/actions/transactions.ts` line ~340, after the status update and internal note creation:

```typescript
if (status === "withdrawn") {
  notifyChainMatesOfWithdrawal(transactionId, session.user, fallThroughReason ?? null)
    .catch(console.error); // fire and forget
}
```

**Scope:** Small (1 new function, 1 hook line, 1 email template). No migration.

---

### Full cascade (Phase 2)

Extends the stopgap with:

1. **Schema:**
   - Add `BROKEN` to `ChainStatus` enum (`prisma/schema.prisma`)
   - Migration: no data change needed (existing chains stay ACTIVE)

2. **Response options in notification email:**
   - Two links: `[portal]/claim/withdrawal-response?token=...&response=REMARKETING` and `[portal]/claim/withdrawal-response?token=...&response=WAITING`
   - New route: `app/claim/withdrawal-response/route.ts` — validates token, sets `ChainLink.withdrawalStatus` and `withdrawalRespondedAt` on the responding agent's link
   - Token: reuse existing `inviteToken` for authenticated chain-mates who are already claimed; or generate a separate short-lived response token
   - **Decision needed:** response tokens — reuse invite token (already exists on the link) vs new separate token. Reuse is simpler; new token is cleaner. To discuss.

3. **Chain status update:**
   - After notifying chain-mates, update `PropertyChain.status = "BROKEN"`

4. **ChainDrawer UI updates:**
   - Show "Chain broken" banner when `chain.status === "BROKEN"`
   - Show each link's response status (REMARKETING / WAITING / no response) in LinkCard
   - Show a counter on the withdrawing agent's own chain view: "2 of 3 chain-mates responded"

5. **Withdrawing agent confirmation:**
   - Toast after withdrawal confirmed: "Chain-mates notified"
   - (optional v2) Notification when responses come in

---

## Sequencing decision for Ellis

Two paths (as noted in gap analysis):

**Option A — Full cascade before any external invites**
- No external agent is ever in a chain that breaks silently
- Longer Phase 1; the `BROKEN` schema migration and UI work add 2–3 weeks
- Safest for trust

**Option B — Stopgap in Phase 1, full cascade in Phase 2**
- First external invites can go out once stopgap ships
- Chain-mates get a bare notification email but no structured response options
- Full orchestration follows in Phase 2
- External agents experience one withdrawal without options (stopgap covers them); full feature ships quickly after

**Recommendation for Stage 2:** Proceed with Option B. The stopgap is small (1 function, 1 hook), eliminates the trust risk (chain-mates are informed), and unblocks external invites. Full cascade is well-scoped and can ship within 2 weeks of Phase 1.

---

## Open items for Ellis to confirm before Stage 2 (implementation spec)

1. **Option A vs Option B?** Full cascade before invites, or stopgap first?

2. **Response tokens (full cascade only):** Reuse existing `inviteToken` for withdrawal responses, or generate a new short-lived response token per withdrawal event?

3. **BROKEN chain status:** Option A (new `BROKEN` enum value) or Option B (derive health at query time)?

4. **Withdrawing agent's reason in notification email:** Include the `fallThroughReason` in the chain-mate notification, or omit it? (Included above as the default — seems helpful for chain-mates to know whether it's a buyer problem or a solicitor delay, so they can assess their own position.)

5. **All chain-mates vs adjacent only:** Confirmed "all" above. Just flagging for Ellis's sign-off.

---

*End of Stage 1. Awaiting Ellis approval on the design and open items before Stage 2 (implementation spec) begins.*
