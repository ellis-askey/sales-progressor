# Chain Feature — Permissions

## Roles

For chain operations, users have one of these roles relative to a specific `ChainLink`:

- **Link originator** — `link.createdByUserId === user.id`. The user who created this stub.
- **Link claimer** — `link.claimedByUserId === user.id`. The user who claimed this link (and now owns the underlying transaction).
- **Chain participant** — has at least one claimed link in the chain (i.e. is the claimer of any link in the chain).
- **Chain originator** — `chain.createdByUserId === user.id`. The user who first created the chain. Mostly informational in v1; operational permissions are per-link.
- **Outsider** — none of the above. No access.

A user can hold multiple roles simultaneously (e.g. claimer of one link, originator of an unclaimed link they added above their own claim).

## Permission matrix

| Action | Outsider | Link originator (unclaimed) | Link originator (claimed) | Link claimer | Other chain participant |
|---|---|---|---|---|---|
| View chain (address, agent, % of all nodes) | ❌ | ✅ | ✅ | ✅ | ✅ |
| View link's stub notes | ❌ | ✅ | ❌ | ❌ | ❌ |
| View link's stub agent email/phone | ❌ | ✅ | ❌ | ❌ | ❌ |
| Edit link's stub data (address, agency, email, etc.) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Send/resend invite | ❌ | ✅ | ❌ | ❌ | ❌ |
| Delete (cancel) link | ❌ | ✅ | ❌ | ❌ | ❌ |
| Add node above this link | ❌ | ✅ (if they originated and link is at top of chain) | ❌ | ✅ (if this is their own claimed link) | ❌ |
| Add node below this link | ❌ | ✅ (if they originated and link is at bottom of chain) | ❌ | ❌ (deferred — requires decouple) | ❌ |
| Edit underlying transaction | n/a | n/a | n/a | ✅ | ❌ |
| Withdraw / mark broken (deferred v1.1) | ❌ | ❌ | ❌ | ✅ | ❌ |

## Key rules in plain English

**Originator → claimer transfer.** When a link is claimed, the originator's edit/delete/invite rights on that link transfer to the claimer. Originator retains view-only access (the same view as any other chain participant). The link's stub data (notes, original agent contact) becomes archived — readable in audit context only, not in operational UI.

**Add-above privilege transfer.** If the chain originator added a link above their own and that link gets claimed, the *claimer* now owns the right to extend further upward. The original chain originator can no longer add above. The same applies recursively as the chain grows.

**Add-below restriction.** Only the chain originator (the bottom of the originator-created chain) can add below. Once a link below is claimed, neither the originator nor the claimer can add further below — that's a decouple operation deferred to v1.1. Reasoning: the buyer's onward chain is the buyer's business; the seller doesn't extend it for them. v1 keeps this clean by disallowing the action; v1.1 introduces decouple as a separate flow.

**Notes are private to originator.** The `stubNotes` field is for the originator's own reference (e.g. "called the agent yesterday, will follow up Tuesday"). Other chain members never see notes on any link, ever. Once the link is claimed, the notes are archived and not shown to anyone in operational UI (admin/support could surface them via DB if ever needed).

**Email/phone are private to originator.** The stub agent email and phone are visible only to the originator while unclaimed. Other chain participants see only "Invited" / "Unclaimed" status, not the contact details. Once claimed, the claimed agent's identity comes from the User record, not the stub.

## Server-side enforcement

Every mutation (create link, edit link, send invite, delete link, claim link) must check permissions server-side. Do not rely on the UI hiding buttons. Implement a centralized helper:

```ts
// lib/chain/permissions.ts
export function canEditLink(link: ChainLink, userId: string): boolean
export function canSendInvite(link: ChainLink, userId: string): boolean
export function canAddAbove(link: ChainLink, userId: string): boolean
export function canAddBelow(link: ChainLink, userId: string): boolean
export function canViewChain(chain: PropertyChain, userId: string): boolean
export function canViewStubDetails(link: ChainLink, userId: string): boolean
```

Server actions and API routes call these before any mutation. Return 403 with a clear error message if denied.

## Client-side rendering

UI hides actions the user cannot perform. Status badges and other visible info still render — visibility (the ability to *see* the chain layout) is universal among chain participants. The matrix above governs *actions*, not visibility of the chain structure itself.

When a user views a chain they're a participant in, every link card shows: address, agency name (if claimed agent's agency or stub agency name), claim status badge, and overall progress %. No stub email/phone/notes appear unless the viewer is the link's originator and the link is unclaimed.

## Edge case: originator is also a claimer of the same link

Not possible by design — when a stub is created, no transaction exists; when claimed, a different user is signing up or logging in. The originator cannot claim their own stub. Enforce this server-side: if `claimedByUserId === createdByUserId` at claim time, reject with an error.

## Edge case: chain with zero claimed links

Only the originator's own node is "claimed" (it's their own transaction, linked at chain creation). Every other node starts unclaimed. So a freshly created chain always has exactly one claimed link (the originator's) and one or more unclaimed stubs. The originator owns all stubs.

## Edge case: originator's transaction is deleted

If the originator deletes their underlying `PropertyTransaction`, the chain still exists but their link becomes orphaned. v1 behaviour: the chain remains visible to other claimed participants; the originator's link displays as "Removed" in the chain view. Stub-management permissions for any unclaimed links the originator created transfer to... no one. Those stubs become read-only. (This is an edge case; document it but don't over-engineer the UI for it.)
