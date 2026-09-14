# Chain far-side — walkthrough (seeded)

How to see everything built (Stages 1-3) locally. The feature is **agent-only**;
nothing here appears on the client portal.

## 0. One-time: seed a demo file

```
npx tsx scripts/seed-chain-far-side.ts
```

It sets up, on your first customer agency, a file **"12 Chain Demo Road"** in the
middle of a 3-link chain (onward "2 Evans Way" above, related "8 Brambling
Crescent" below) and fills all four trackers with a few reported steps. It prints
the file link at the end:

```
http://localhost:3001/agent/transactions/<id>
```

(If the local Prisma client is in `engine=none` mode, run `npx prisma generate`
with the dev server stopped first, then re-run the seed.)

## 1. See the near/far toggle (the main feature)

1. Open the demo file → **Overview** tab → the **Property chain** card.
2. You'll see three rows: **Onward purchase** (2 Evans Way) up top, the current
   sale in the middle, **Related sale** (8 Brambling Crescent) below.
3. On the **Onward purchase** row, click **View**. The tracker opens with a
   toggle:
   - **Buyer's steps** (default) — our seller acting as the buyer (PM steps),
     e.g. "Buyer has instructed their solicitor" reported.
   - **Seller's steps** — click it. Now you see the **onward property's seller**
     (VM steps), e.g. "Instruct your solicitor" reported. This is the new far side.
4. Do the same on **Related sale**: toggle **Seller's steps** (our buyer selling)
   ↔ **Buyer's steps** (the related buyer, PM steps).

## 2. Confirm / undo a far-side step (agent-only)

1. On a far side (e.g. Onward → Seller's steps), find the next available step and
   click **Confirm** → optionally add a date → **Save reported**. It appears as
   "reported", stamped by you (the agent).
2. **Undo** rolls it back. Order is enforced exactly like a normal sale — you
   can't confirm a step before its prerequisites.
3. Note it never asks you to re-enter the property type on the far side — it's
   pre-filled from the near side (same property). The related buyer's far side is
   the one exception: it asks how that buyer is buying (mortgage/cash).

## 3. See the carry-over into the post-claim reconcile

This is what the neighbour agent gets when they later claim their file.

1. In the chain drawer (**Open chain** on the card), invite the **onward** stub
   ("2 Evans Way") — copy its share link from the ⋯ menu.
2. In a second browser (or incognito), log in as a **different** agency's agent
   and open the share link → **Claim this sale** → confirm tenure + purchase type.
3. On the freshly-claimed file's Overview, the **"Where's this sale up to?"**
   prompt now says it's **pre-ticked from the chain** — open it and you'll see
   the steps you reported on the demo file (both the buyer and seller sides)
   already ticked, ready to review/adjust and apply.
4. What the claimer sees is **anonymised**: the step and its date, never who
   reported it or which agency. Back on the demo file, the onward tracker now
   reads **"Handled up the chain"** (superseded — the real file owns it now).

## What's where (for reference)
- Toggle + card: `components/transaction/PropertyChainCard.tsx`,
  `components/transaction/OnwardPurchaseCard.tsx`.
- Engine + far-side kinds: `lib/services/onward.ts` (`DIRECTION`,
  `getInheritedProgressForTransaction`), `app/actions/onward.ts`.
- Carry-over into reconcile: `components/transaction/ReconcileLaterAsync.tsx` +
  `ReconcileLaterBanner.tsx`.
- Spec: `docs/active/chain-far-side/SPEC.md`.
