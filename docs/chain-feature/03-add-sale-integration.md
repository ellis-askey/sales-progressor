# Chain Feature — Add-Sale Page Integration

## Page being modified

`/agent/transactions/new` — the New Transaction page (single-page form, see screenshot in design notes for current layout).

## Goal

Add an optional "Chain" section to this page so an originator can create a chain at the same time as creating their transaction. Must not disrupt the existing flow for users who don't use chains.

## Placement

Insert a new section in the **left column**, between the **Notes** section and the **Who will progress this file?** section. This keeps the right column purely about people (vendors, purchasers, solicitors) and groups the chain decision with other sale-level metadata.

## Collapsed state (default)

The section appears as a single-line entry matching the visual weight of other section headers on the page (PROPERTY ADDRESS, TENURE, etc.):

```
CHAIN  (optional)
Is this property part of a chain?  [+ Add chain]
```

- Section header label uses the same uppercase styling as `PROPERTY ADDRESS`, `TENURE`, etc.
- "(optional)" appears in muted grey next to the label
- Helper line "Is this property part of a chain?" sits below the header
- "+ Add chain" is a button (use existing button primitives matching the secondary/outline style elsewhere on this page)

When collapsed, takes minimal vertical space (~60px). The section adds no required validation.

## Expanded state (after clicking "+ Add chain")

Section expands inline (smooth height transition). Contents:

```
CHAIN  (optional)                                          [× Remove chain]

Your sale's position in the chain
○ Top of chain (no sale below this one)
○ Bottom of chain (no sale above this one)
○ Middle of chain
○ I don't know yet

[Position-specific add buttons appear below based on selection — see below]
```

The "× Remove chain" link in the top-right of the section header collapses the section back to its default state and discards any in-progress chain data (with a confirmation toast if any nodes have been added).

### Position selector behaviour

- **Top of chain** — shows only "+ Add sale below" button. (No sale above this one.)
- **Bottom of chain** — shows only "+ Add sale above" button. (No sale below.)
- **Middle of chain** — shows both "+ Add sale above" and "+ Add sale below" buttons.
- **I don't know yet** — shows both add buttons. Same as Middle but doesn't commit the originator to a chain shape mentally.

The position selection is for UX only; it does not affect data model. Internally, the originator's link is positioned based on what they actually add (e.g. if they add 2 above and 1 below, their position is computed accordingly).

## Add-node interaction

Clicking "+ Add sale above" or "+ Add sale below" opens the **add-node drawer** (see `05-add-node-drawer.md`). The drawer slides in from the right. The agent fills in the node details, clicks "Save node", drawer closes, and the new node appears as a card stacked above or below the originator's own node within the expanded chain section.

### Node cards within the chain section

Each added node displays as a compact card showing:

```
┌─────────────────────────────────────────────────┐
│ 🏠  47 Oak Road                          [⋯]   │
│     Bristol Estates                              │
│     ben@bristolestates.com                       │
└─────────────────────────────────────────────────┘
```

- Property icon, address, agency name on top line
- Email below if entered, otherwise "Email needed to send invite" in muted text
- "⋯" menu with: Edit, Delete

The originator's own node (the sale they're creating on this page) is also represented as a card in the chain visualisation, styled with the "Your file" green accent so it's clear which one is theirs.

### Vertical layout within chain section

```
[Top — Above sales appear here, ordered top-to-bottom]
  ┌─ Node card (highest above) ─┐
  ┌─ Node card (next above) ────┐

  ┌─ YOUR SALE (this transaction being created) ─┐  ← always present, highlighted

  ┌─ Node card (next below) ────┐
  ┌─ Node card (lowest below) ──┐
[Bottom]

[+ Add sale above]    [+ Add sale below]
```

Add buttons sit below the stack and only appear if the position selector allows them (e.g. Top of chain hides the "Add sale above" button).

## Submit behaviour — coordinating with "Create transaction"

The Create transaction button at the bottom of the page does not change its label based on chain state. It always reads "Create transaction".

A new control appears next to the Create transaction button **only if the chain section has been expanded and at least one node has been added**:

```
[ ☑ Send chain invites now (2) ]   [Create transaction]
```

- Checkbox default ticked
- The number in parentheses reflects the count of nodes with valid email addresses (nodes without emails are saved as stubs but no invite is sent regardless of checkbox state)
- If no nodes have emails, the checkbox is hidden entirely and only the saved-without-invites state applies
- If checkbox unticked, all created stubs are saved without sending invites; originator can send them later from the View Chain drawer

## Helper text under the Create transaction button

Existing copy: `"Address, tenure and purchase type are required"`. Extend with a chain-aware addendum:

- No chain: existing copy unchanged
- Chain expanded but no nodes added: existing copy unchanged (chain is essentially empty, nothing to flag)
- Chain with nodes, invites ticked, count > 0: `"Address, tenure and purchase type are required. {N} chain invite{s} will be sent."`
- Chain with nodes, invites unticked OR all nodes lack emails: `"Address, tenure and purchase type are required. Chain will be saved without sending invites."`

## Submission flow on the server

When `POST /agent/transactions/new` is processed:

1. Existing transaction creation logic runs first, unchanged. Transaction is created.
2. If chain section was expanded and at least one node was added:
   a. Create `PropertyChain` row (`createdByUserId` = current user, `status` = `ACTIVE`).
   b. Create the originator's own `ChainLink` row (`transactionId` = newly-created transaction id, `claimedByUserId` = current user, `claimedAt` = now, position computed from layout).
   c. Create stub `ChainLink` rows for each added node, with `transactionId` = null, position assigned per layout, `inviteStatus` = `NOT_SENT`.
   d. Update the new transaction's `chainLinkId` to point to the originator's link.
   e. If invite checkbox is ticked, generate `inviteToken` for each stub with an email and trigger invite send (see `06-invite-flow.md`). Update `inviteStatus` to `SENT` and `inviteSentAt` for those.
3. Redirect to the transaction detail page as normal. (No "you've created a chain" intermediate page — the View Chain drawer is available from the transaction page if they want to see what they built.)

If transaction creation succeeds but chain creation fails, the transaction must persist (no chain rollback). Surface a toast: `"Transaction created, but we couldn't save the chain. Please try adding it from the transaction page."` This avoids losing the user's transaction work due to a chain-side bug.

## Form state management

The chain section's state (expanded/collapsed, position selection, added nodes, invite checkbox) lives in the same form state as the rest of the page. If the user is mid-fill and navigates away, the existing draft-saving mechanism (visible in screenshot — "1 saved draft" indicator) should preserve the chain state too. Confirm by inspecting the existing draft mechanism in the codebase before deciding implementation.

If existing drafts are stored as a JSON blob, add chain fields to that blob. If they're stored as partial DB records, the chain stub data needs equivalent draft handling — probably easiest to keep chain state in the same draft blob until submit.

## Edge cases

- **User adds nodes, then unchecks chain section / clicks Remove chain.** Confirm via toast/modal: "Discard chain and N added nodes?" with confirm/cancel.
- **User adds a node, then changes position selector** (e.g. added a node above, then switches to "Bottom of chain" which hides the add-above button). The added node remains in the data but the UI cannot show the add-above button. Resolution: changing position selector to a more restrictive option that contradicts existing nodes triggers a confirm: "You've added nodes that don't fit this position. Remove them?" with confirm/cancel.
- **Email validation on stub.** Invalid email format should warn but not block save (originator might be entering a placeholder). The "Send invites" count only includes nodes with *valid* email format. Bouncing is handled post-send (see `06-invite-flow.md`).
- **Address auto-formatting.** The stub address, agency name, and agent name should be Title Cased on save (e.g. "47 oak road" → "47 Oak Road"). Postcodes uppercased.

## Visual styling

Use the `glass-card` class for the chain section's expanded container, matching the cream + coral agent-app surface. Node cards inside should use `glass-subtle`. Position selector radios should match the radio styling used elsewhere in the agent app (inspect `Tenure` selector on the same page for reference).

The originator's own node card (within the chain section) uses the coral accent (`#FF6B4A`) on its left border and a "Your file" badge in the corner to distinguish it from stub cards.
