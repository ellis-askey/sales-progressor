# Chain Feature — Deferred to v1.1+

These are out of scope for v1 but the data model must support them. This document lists what's deferred and what hooks the v1 schema includes to make later implementation tractable.

## Withdraw cascade

**The feature:** When a chain member withdraws (e.g. their buyer pulls out, they take the property off the market), neighbouring chain members are prompted to choose how they want to respond. Three options:

- **Remarketing** — they're going to find a new buyer/seller for their position
- **Waiting** — they want to wait and see if the chain recovers
- **Also withdrawing** — they're pulling out too

Each response can cascade further up or down the chain (e.g. if the agent above me withdraws, my response of "also withdrawing" then prompts the agent below me).

**Why deferred:** This is genuinely the most complex part of the whole feature. Three response types propagating in two directions, with each agent's response potentially triggering further prompts, is a proper state machine. It needs its own design phase with state transition diagrams and careful handling of edge cases (what if two members withdraw simultaneously? what if a member doesn't respond for weeks?).

**v1 schema hooks:**

- `ChainLink.withdrawalStatus` — enum field exists (`null`, `WITHDRAWN`, `REMARKETING`, `WAITING`). Always `null` in v1.
- `ChainLink.withdrawalRespondedAt` — nullable timestamp. Always `null` in v1.

These exist in v1 so v1.1 doesn't need a schema migration to add them. v1 ignores them (no code reads or writes them).

**Estimated v1.1 work:** A separate spec doc with state transitions, plus UI for: withdraw button on own link, response prompt UI for neighbours, status display on chain cards, notification triggers. Roughly half the size of v1 in implementation.

## Decouple

**The feature:** Split a chain into two independent chains at a chosen link boundary. Used when:

- A buyer's onward chain extends and that's now genuinely a separate transaction concern
- A withdrawal causes the chain to split and the surviving sub-chains continue independently
- An agent realises they were added to the wrong chain and needs to extract their portion

**Why deferred:** Decouple semantics depend partly on withdraw cascade (some decouples happen as a result of withdrawals). Building decouple before withdraw means the trigger conditions are unclear.

**v1 schema hooks:** None needed. Decouple is a runtime operation that creates a new `PropertyChain` row and reassigns `ChainLink.chainId` on the affected links. v1 schema supports this without modification.

**v1 enforcement:** The "add below" restriction in v1 (only chain originator can add below, and only while no node below is claimed) is partly there to avoid the situations where decouple would be needed. v1 deliberately doesn't allow chain shapes that require decouple.

## On-hold and incomplete chain states

**The feature:** Mark a chain as on-hold (e.g. all parties paused for a probate, a long survey defect resolution, a known delay). Visible to all chain members so they understand why progress has stalled.

Or mark as incomplete (e.g. a stub never got claimed and the originator gives up trying to reach the agent — chain operates with that gap acknowledged).

**Why deferred:** Useful but not essential for the v1 viral loop. The basic chain visibility works without these states.

**v1 schema hooks:**

- `PropertyChain.holdStatus` — nullable enum (`null`, `ON_HOLD`, `INCOMPLETE`). Always `null` in v1.

## Notifications

**The feature:** Email and in-app notifications for chain events:

- Invite sent / claimed / declined / bounced (originator)
- Chain member claims their position (everyone in chain)
- Milestone reached on another chain member's transaction (configurable per user)
- Withdraw event triggered (everyone in chain)
- Chain completion (everyone in chain)

**Why deferred:** Notification volume needs careful design — emails per milestone across a 5-link chain would be unbearable. Needs preferences, digest options, and integration with the existing notification system (which itself may need work). Better to ship v1 silent-but-visible (users actively check chain via View Chain drawer) and add notifications informed by real usage patterns.

**v1 behaviour:** The only user-facing notifications in v1 are:

- In-app toasts for actions the user just took (chain saved, invites sent, etc.)
- Bounce notification email to originator (one-time, on first bounce — covers the case where they're not in the app)

Everything else is silent. Users see updates by opening the View Chain drawer.

**v1 schema hooks:** None needed for notifications themselves. v1.1 will likely add a `ChainNotificationPreference` table but its shape depends on how the existing notification system works — defer schema design to that point.

## Live progress updates

**The feature:** When another chain member's transaction progresses (e.g. their searches come back), the View Chain drawer updates in real time without refresh.

**Why deferred:** Requires either WebSockets/Server-Sent Events or aggressive polling. Both add infrastructure complexity. v1 fetches on drawer open and accepts staleness within a session.

**v1 schema hooks:** None needed.

## Chain-level analytics

**The feature:** Reporting on chains an agent has been part of — average chain length, average time to exchange, drop-out rates, common failure points. Useful for individual agents reviewing their pipeline and for product to measure chain health.

**Why deferred:** Needs significant chain volume to be meaningful. v1 just needs to collect the data; analytics layer comes after.

**v1 schema hooks:** Timestamps already exist on `PropertyChain` and `ChainLink` (`createdAt`, `claimedAt`, etc.), enabling future reporting without schema changes.

## Multi-property / forked chains

**The feature:** Chain shapes that aren't strictly linear — a buyer purchasing two properties simultaneously, a seller whose buyer is a relocation company taking multiple linked sales, etc.

**Why deferred:** Real but rare. Linear chains cover ~95% of real-world cases. Forked chains need different visualisation, different position semantics, and different decouple logic.

**v1 schema hooks:** Position is currently a single integer per link. Forked chains would require either (a) multiple positions per link, (b) a tree structure, or (c) child chains. None of these are supported in v1, but v1's strict enforcement of linear chains (sequential integer positions, unique per chain) doesn't preclude future schema extension.

**v1 behaviour:** Linear chains only. If a user has a non-linear situation, they create separate transactions (and possibly separate chains) and don't try to model the fork in v1.

## Originator transfer

**The feature:** Allow the chain originator to transfer originator status to another chain member (e.g. they're handing the file off to a colleague, or they're stepping out and want the next-most-active agent to take over chain coordination).

**Why deferred:** Edge case. v1 keeps originator as immutable for simplicity.

**v1 schema hooks:** `PropertyChain.createdByUserId` exists but is read as the originator. v1.1 could add a separate `currentOriginatorUserId` field for transfers, with `createdByUserId` retained as the historical record.

## Summary table

| Feature | v1 Status | Schema hook in v1 |
|---|---|---|
| Withdraw cascade | Deferred | `ChainLink.withdrawalStatus`, `withdrawalRespondedAt` |
| Decouple | Deferred | None (runtime operation only) |
| On-hold / incomplete | Deferred | `PropertyChain.holdStatus` |
| Notifications | Deferred (except bounce email) | None |
| Live progress updates | Deferred | None |
| Analytics | Deferred | Existing timestamps sufficient |
| Forked chains | Deferred | None (linear only in v1) |
| Originator transfer | Deferred | None (immutable in v1) |

## Order of likely implementation post-v1

Based on user value and complexity:

1. Notifications (medium complexity, high value once chains have density)
2. Withdraw cascade (high complexity, high value — fundamental to handling broken chains)
3. On-hold / incomplete states (low complexity, medium value)
4. Live progress updates (medium complexity, medium value)
5. Analytics (low-medium complexity, medium value once data exists)
6. Decouple (medium complexity, lower value — only matters if chains commonly need restructuring)
7. Forked chains (high complexity, low value — rare)
8. Originator transfer (low complexity, low value — rare edge case)

This order is a suggestion; real prioritisation should be informed by v1 usage data.
