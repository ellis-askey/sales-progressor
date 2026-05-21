# Withdrawal Cascade — Stage 2 Implementation Spec (Stopgap)

**Arc:** Chain system  
**Stage:** 2 of withdrawal cascade arc  
**Companion docs:** `docs/audits/withdrawal-cascade-stage1.md`, `docs/audits/chain-system-gaps.md`  
**Date:** 2026-05-19  
**Status:** Awaiting Ellis approval before implementation begins

---

## Scope

### Ships in this stage

- Hook in `changeStatusAction` that fires when a chain-linked transaction is withdrawn
- `notifyChainMatesOfWithdrawal()` function — identifies chain-mates, writes to notification queue; **no email sent**
- `ChainNotificationQueue` schema table — stores pending notification records for later email processing
- `ChainLink.withdrawalStatus = WITHDRAWN` written on the withdrawing agent's own link
- ChainDrawer UI: broken-chain banner when any link in the chain has withdrawn
- LinkCard UI: withdrawn state shown on individual withdrawn links

### Deferred to Phase 2 (full cascade)

- Email templates, copy, voice pass
- Fire-and-forget email send
- Response options (REMARKETING / WAITING links in email)
- `ChainLink.withdrawalStatus` for responding chain-mates (REMARKETING / WAITING)
- `ChainLink.withdrawalRespondedAt`
- Response token generation
- Withdrawing agent seeing chain-mate responses
- `BROKEN` PropertyChain status enum (Ellis chose Option B — derive at query time)

---

## Schema changes (`prisma/schema.prisma`)

### New model: `ChainNotificationQueue`

```prisma
model ChainNotificationQueue {
  id                       String    @id @default(cuid())
  chainId                  String
  withdrawingTransactionId String
  withdrawingUserId        String?
  withdrawingReason        String?   // fallThroughReason verbatim; translated to plain language when email is wired
  recipientUserId          String
  recipientLinkId          String    // ChainLink.id of the recipient
  recipientEmail           String    // snapshot at time of queue entry; email may change
  createdAt                DateTime  @default(now())
  notifiedAt               DateTime? // null = pending; set when notification fires (Phase 2)

  @@index([notifiedAt])              // efficient "find pending notifications" scan
  @@index([withdrawingTransactionId])
}
```

No foreign key relations — queue rows should survive chain/transaction deletion for audit. Snapshots `recipientEmail` at creation time so the email send in Phase 2 doesn't need a second user lookup.

### Amendment to `ChainLink`

`withdrawalStatus` is already on the model (`ChainWithdrawalStatus?`). No schema change needed. This stage writes `WITHDRAWN` to the withdrawing agent's link; Phase 2 writes `REMARKETING`/`WAITING` to responding chain-mates.

---

## New file: `lib/chain/withdrawal.ts`

```typescript
// lib/chain/withdrawal.ts
// Withdrawal cascade — notification queue and state changes.
// Email send is deferred; this module builds the queue and updates link state.

import { prisma } from "@/lib/prisma";

export async function notifyChainMatesOfWithdrawal(
  withdrawingTransactionId: string,
  withdrawingUserId: string,
  fallThroughReason: string | null,
): Promise<void> {
  // 1. Find the withdrawing transaction's chain link
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: withdrawingTransactionId },
    select: { chainLinkId: true },
  });
  if (!tx?.chainLinkId) return; // not in a chain — no-op

  const withdrawingLinkId = tx.chainLinkId;

  // 2. Mark the withdrawing agent's own link as WITHDRAWN
  await prisma.chainLink.update({
    where: { id: withdrawingLinkId },
    data: { withdrawalStatus: "WITHDRAWN" },
  });

  // 3. Find the parent chain and all OTHER claimed links
  const link = await prisma.chainLink.findUnique({
    where: { id: withdrawingLinkId },
    select: {
      chainId: true,
      chain: {
        select: {
          links: {
            where: {
              inviteStatus: "CLAIMED",
              transactionId: { not: null },
              id: { not: withdrawingLinkId },
            },
            select: {
              id: true,
              claimedByUserId: true,
              claimedBy: { select: { email: true } },
            },
          },
        },
      },
    },
  });
  if (!link) return;

  const chainMates = link.chain.links.filter(
    (l) => l.claimedByUserId && l.claimedBy?.email,
  );
  if (chainMates.length === 0) return;

  // 4. Write a queue entry for each chain-mate
  await prisma.chainNotificationQueue.createMany({
    data: chainMates.map((mate) => ({
      chainId: link.chainId,
      withdrawingTransactionId,
      withdrawingUserId,
      withdrawingReason: fallThroughReason,
      recipientUserId: mate.claimedByUserId!,
      recipientLinkId: mate.id,
      recipientEmail: mate.claimedBy!.email!,
    })),
    skipDuplicates: false,
  });

  console.log(
    `[WITHDRAWAL_NOTIFICATION_PENDING] chain=${link.chainId} withdrawing=${withdrawingTransactionId} ` +
    `recipients=${chainMates.length} reason=${fallThroughReason ?? "none"}`,
  );
}
```

**Notes:**
- Pure async — caller fire-and-forgets (`.catch(console.error)`)
- Does not throw on missing chain — graceful no-op if `chainLinkId` is null
- `skipDuplicates: false` — if somehow called twice for the same withdrawal, duplicate rows are created. A future dedup can be added if needed; for now duplicates are harmless (both rows will be `notifiedAt = null` until email is wired)
- `claimedBy.email` is accessed here — need to verify `User.email` is selectable in Prisma (it is — email is a required field on User)

---

## Hook point: `app/actions/transactions.ts`

### Amendment 1 — extend `tx` select to include `chainLinkId`

Current select (line ~285):
```typescript
const tx = await prisma.propertyTransaction.findFirst({
  where: scopeOwnershipWhere(scope, transactionId),
  select: { id: true, status: true },
});
```

New:
```typescript
const tx = await prisma.propertyTransaction.findFirst({
  where: scopeOwnershipWhere(scope, transactionId),
  select: { id: true, status: true, chainLinkId: true },
});
```

### Amendment 2 — add withdrawal cascade call

After the existing `if (status === "completed")` block (line ~339), add:

```typescript
  if (status === "withdrawn" && tx.chainLinkId) {
    notifyChainMatesOfWithdrawal(transactionId, session.user.id, fallThroughReason ?? null)
      .catch(console.error);
  }
```

**Import to add:**
```typescript
import { notifyChainMatesOfWithdrawal } from "@/lib/chain/withdrawal";
```

---

## Chain health derivation: `lib/services/chains.ts`

No schema change (Ellis chose Option B). Add a helper to compute chain health from existing data:

```typescript
export function isChainBroken(chain: ChainV2): boolean {
  return chain.links.some((l) => l.transaction?.status === "withdrawn");
}
```

`transaction.status` is already in `LINK_V2_SELECT` (line 159) — no query change needed.

---

## UI changes

### `components/chain/ChainDrawer.tsx` — broken-chain banner

After the existing chain fetch, compute:

```typescript
const chainBroken = chain ? isChainBroken(chain) : false;
```

Render a banner at the top of the chain list when `chainBroken`:

```jsx
{chainBroken && (
  <div style={{
    margin: "0 0 12px",
    padding: "10px 12px",
    background: "rgba(239,68,68,0.08)",
    border: "0.5px solid rgba(239,68,68,0.2)",
    borderRadius: 8,
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
  }}>
    <span style={{ fontSize: 14, lineHeight: 1 }}>⚠</span>
    <p style={{ fontSize: 12, color: "var(--agent-danger)", margin: 0, lineHeight: 1.5 }}>
      A sale in this chain has withdrawn. Notifications are queued — check back for updates.
    </p>
  </div>
)}
```

Copy is placeholder — voice pass is deferred.

### `components/chain/LinkCard.tsx` — withdrawn link state

The `link.transaction?.status === "withdrawn"` check can be added inside the existing LinkCard render. When a claimed link's transaction is withdrawn, show a withdrawn overlay on the status badge area:

Current: claimed links show progress count and "Your file" / "Claimed" badge.  
New: when `link.transaction?.status === "withdrawn"`, also render a `Withdrawn` tag (red, consistent with the existing `statusBadgeColors.withdrawn` token from `lib/utils.ts`).

Exact insertion point: after the existing status kind check in LinkCard, add:

```jsx
{link.transaction?.status === "withdrawn" && (
  <span style={{
    fontSize: 10,
    fontWeight: 600,
    color: "#dc2626",
    background: "rgba(239,68,68,0.1)",
    border: "0.5px solid rgba(239,68,68,0.2)",
    borderRadius: 4,
    padding: "2px 6px",
    marginLeft: 4,
  }}>
    Withdrawn
  </span>
)}
```

---

## Files changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `ChainNotificationQueue` model |
| `prisma/migrations/...` | Migration for new table |
| `lib/chain/withdrawal.ts` | New file — `notifyChainMatesOfWithdrawal()` |
| `lib/services/chains.ts` | Add `isChainBroken()` helper |
| `app/actions/transactions.ts` | Extend `tx` select; add withdrawal hook after status update |
| `components/chain/ChainDrawer.tsx` | Import `isChainBroken`; render broken-chain banner |
| `components/chain/LinkCard.tsx` | Render withdrawn tag on claimed links with withdrawn transaction |

---

## Verification plan

1. **No chain — no-op:** Transaction with `chainLinkId = null` marked withdrawn → no `ChainNotificationQueue` rows created, no errors, status updates normally.

2. **In a chain, solo (no claimed chain-mates):** Transaction in a chain where all other links are unclaimed stubs → `ChainLink.withdrawalStatus = WITHDRAWN` is set on the withdrawing link; zero `ChainNotificationQueue` rows created (no recipients).

3. **In a chain, one claimed chain-mate:** Transaction in a 2-link chain where the other link is claimed → `ChainLink.withdrawalStatus = WITHDRAWN` set; one `ChainNotificationQueue` row created with correct `recipientUserId`, `recipientEmail`, `withdrawingReason`.

4. **In a chain, multiple claimed chain-mates:** 4-link chain, all 4 claimed → 3 `ChainNotificationQueue` rows created; none for the withdrawing agent.

5. **ChainDrawer shows broken-chain banner:** After withdrawal, any user opening ChainDrawer for any link in that chain sees the banner. Users on chains with no withdrawn links do not see the banner.

6. **LinkCard shows withdrawn tag:** The withdrawn transaction's link in ChainDrawer shows the "Withdrawn" tag alongside its existing badge. Non-withdrawn links are unchanged.

7. **`npx tsc --noEmit` passes.**

8. **Prisma migration applies cleanly to staging.**

---

## What Phase 2 wires into this

Phase 2 doesn't rebuild anything in this spec. It extends it:

- `ChainNotificationQueue` rows where `notifiedAt IS NULL` → email sender processes them, sets `notifiedAt`
- Response links in email → new `ChainLink.withdrawalStatus` update (REMARKETING / WAITING) on responding chain-mate's link
- `withdrawalRespondedAt` written when response lands
- ChainDrawer updated to show response status per link

The queue table is the join point between this stage and Phase 2.

---

*End of Stage 2 spec. Awaiting Ellis approval before implementation begins.*
