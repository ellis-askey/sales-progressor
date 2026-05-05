# Chain Feature — Add Node Drawer

## Purpose

The form that lets an originator (or an existing chain participant) add a new stub link to a chain. Used in two contexts:

1. From the chain section on the new transaction page (`/agent/transactions/new`)
2. From the View Chain drawer on an existing transaction page

In both contexts, the form is identical. The difference is just where the resulting node ends up.

## Trigger

Clicking "+ Add sale above" or "+ Add sale below" anywhere in the chain UI opens this drawer.

The drawer's title and submit button reflect the direction:
- Above: "Add sale above" / submit "Save and add above"
- Below: "Add sale below" / submit "Save and add below"

## Layout

Right-side drawer (or modal on mobile, depending on existing patterns — match what the codebase uses elsewhere). Width ~440px desktop.

```
┌───────────────────────────────────────────────────┐
│  Add sale above                              [×]  │
│  Tell us what you know about this link            │
├───────────────────────────────────────────────────┤
│                                                   │
│  PROPERTY                                         │
│  Property address *                               │
│  [_____________________________________]          │
│                                                   │
│  AGENCY                                           │
│  Agency name *                                    │
│  [_____________________________________]          │
│                                                   │
│  AGENT CONTACT  (optional — needed to send invite)│
│  Agent name                                       │
│  [_____________________________________]          │
│                                                   │
│  Agent email                                      │
│  [_____________________________________]          │
│                                                   │
│  Contact number                                   │
│  [_____________________________________]          │
│                                                   │
│  NOTES  (only you see this)                       │
│  [_____________________________________]          │
│  [_____________________________________]          │
│                                                   │
├───────────────────────────────────────────────────┤
│  [Cancel]                  [Save and add above]   │
└───────────────────────────────────────────────────┘
```

## Field requirements

**Required:**
- Property address
- Agency name

**Optional but recommended:**
- Agent name
- Agent email (without it, no invite can be sent — but stub can still be created)
- Contact number

**Optional, originator-only:**
- Notes (free text, never visible to other chain members)

## Submit button states

- Both required fields empty → button disabled, helper text below: "Property address and agency name are required"
- Required fields filled, no email → button enabled, label "Save and add {direction}", small helper: "No invite will be sent — you can add an email later"
- Required fields filled, valid email → button enabled, label "Save and add {direction}", small helper: "Invite will be sent when you save the chain" (when in new-transaction page context) OR "Invite will be sent now" (when in existing-chain context where the chain already exists)

The "send invite now" vs "send when saving" distinction matters because in the new-transaction context, nothing is persisted until the user clicks Create transaction. In the existing-chain context, the chain already exists and adding a node is a mutation that can trigger the invite immediately.

## Edit mode

The same drawer is used for editing an existing unclaimed stub. Title becomes "Edit sale" and submit button "Save changes". All fields pre-fill from existing stub data. Originator-only — not available once link is claimed.

## Validation rules

- **Property address**: minimum 3 characters, max 200. Title-case on save.
- **Agency name**: minimum 2 characters, max 100. Title-case on save.
- **Agent name**: optional. If provided, max 100 chars. Title-case on save.
- **Agent email**: optional. If provided, must match standard email regex. Lowercase on save. Trim whitespace.
- **Contact number**: optional. If provided, accept any reasonable phone format (don't be strict — UK landlines, mobiles, international numbers all valid). Strip spaces and standardise format on display, but store as entered.
- **Notes**: optional. Max 1000 chars. Free text.

Invalid email shows inline error: "Enter a valid email address" — but does not block submission if the field is left empty after invalid entry (the user can clear it and proceed without an email).

## Server-side action

`POST /api/chains/{chainId}/links` (or via server action — match existing patterns in the codebase):

Body:
```ts
{
  position: "above" | "below" | number, // "above"/"below" relative to inviting user's link, or explicit position
  stubPropertyAddress: string,
  stubAgencyName: string,
  stubAgentName?: string,
  stubAgentEmail?: string,
  stubAgentPhone?: string,
  stubNotes?: string,
  sendInviteNow?: boolean, // default false in new-transaction context, true in existing-chain context
}
```

Server logic:
1. Verify caller has permission to add in the requested direction (see `02-permissions.md`).
2. Compute new position (shift other positions if inserting above topmost node).
3. Title-case address/agency/name fields. Lowercase email.
4. Create `ChainLink` row with `inviteStatus = NOT_SENT`.
5. If `sendInviteNow` is true and email is present: generate invite token, send invite (see `06-invite-flow.md`), update `inviteStatus = SENT`, `inviteSentAt = now()`.
6. Return the created link.

Validation errors return 422 with field-level error messages. Permission errors return 403.

## In the new-transaction page context (no chain yet exists)

When the drawer is used from the new transaction page, no `PropertyChain` exists yet. The form does not call the API on submit — instead, the node data is held in client-side form state alongside the rest of the new transaction form. On Create transaction submission, the chain and all stubs are persisted in a single server action.

This means in this context:
- "Save and add {direction}" closes the drawer and adds the node to the in-memory chain section preview (see `03-add-sale-integration.md`)
- No API call yet
- The "Send invites" decision is captured by the checkbox next to Create transaction, not in this drawer

The drawer's helper text adjusts accordingly: "Invite will be sent when you save the chain" rather than "now".

## Edge cases

- **Duplicate property address within the same chain.** If the originator tries to add a node with an address that already exists in the chain (theirs or another stub), warn but don't block: "This address is already in the chain. Continue anyway?" — they might be deliberately adding a duplicate (rare but possible — flats in same building).
- **Email already used by another stub in the same chain.** Warn similarly: "This email is already invited for another sale in this chain." Common scenario: same agency handling two sales in the chain. Allow but warn.
- **Email matches the originator's own email.** Block with error: "You can't invite yourself."
- **Email matches an existing claimed agent's email in this chain.** Block with error: "This agent has already claimed a position in this chain."
