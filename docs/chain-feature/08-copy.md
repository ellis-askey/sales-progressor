# Chain Feature — Copy

All user-facing strings in one document. Use these verbatim. If a string isn't here, ask before inventing one.

## Section headers

- `CHAIN` (uppercase, in form section style)
- `Chain progress` (drawer title)
- `Real-time visibility across every link in the chain` (drawer subtitle)

## Buttons

### Add-sale page

- `+ Add chain` — collapsed state CTA
- `× Remove chain` — expanded state, top-right
- `+ Add sale above` — chain section, opens add-node drawer
- `+ Add sale below` — chain section, opens add-node drawer
- `Send chain invites now (N)` — checkbox label next to Create transaction (N = count of invitable nodes)

### Add-node drawer

- `Save and add above` / `Save and add below` — primary action when adding
- `Save changes` — primary action when editing existing stub
- `Cancel` — secondary action

### View chain drawer

- `+ Create chain` — empty state CTA
- `+ Add sale above` / `+ Add sale below` — at top/bottom of chain stack
- `Open file →` — on the user's own claimed card
- `Resend invite` — on invited cards (originator only)
- `Update email & resend` — on bounced cards (originator only)
- `Add email & invite` — on unclaimed cards without email (originator only)
- `Replace contact` — on declined cards (originator only)
- `Send invites` — sticky footer when nodes ready to invite

### Claim landing page

- `Claim this sale` — primary CTA (new user / unauth)
- `Log in` — secondary action (existing user)
- `Decline` / `This isn't mine` — tertiary action

### Claim signup

- `Create my account`

### Claim login

- `Log in and claim`

### Claim confirm (existing user)

- `Claim and create file` — when no duplicate exists
- `Link this file to the chain` — when duplicate exists (recommended option)
- `Create a separate new file` — when duplicate exists (alternative option)
- `Cancel`

## Status badges

(Use `StatusBadge` primitive — colours defined in `04-view-chain-drawer.md`)

- `Your file`
- `Claimed`
- `Invited`
- `Invited ⚠` (with bounce indicator)
- `Unclaimed`
- `Declined`
- `Removed`

## Position labels

- `Top of chain`
- `Bottom of chain`
- `Middle of chain`
- `Position N of M` — used on cards in view chain drawer

## Helper text

### Add-sale page (chain section, collapsed)

`Is this property part of a chain?`

### Add-sale page (chain section, expanded)

`Your sale's position in the chain`

Position selector options:

- `Top of chain (no sale below this one)`
- `Bottom of chain (no sale above this one)`
- `Middle of chain`
- `I don't know yet`

### Create transaction button helper text

- Default: `Address, tenure and purchase type are required`
- With chain + invites: `Address, tenure and purchase type are required. {N} chain invite{s} will be sent.`
- With chain + no invites: `Address, tenure and purchase type are required. Chain will be saved without sending invites.`

### Add-node drawer helper text

- Title: `Add sale {above|below}`
- Subtitle: `Tell us what you know about this link`
- Section: `PROPERTY`
- Field: `Property address *`
- Section: `AGENCY`
- Field: `Agency name *`
- Section: `AGENT CONTACT  (optional — needed to send invite)`
- Fields: `Agent name`, `Agent email`, `Contact number`
- Section: `NOTES  (only you see this)`
- Submit helper (no email): `No invite will be sent — you can add an email later`
- Submit helper (email, new-tx context): `Invite will be sent when you save the chain`
- Submit helper (email, existing-chain context): `Invite will be sent now`
- Disabled helper: `Property address and agency name are required`

### View chain drawer

- Empty state title: `No chain linked to this sale`
- Empty state body: `Create a chain to track your sale's position and invite other agents to share progress visibility.`

### Card status descriptors

- Invited: `Awaiting agent  ·  Sent {timeAgo}` (e.g. "Sent 3d ago")
- Bounced: `Email bounced`
- Unclaimed (no email): `Email needed`
- Declined: `Agent declined  ·  {timeAgo}`

### Sticky footer when invites pending

`{N} node{s} ready to invite`

### Toast after sending invites

`{N} invite{s} sent` (auto-dismisses after 3s)

### Toast after claim

`You've claimed your position in this chain. Open the chain panel to see other agents.`

### Toast after transaction created with chain

`Transaction created. {N} chain invite{s} sent.` (only if invites were sent)

`Transaction created. Chain saved.` (if chain saved without invites)

## Email — invite

### Subject

`{originatorAgencyName} has added you to a live chain — {originatorPropertyAddress}`

### Body (HTML)

See `06-invite-flow.md` for the full structured copy.

## Email — bounce notification to originator (one-time per bounce)

### Subject

`Your chain invite couldn't be delivered — {stubPropertyAddress}`

### Body

```
Hi {originatorFirstName},

Your invite to {stubAgentEmail} for {stubPropertyAddress} couldn't be
delivered — the email bounced.

Possible causes: the address is incorrect, the inbox is full, or the
recipient's mail server rejected it.

Update the email and try again from the chain panel:
[Open chain panel]

Or get in touch if you'd like a hand: support@thesalesprogressor.co.uk
```

## Server response pages (no auth)

### Already claimed

```
This chain link has already been claimed.

If you believe this is a mistake, contact support@thesalesprogressor.co.uk.
```

### Already declined

```
This invite was declined.

Contact the inviting agent if you'd like to be re-invited.
```

### Invalid / expired

```
This link is no longer valid.

It may have been cancelled, claimed already, or the link is malformed.

If you were expecting an invite, contact the agent who sent it, or get in
touch with support@thesalesprogressor.co.uk.
```

### Decline confirmation

```
Thanks — we've let the agent know.

This invite has been declined. {originatorName} at {originatorAgencyName}
will see this and can update the contact details if needed.

If you received this in error, email support@thesalesprogressor.co.uk
```

## Confirmation modals

### Discard chain on remove

Title: `Discard chain?`
Body: `You've added {N} node{s} to this chain. Removing will discard them.`
Actions: `Cancel` / `Discard chain`

### Cancel invite / remove from chain

Title: `Remove from chain?`
Body: `This will cancel the invite to {stubAgentEmail} and remove {stubPropertyAddress} from the chain.`
Actions: `Cancel` / `Remove from chain`

### Position selector contradicts existing nodes

Title: `Remove existing nodes?`
Body: `Switching to "{newPosition}" means the {direction} sales you've added no longer fit. Remove them?`
Actions: `Cancel` / `Remove nodes`

## Validation messages

- Email invalid: `Enter a valid email address`
- Address too short: `Enter a property address`
- Agency too short: `Enter the agency name`
- Notes too long: `Keep notes under 1000 characters`
- Self-invite: `You can't invite yourself`
- Duplicate email in chain: `This agent has already claimed a position in this chain` (block) or `This email is already invited for another sale in this chain` (warn but allow)
- Duplicate address in chain (warn): `This address is already in the chain. Continue anyway?`

## Tone notes

- Plain English. No jargon.
- Address the agent directly ("you", "your sale", "your chain")
- Avoid sales-y language ("revolutionise your transactions" — no)
- Keep button labels active and specific ("Save and add above" not "Submit")
- Lowercase after punctuation in casual contexts; sentence case for formal labels
- Use em dashes (—) for inline asides, en dashes (–) for ranges, hyphens for compounds
- Numbers under 10 spelled out except in counts/positions ("3 invites sent" not "three invites sent")
