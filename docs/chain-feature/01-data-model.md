# Chain Feature — Data Model

## Existing schema (read first)

Inspect `prisma/schema.prisma` lines 647–671 for the current `PropertyChain` and `ChainLink` models, and line 179 for the `PropertyTransaction` relationship. Do not assume the existing structure matches what's described below — verify first, then extend.

If the existing models are sufficient, extend them. If they conflict with what's needed below, propose schema changes via migration (do not silently rename or repurpose existing fields).

## Required entities for v1

### `PropertyChain`

The container for a chain of linked transactions. One per chain.

Required fields (extend existing model if it doesn't have these):

- `id` — primary key
- `createdAt`, `updatedAt` — timestamps
- `createdByUserId` — the user who first created the chain (the original originator). Note: this is for audit only — operational ownership of nodes is determined per-node, not per-chain.
- `status` — enum: `ACTIVE`, `COMPLETED`, `ARCHIVED`. v1 only uses `ACTIVE`. `COMPLETED` and `ARCHIVED` are deferred but enum should exist.

Deferred fields (add to schema in v1, but no logic uses them yet — see `10-deferred.md`):

- `holdStatus` — nullable enum: `null`, `ON_HOLD`, `INCOMPLETE`. Always `null` in v1.

### `ChainLink`

A single position in a chain. Represents either a claimed transaction or an unclaimed stub.

Required fields:

- `id` — primary key
- `chainId` — FK to `PropertyChain`
- `position` — integer, 0-indexed from top of chain. Top of chain is position 0. Allows reordering and gap insertion.
- `createdAt`, `updatedAt` — timestamps
- `createdByUserId` — the user who created this specific link (the originator of *this* node, not necessarily the chain originator)

**Claim state:**

- `transactionId` — nullable FK to `PropertyTransaction`. NULL means unclaimed stub. Non-null means claimed and linked to a real transaction.
- `claimedByUserId` — nullable FK to `User`. NULL when unclaimed. Set when a user claims this link.
- `claimedAt` — nullable timestamp. NULL when unclaimed.

**Stub data (used while unclaimed; archived but preserved after claim):**

- `stubPropertyAddress` — string, required at creation. Title-cased on save.
- `stubAgencyName` — string, required at creation. Title-cased on save.
- `stubAgentEmail` — nullable string. Lowercased on save.
- `stubAgentName` — nullable string.
- `stubAgentPhone` — nullable string.
- `stubNotes` — nullable text. Only visible to the link's originator.

**Invite tracking:**

- `inviteStatus` — enum: `NOT_SENT`, `SENT`, `BOUNCED`, `CLAIMED`, `DECLINED`. Default `NOT_SENT`.
- `inviteToken` — nullable string, unique. Generated when invite is sent. Used in claim URL.
- `inviteSentAt` — nullable timestamp.
- `inviteBouncedAt` — nullable timestamp.
- `inviteDeclinedAt` — nullable timestamp.
- `inviteResendCount` — integer, default 0.
- `lastInviteSentByUserId` — nullable FK to `User`. Tracks who last triggered the invite (originator may transfer or another claimed agent may add upward).

**Deferred fields (add to schema in v1, no logic uses them yet):**

- `withdrawalStatus` — nullable enum: `null`, `WITHDRAWN`, `REMARKETING`, `WAITING`. Always `null` in v1.
- `withdrawalRespondedAt` — nullable timestamp.

### `PropertyTransaction` (existing model — add fields)

Add the inverse relation:

- `chainLinkId` — nullable FK to `ChainLink`, unique. NULL if transaction is not in any chain. Set when a transaction is claimed into a chain (or when chain is created from this transaction).

This is the single source of truth for "is this transaction in a chain?" — query `transaction.chainLink` to find out.

### `User` (existing model — add relations)

Add inverse relations as needed:

- `createdChainLinks` — links where user is `createdByUserId`
- `claimedChainLinks` — links where user is `claimedByUserId`

## State logic

### Link state derivation

A `ChainLink`'s state is derived from its fields, not stored as a separate enum. Use these rules consistently across the codebase:

- **Unclaimed, no email**: `transactionId` is null, `stubAgentEmail` is null. Status badge: "Unclaimed". Cannot be invited until email added.
- **Unclaimed, invite not yet sent**: `transactionId` is null, `stubAgentEmail` is set, `inviteStatus` is `NOT_SENT`. Status badge: "Unclaimed". Originator can send invite.
- **Invited, awaiting claim**: `transactionId` is null, `inviteStatus` is `SENT`. Status badge: "Invited".
- **Invite bounced**: `inviteStatus` is `BOUNCED`. Status badge: "Invited" with bounce indicator. Originator must update email and resend.
- **Invite declined**: `inviteStatus` is `DECLINED`. Status badge: "Declined". Originator can resend or replace contact.
- **Claimed (other agent)**: `transactionId` is non-null, `claimedByUserId` ≠ current viewing user. Status badge: "Claimed".
- **Claimed (your file)**: `transactionId` is non-null, `claimedByUserId` === current viewing user. Status badge: "Your file".

Implement these as a helper, e.g. `getChainLinkStatus(link, currentUserId)` returning a discriminated union, used everywhere status is rendered.

### Position model

Positions are integers, 0-indexed, top of chain = 0. When a new node is added above the topmost existing node, all existing positions shift +1. When a new node is added below the bottommost, it gets `maxPosition + 1`. When a node is added between two existing nodes (rare in v1 since we only allow add-above and add-below from claimed nodes), positions of nodes below the insertion point shift +1.

A unique constraint on `(chainId, position)` is required. Position shifts must happen in a single transaction to avoid constraint violations.

### Who can extend the chain

- The chain originator (whoever created the chain) can add nodes above and below their own node, **only while those adjacent nodes are unclaimed**.
- Any claimed agent can add nodes above their own claimed node (their onward purchase).
- A claimed agent **cannot** add nodes below their own node — that direction is "settled" from their perspective. If they need to (e.g. their buyer's chain extends), that requires a chain decouple/restructure (deferred to v1.1).
- Once a node above the originator is claimed, the originator can no longer add further upward — the newly-claimed agent owns that direction.

This rule keeps a single clear "edge" of unclaimed territory at each end of the chain, and prevents racing edits.

## Indexes

- `ChainLink.chainId` — index
- `ChainLink.transactionId` — unique index (a transaction can only be in one link)
- `ChainLink.inviteToken` — unique index (lookup by claim URL)
- `ChainLink.claimedByUserId` — index (find all chains a user is in)
- `ChainLink.stubAgentEmail` — index (for duplicate detection lookup)
- `(ChainLink.chainId, ChainLink.position)` — unique composite index

## Cascade and deletion behaviour

- Deleting a `PropertyChain` cascade-deletes all `ChainLink` rows. (This should rarely happen — chains aren't deleted in v1, only archived. But the cascade is safe.)
- Deleting a `PropertyTransaction` should **not** cascade to `ChainLink`. Instead, when a transaction is deleted, set `chainLink.transactionId = null`, `claimedByUserId = null`, `claimedAt = null`, and revert the link to an unclaimed stub state. The originator can then re-invite or remove the stub. (Deletion of transactions is rare and usually requires admin action — confirm with existing transaction-deletion logic before implementing.)
- Deleting a `User` — handle via existing user-deletion logic. ChainLinks they originated should have `createdByUserId` set to null (or to a "deleted user" sentinel) and remain in place. Claimed links require existing user-deletion handling to determine.

## Migration

Write a single Prisma migration that adds all required fields and indexes. Do not modify existing field types or names — extend only. If existing fields conflict (e.g. an existing field has a different name for the same concept), use the existing name and document the mapping in this file.

Do not write a data migration in v1 — there are no existing chains in production with the new semantics. If there's existing test/seed data using the current `PropertyChain` model, confirm with the user before touching it.
