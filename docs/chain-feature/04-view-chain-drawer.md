# Chain Feature — View Chain Drawer

## Replaces

The existing chain widget (`components/chain/ChainWidget.tsx` and `components/chain/ChainMap.tsx`) when the user clicks "View Chain" from a transaction page. The new drawer is the canonical chain UI in v1.

Inspect existing widget code first to understand:
- How the View Chain button is currently triggered
- Current drawer/modal mechanism in the codebase (if any) — match it for consistency
- Whether any chain state is currently fetched/cached client-side that we need to refactor

## When it opens

- Click "View Chain" button on the transaction detail page (existing button location, replace target).
- Click "View Chain" from the chain section on the new transaction page if the user wants to preview after adding nodes (optional — could defer this entry point if it complicates form state).

## Layout

Right-side drawer, slides in from right edge of viewport. Width: ~480px on desktop, full-width on mobile. Uses `glass-card` for the drawer surface against a backdrop overlay.

```
┌───────────────────────────────────────────────────────┐
│  Chain progress                                  [×]  │
│  Real-time visibility across every link in the chain  │
├───────────────────────────────────────────────────────┤
│                                                       │
│  [Compact chain card — top of chain]                  │
│  ↓                                                    │
│  [Compact chain card]                                 │
│  ↓                                                    │
│  [Expanded chain card — YOUR FILE, default expanded]  │
│  ↓                                                    │
│  [Compact chain card]                                 │
│  ↓                                                    │
│  [Compact chain card — bottom of chain]               │
│                                                       │
│  [+ Add sale above]   ← only shown if user can       │
│  [+ Add sale below]   ← only shown if user can       │
│                                                       │
└───────────────────────────────────────────────────────┘
```

## Card states (compact mode by default for non-own cards)

### Compact card — claimed (someone else's)

```
┌─────────────────────────────────────────────────┐
│ 🏠  47 Oak Road                                 │
│     Bristol Estates                             │
│     [Claimed]  Position 3 of 5                  │
│     ▓▓▓▓▓▓▓▓░░░░░░░░░░  62%                     │
└─────────────────────────────────────────────────┘
```

### Compact card — your file (claimed by current user)

```
┌─────────────────────────────────────────────────┐
│ 🏠  51 The Meadway                              │
│     Akeman Residential                          │
│     [Your file]  Position 4 of 5                │
│     ▓▓▓▓▓░░░░░░░░░░░░░  35%       [Open file →]│
└─────────────────────────────────────────────────┘
```

The "Your file" card is visually distinct (coral accent border or background tint) and is **expanded by default** when the drawer opens. "Open file →" navigates to the transaction detail page (where the user already is, but useful from the chain-on-create-page entry point).

### Compact card — invited (stub, awaiting claim)

```
┌─────────────────────────────────────────────────┐
│ 🏠  104 Windmill Lane                           │
│     Smith & Co                                  │
│     [Invited]  Awaiting agent  ·  Sent 3d ago   │
│                                                 │
│     [Resend invite]   [⋯]   ← only if originator│
└─────────────────────────────────────────────────┘
```

No progress bar (no transaction exists yet). Status line shows time since invite sent. Resend and menu actions visible only to the link's originator.

### Compact card — invite bounced

```
┌─────────────────────────────────────────────────┐
│ 🏠  104 Windmill Lane                           │
│     Smith & Co                                  │
│     [Invited ⚠]  Email bounced                  │
│                                                 │
│     [Update email & resend]   [⋯]               │
└─────────────────────────────────────────────────┘
```

Amber/warning visual treatment on the badge. CTA is direct: update email and resend in one action.

### Compact card — unclaimed (no email yet)

```
┌─────────────────────────────────────────────────┐
│ 🏠  104 Windmill Lane                           │
│     Smith & Co                                  │
│     [Unclaimed]  Email needed                   │
│                                                 │
│     [Add email & invite]   [⋯]                  │
└─────────────────────────────────────────────────┘
```

### Compact card — invite declined

```
┌─────────────────────────────────────────────────┐
│ 🏠  104 Windmill Lane                           │
│     Smith & Co                                  │
│     [Declined]  Agent declined  ·  2d ago       │
│                                                 │
│     [Resend]  [Replace contact]   [⋯]           │
└─────────────────────────────────────────────────┘
```

### Compact card — removed (originator deleted their own transaction)

```
┌─────────────────────────────────────────────────┐
│ 🏠  47 Oak Road                                 │
│     [Removed]                                   │
└─────────────────────────────────────────────────┘
```

Edge case, see `02-permissions.md`. No actions available.

## Status badge styling

Use `StatusBadge` primitive from `components/ui/`. Colour mapping:

- **Your file** — coral / primary accent (#FF6B4A or equivalent)
- **Claimed** — blue / positive
- **Invited** — amber / pending
- **Invited ⚠ (bounced)** — amber with warning icon
- **Unclaimed** — grey / neutral
- **Declined** — red / negative
- **Removed** — grey / muted

## "⋯" menu contents (originator-only on unclaimed nodes)

- View invite details (modal showing original entry: email, agent name, phone, notes — originator's reference data)
- Edit (opens add-node drawer in edit mode, see `05-add-node-drawer.md`)
- Resend invite (only if invite has been sent before)
- Cancel invite / Remove from chain (with confirmation modal)

## Chain ordering and connector visuals

Cards are stacked top-to-bottom by position. Between each card, a small connector visual (a vertical line with a downward chevron, or similar — match existing chain connector style if `ChainMap.tsx` uses one) suggests the chain order.

The originator's own card always renders in expanded mode by default. All other cards render in compact mode. Tapping a compact card... does nothing in v1 (it's view-only). Don't over-engineer expansion behaviour for cards the user can't act on.

## Empty state — chain not yet created

When the View Chain drawer opens on a transaction with no chain attached:

```
┌───────────────────────────────────────────────────────┐
│  Chain progress                                  [×]  │
├───────────────────────────────────────────────────────┤
│                                                       │
│           No chain linked to this sale                │
│                                                       │
│  Create a chain to track your sale's position and     │
│  invite other agents to share progress visibility.    │
│                                                       │
│           [+ Create chain]                            │
│                                                       │
└───────────────────────────────────────────────────────┘
```

Use `EmptyState` primitive from `components/ui/`. Clicking "+ Create chain" transitions the drawer into chain-creation mode — same UI as a populated chain but with only the user's own "Your file" card visible and "+ Add sale above" / "+ Add sale below" buttons.

## Chain creation from drawer

Same flow as on the new transaction page (see `03-add-sale-integration.md`) but launched from an existing transaction context. The user's own transaction is automatically the originator's node — no "position selector" needed because the chain is being built around an existing sale.

When the first node is added (above or below), the `PropertyChain` row is created and the user's transaction's `chainLinkId` is set. Subsequent nodes are added to the existing chain.

## Send invites flow from drawer

When nodes have been added without invites being sent, a sticky footer in the drawer shows:

```
┌───────────────────────────────────────────────────────┐
│   2 nodes ready to invite        [Send invites]       │
└───────────────────────────────────────────────────────┘
```

Only counts nodes with valid emails. Clicking sends invites for all such nodes. After sending, footer updates: `"All invites sent"` for a few seconds, then disappears.

If individual nodes need invite-related action (e.g. one bounced), the per-card actions handle those without bulk operations.

## Performance / data fetching

The drawer needs:
- The chain (one row)
- All chain links in the chain (1–10 rows typically, never more than ~20)
- For each claimed link, the linked transaction's overall progress percentage
- For each link, the claimer's user record (for agency name display)

Single query with appropriate Prisma `include` clauses. Don't N+1 by fetching transactions individually per link.

Cache strategy: fetch on drawer open, no live updates in v1. If the user closes and reopens, refetch. Stale-while-revalidate is fine. Live progress updates across chain members are a v1.1+ feature (would require subscriptions or polling — out of scope).

## Accessibility

- Drawer must trap focus when open (existing drawer mechanism in codebase should handle this — verify)
- Esc key closes the drawer
- Status badges include screen-reader text (e.g. `<span class="sr-only">Status: Claimed by other agent</span>`)
- Progress bars include accessible label (`aria-label="62% complete"`)

## Mobile considerations

On viewports below ~640px, drawer takes full width. Compact card layout remains readable at narrow widths (tested down to 360px). The expanded "Your file" card may need to stack its right-side actions ("Open file →") below the progress bar at narrow widths.
