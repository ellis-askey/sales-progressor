# Chain Feature — Overview

## What we're building

A chain visibility and collaboration layer for property transactions. An agent who creates a sale can stub out the other links in the property chain (above and below their sale) with the agent contact details for each link. Each stub gets an invite email. When the receiving agent clicks the invite, they create an account (or log in) and "claim" their position — at which point the stub becomes a real, live `PropertyTransaction` in their own dashboard.

Once claimed, the originating agent loses edit rights over that node. All chain members can see every node's address, agent, agency, and overall progress percentage — but no internal file detail.

## Why

Two goals, equally important:

1. **Visibility for agents** — give every agent in a chain real-time visibility into where the rest of the chain actually is, without exposing private file detail. Today agents chase each other by phone for status updates; this replaces that with a live shared view.

2. **Viral acquisition loop** — agents who get invited see the product working on a real sale that affects them. They claim, see how good the system is, and become users themselves. This is the primary acquisition channel for the v1 launch.

## Existing foundation (what's already in the codebase)

- `prisma/schema.prisma` — `PropertyChain` and `ChainLink` models already exist (lines 647–671), linked to `PropertyTransaction` (line 179)
- `components/chain/ChainWidget.tsx` — a widget on the transaction page right sidebar
- `components/chain/ChainMap.tsx` — chain visualisation component

What's missing: invite/claim flow, originator-driven node creation, permission system around claimed vs unclaimed nodes, the new view-chain drawer UI, integration into the new transaction creation page, and the duplicate-detection logic for existing users being invited.

The existing `PropertyChain` / `ChainLink` schema may need extension (see `01-data-model.md`) but the core relationship structure is reusable.

## v1 scope (this build)

- Create chain from new transaction page (optional, inline expand)
- Create chain from existing transaction (via View Chain drawer)
- Add nodes above and below
- Edit/delete unclaimed nodes
- Send invites (immediate or deferred)
- Resend invites, handle bounces
- Claim flow for new users (signup pre-filled from invite token)
- Claim flow for existing users (link to existing dashboard)
- Duplicate detection on claim (existing transaction matching invited address)
- View Chain drawer — replaces the existing 2.0-style widget
- Permission system: originator owns unclaimed nodes, claimed agent owns claimed nodes
- Status badges: Your file / Claimed / Invited / Unclaimed

## Deferred to v1.1+ (not built now, but data model must support)

- Withdraw cascade (when a chain member withdraws, propagate response prompts up/down)
- Decouple (split a chain into two independent chains)
- On-hold / incomplete chain states
- Notifications (email/in-app for chain events)
- Notification preferences per chain member
- Chain-level reporting/analytics

See `10-deferred.md` for what data model hooks must exist in v1 to make these tractable later.

## Core principles

1. **Additive, not modifying.** Every existing code path must behave identically when no chain exists. A transaction with no `PropertyChain` linked must work exactly as it does today. The chain layer sits *above* the transaction as a relationship, not inside the transaction's logic.

2. **Originator owns unclaimed, claimer owns claimed.** Once a node is claimed, the original creator loses all edit/delete rights on that node. The claim transfer is permanent (no "unclaim").

3. **Visibility ≠ access.** Chain members can see address, agent, agency, and % progress on every node. They cannot see vendor/purchaser names, solicitor details, internal notes, milestone-level detail, or any other transaction internals.

4. **Email is optional at stub creation.** A node can be created without an agent email (originator might not have it yet). Invite gets sent later when email is added. Chain shape becomes visible knowledge before invites go out.

5. **Two entry points, one chain object.** Chain creation is available from the new transaction page (inline) and from any existing transaction (via View Chain drawer). Both create/modify the same `PropertyChain` record.

## What this feature does NOT touch

The following systems are explicitly out of scope and must not be modified:

- Milestone engine (PM/VM/B series logic)
- Email templates for milestone events
- File progression logic
- Solicitor flows
- Smart rules
- Reminders
- ID/AML checks
- Contract pack handling
- Existing `/agent/transactions/[id]` page logic (only the View Chain entry point is replaced)
- Existing signup flow at `/signup` (claim flow is a separate route that calls shared account-creation functions)

See `09-stability-guarantees.md` for the full additive-vs-modifying surface area and required regression checks.

## Document map

- `01-data-model.md` — Prisma schema changes, entity relationships, state enums
- `02-permissions.md` — who can do what in which state (matrix)
- `03-add-sale-integration.md` — chain section on the new transaction page
- `04-view-chain-drawer.md` — the chain panel UI (replaces existing widget)
- `05-add-node-drawer.md` — adding nodes above/below
- `06-invite-flow.md` — email content, send logic, bounce handling
- `07-claim-flow.md` — new user claim, existing user claim, duplicate detection
- `08-copy.md` — every string, button label, status badge, helper text
- `09-stability-guarantees.md` — what we touch, what we don't, regression checks
- `10-deferred.md` — withdraw cascade, decouple, on-hold, notifications
- `IMPLEMENTATION-PROMPT.md` — the prompt to give Claude Code
