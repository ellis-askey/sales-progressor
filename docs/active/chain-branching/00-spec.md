# Chain Branching (split chains) — Spec (v1)

Status: **LOGIC AGREED with Ellis (2026-09-01). Foundations not yet built.**
Source of truth for the arc. Plain-English first, technical anchors at the end.
Migrations staging-first (Law 3). One concern per PR (Law 5).

This is the "separate later arc" deferred by `docs/active/chain-overhaul/00-spec.md`
Part 9. The edit-surface gap it also mentions (Part 1/3) is fixed separately
(commit f1719e43, 2026-09-01).

---

## Part 1 — The need (Ellis, 2026-09-01)

Some sales fund more than one onward purchase. The driving case: a property
owned by two or three people who are separating, sold once, with each owner then
buying their own separate place. One sale, up to three onward purchases.

Today a chain is a single straight line: one sale above, one below. There is no
way to attach a second or third onward purchase to the same sale.

## Part 2 — Scope (locked)

- **IN:** one sale can fork **upward** into **up to 3** separate onward purchases.
  Each branch can itself be a normal onward chain (a branch can have its own
  onward above it).
- **OUT:** downward forks (several buyers for one property). Not requested.
- **Cap:** hard limit of **3 branches** per fork node.
- **No change** to any existing straight-line chain. Everything additive,
  staging-first, backward compatible.

## Part 3 — The shape, in plain terms

Picture the chain as it is now: a vertical stack, one sale per rung. Branching
adds this: at one sale (the "fork node", the shared property being sold), instead
of a single onward above it, up to three onward purchases sit **side by side**
above it. Each of those behaves like a normal chain node: its own progress bar,
claim status, invite, details, and its own onward above it if it has one.

Everything **below** the fork node (the buyer chain under the shared sale) stays
a single line, unchanged.

## Part 4 — Data model decision (the load-bearing choice)

We keep **one `PropertyChain`** and tag which branch each link belongs to, rather
than splitting into separate chains. Reason: every aggregate the drawer shows
(chain value, claim rate, oldest sale, risk, activity) already reads "all links
in this chain" and keeps working untouched if the branches live in the same
chain. Splitting into child chains would force a rewrite of every one of those.

Two new fields on `ChainLink`:

- **`branchKey String @default("")`** — `""` means the main spine (every existing
  row, and everything at/below the fork). A non-empty key (e.g. a short id)
  groups the links of one branch. The uniqueness rule changes from
  `@@unique([chainId, position])` to `@@unique([chainId, branchKey, position])`,
  so each branch keeps its own clean `0..n` position ladder. `""` default keeps
  all existing rows valid with no data migration.
- **`forkFromLinkId String?`** — set on a branch's bottom link: the spine link it
  sits directly above (the fork node). Null on spine links. Lets us answer "what
  branches fork from this node?" with one query.

A fork node is a spine link that is the `forkFromLinkId` of one or more branch
bottom links (max 3 enforced in code).

Existing chains: `branchKey=""`, `forkFromLinkId=null` everywhere. Zero behaviour
change. The migration is two additive columns + the widened unique index.

## Part 5 — What you'll see and do

- On the shared sale, once it has one onward, a **"+ Add another onward purchase"**
  control appears, allowed up to 3. Each branch you add is a stub you fill in and
  invite exactly like today (invites are manual on existing chains, per the
  2026-09-01 change).
- The drawer renders the shared sale once, then the branches **side by side above
  it**, each with its own card, progress, invite button, and details.
- **Chain value / claim rate / oldest sale / risk** count every branch together
  (one chain, so this is automatic).
- Each branch's agent claims and progresses their file normally, inside their
  branch's own line.

## Part 6 — Build order (each step ships and stands alone; one concern per PR)

1. **Foundations (no visible change).** Add `branchKey` + `forkFromLinkId`; widen
   the unique index. Teach `addChainLink` / position helpers to operate within a
   `(chainId, branchKey)` ladder instead of `(chainId)`. Existing chains behave
   identically (they are all `branchKey=""`). Migration staging-first.
2. **Add + view (the core of the ask).** The "+ Add another onward purchase"
   control (capped at 3) and the side-by-side drawer layout at a fork node.
   `ChainDrawer` / `LinkCard` / `ChainConnector` render the fork; `ChainSection`
   (new-sale builder) gets the same for creating a forked chain up front.
3. **Invites + claim page + invite email copy** made branch-aware. The claim
   landing page currently draws a single ladder and the invite email says
   "you're #X of N"; both need to represent a branch.
4. **Onward tracking at the fork.** The "the sale above me" lookups
   (`lib/services/onward.ts`, `lib/services/chain-neighbour-updates.ts`,
   currently `position - 1`) taught that a fork node has up to 3 sales above it,
   so onward updates reach the right branch.
5. **Aggregates confirmed across branches.** Value/claim/risk/oldest/weakest-link
   and bottleneck reviewed with branch data (mostly free from the single-chain
   choice; this step verifies + fixes edge cases).
6. **Withdrawals across a fork.** The cascade walker (`findNearestClaimedLink`)
   and split machinery (`splitChainAtBoundary`) made branch-aware, with the exact
   rules agreed with Ellis first:
   - a **branch** collapses -> only that branch is affected; the shared sale and
     the other branches continue.
   - the **shared sale** (fork node) collapses -> all branches lose their buyer;
     define notify-all behaviour.
   Until this ships, forked chains simply are not withdrawn through the automated
   cascade (a straight chain still withdraws exactly as today). Guard added so a
   withdraw on a forked chain is handled safely rather than walking one line and
   silently missing the other branches.

## Part 7 — Blast radius (from the 2026-09-01 code map)

Linear assumptions to change, grouped by the step that owns them:

- **Step 1:** `@@unique([chainId, position])`; `lib/chain/positions.ts` (all
  helpers scoped to a branch ladder); `addChainLink` / `writeClientChainStub` /
  `createChainV2` position maths in `lib/services/chains.ts`.
- **Step 2:** `ChainDrawer` (`topLink`/`bottomLink`, `showAddAbove/Below`,
  "everything below moves with it" copy), `LinkCard` ("Position X of N",
  connectors), `ChainSection` (top/bottom/middle model), `AddNodeDrawer`
  (direction), `ChainMap`.
- **Step 3:** `app/claim/*` ladder render; `lib/chain/invite.ts` "#X of N" copy.
- **Step 4:** `lib/services/onward.ts` (`position ± 1`),
  `lib/services/chain-neighbour-updates.ts` (`position - 1`), relist stub in
  `app/actions/transactions.ts` (`ourLink.position - 1`).
- **Step 5:** `lib/chain/summary.ts`, `lib/chain/bottleneck.ts` (mostly
  structure-agnostic; confirm).
- **Step 6:** `lib/chain/withdrawal.ts` (`findNearestClaimedLink`),
  `lib/chain/split.ts`, `ChainNotificationQueue.direction`,
  `lib/email/chainNotifications.ts` ("the property below/above you" copy),
  `buildChainSnapshotForWithdrawal`.

Structure-agnostic already (no change needed): `intel.ts`, `status.ts`,
`is-broken.ts`, `duplicate-detection.ts`, `funnel.ts`, `invite-nudge.ts`,
`ChainActivityCard`, `getChainActivity`, `computeWeightedProgress/Prediction`.

## Part 8 — Risks

- Step 6 (withdrawals across a fork) is the fiddliest and highest-risk part, and
  it touches a live prod flow. It is deliberately last, with a safety guard in
  place from step 1 so forked chains never cascade incorrectly in the meantime.
- Steps 1-2 deliver the feature Ellis asked for (add up to 3, see, invite, claim,
  track). Steps 3-6 make the surrounding flows fully correct.
- Everything additive and staging-first; no existing straight chain changes.

## Appendix — technical anchors (verified 2026-09-01)

- Models: `PropertyChain`, `ChainLink` (`prisma/schema.prisma` ~1800/1829).
  New fields land on `ChainLink`. Unique index at ~1913.
- Position algebra: `lib/chain/positions.ts` (entirely branch-scoped after step 1).
- Insert/create: `lib/services/chains.ts` `addChainLink` (~1010), `createChainV2`
  (~914), `writeClientChainStub` (~1100).
- Aggregates: `lib/services/chains.ts` `getChainV2` value/pricedCount (~549);
  `lib/chain/summary.ts`; `lib/chain/bottleneck.ts`.
- Withdrawal/split: `lib/chain/withdrawal.ts` `findNearestClaimedLink` (~49);
  `lib/chain/split.ts` `splitChainAtBoundary` (~78);
  `app/actions/transactions.ts` `changeStatusAction` cascade block (~793).
- UI: `components/chain/{ChainDrawer,LinkCard,ChainSection,AddNodeDrawer,ChainMap}.tsx`.
- Claim: `app/claim/*`, `app/api/claim/route.ts` (fills the stub in place).
- Onward coupling: `lib/services/onward.ts`, `lib/services/chain-neighbour-updates.ts`.
