# Chain Feature — Claim Flow

## Overview

When a recipient clicks the claim link in an invite email, they land on a claim page. Three branches based on auth state and existing data:

1. **No account** → see teaser, sign up with pre-filled details, account is created and linked to a fresh transaction for this chain
2. **Has account, logged out** → see teaser, log in, then proceed as logged-in branch
3. **Has account, logged in (or just logged in)** → see teaser, decide whether to create a new transaction or link an existing one

## Route

`GET /claim?token={token}` — public route, no auth required.

## Server-side token validation

Before rendering anything:

1. Look up `ChainLink` by `inviteToken`. If not found → render invalid-link page.
2. Check `inviteStatus`:
   - `CLAIMED` → "Already claimed" page (see `06-invite-flow.md`)
   - `DECLINED` → "Already declined" page
   - `BOUNCED` → still allow claim (recipient might have got the email forwarded somehow)
   - `SENT` or `NOT_SENT` (defensive, shouldn't happen) → proceed to claim landing
3. Load chain context: position in chain, total links, count of claimed links, originator name + agency, originator's property address.

## Claim landing page

The page that everyone hits first (regardless of auth state). Designed to be persuasive — this is the viral-loop conversion point.

```
┌─────────────────────────────────────────────────────────┐
│                  [The Sales Progressor logo]             │
│                                                          │
│           You've been invited to join this chain         │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │                                                     │ │
│  │    {stubPropertyAddress}                            │ │
│  │    Position {linkPosition} of {totalLinks}          │ │
│  │                                                     │ │
│  │    ┌─────────────────────────────────────┐          │ │
│  │    │ {topMostAddress}                    │          │ │
│  │    │ {topAgency} · [Claimed]             │          │ │
│  │    ├─────────────────────────────────────┤          │ │
│  │    │ ... other links ...                 │          │ │
│  │    ├─────────────────────────────────────┤          │ │
│  │    │ {stubPropertyAddress}               │          │ │
│  │    │ Your sale  · [Claim to view]        │ ← high'd │ │
│  │    ├─────────────────────────────────────┤          │ │
│  │    │ ... other links ...                 │          │ │
│  │    └─────────────────────────────────────┘          │ │
│  │                                                     │ │
│  │    Invited by: {originatorName} – {originatorAgency}│ │
│  │    Invited on: {date}                               │ │
│  │                                                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│           By joining, you'll be able to:                 │
│           ✓ View the full chain structure                │
│           ✓ See live milestone progress                  │
│           ✓ Understand what's holding things up          │
│           ✓ Update your file and keep the chain moving   │
│                                                          │
│           Free to use · Takes 30 seconds                 │
│                                                          │
│           [Claim this sale]                              │
│                                                          │
│           Already have an account?  [Log in]             │
│                                                          │
│           This isn't mine · [Decline]                    │
└─────────────────────────────────────────────────────────┘
```

Key design points:

- The chain visualisation is the main draw — show the actual chain shape so the recipient sees their position in context. This is the "oh, this is real and useful" moment.
- Show other claimed agents' agency names — proves it's not a spam invite, it's a real chain with real participants.
- Don't show stub agent emails or names of unclaimed nodes (those are private to the originator).
- "Free to use · Takes 30 seconds" is the conversion-friction reducer.
- "Decline" is genuinely available — never hide it. Recipients who decline get out cleanly without bothering anyone.

## Branch 1: New user (no account)

Clicking "Claim this sale" → goes to `/claim/signup?token={token}`.

Signup form (modify existing signup component or create variant — see `09-stability-guarantees.md` on isolation):

```
┌─────────────────────────────────────────────────────────┐
│         Create your free account to join this chain      │
│                                                          │
│         🏠 You're joining {stubPropertyAddress}          │
│                                                          │
│         First name      Last name                        │
│         [_________]    [_________]                       │
│                                                          │
│         Email                                            │
│         [{stubAgentEmail — pre-filled, locked}]          │
│                                                          │
│         Password                                         │
│         [_________________]  [👁 show]                   │
│                                                          │
│         Agency                                           │
│         [{stubAgencyName — pre-filled, editable}]        │
│                                                          │
│         [Create my account]                              │
│                                                          │
│         Already have an account?  [Log in →]             │
│                                                          │
│         Takes 15 seconds · No card required              │
└─────────────────────────────────────────────────────────┘
```

Pre-fill from stub data:
- Email: pre-filled and locked (must match the invited email — if user wants a different email, they need to be invited again with that email)
- Agency: pre-filled but editable (originator might have written the agency name slightly wrong; let user correct it)
- First name / last name: not pre-filled (we only have stub agent name which might be just a first name or a misspelling)
- Password: blank, with show/hide toggle (no separate "confirm password" field — modern UX)

All pre-filled string fields are title-cased on display.

On submit:
1. Standard account creation logic runs (call existing user creation function — do not duplicate signup logic)
2. After user is created and logged in, immediately run claim logic (next section)
3. Redirect to the post-claim landing page

## Branch 2: Existing user, logged out

Clicking "Claim this sale" → checks if invite token email matches an existing user. If yes, redirects to `/claim/login?token={token}`:

```
┌─────────────────────────────────────────────────────────┐
│         Welcome back                                     │
│                                                          │
│         Log in to claim your position in this chain      │
│                                                          │
│         Email                                            │
│         [{stubAgentEmail — pre-filled, locked}]          │
│                                                          │
│         Password                                         │
│         [_________________]  [👁 show]                   │
│                                                          │
│         [Log in and claim]                               │
│                                                          │
│         Forgot password?  · [Reset →]                    │
└─────────────────────────────────────────────────────────┘
```

On successful login: proceed to claim logic, then post-claim landing page.

## Branch 3: Existing user, logged in (and email matches)

Clicking "Claim this sale" while logged in → goes straight to `/claim/confirm?token={token}`:

### Sub-branch 3a: No matching existing transaction

```
┌─────────────────────────────────────────────────────────┐
│         Claim this sale                                  │
│                                                          │
│         You're claiming {stubPropertyAddress} as part of │
│         this chain.                                      │
│                                                          │
│         A new transaction file will be created in your   │
│         dashboard with the property address pre-filled.  │
│         You'll be able to add details after claiming.    │
│                                                          │
│         [Claim and create file]   [Cancel]               │
└─────────────────────────────────────────────────────────┘
```

### Sub-branch 3b: Matching existing transaction (duplicate detection)

If the user already has a transaction matching the stub address (postcode + house number fuzzy match), show:

```
┌─────────────────────────────────────────────────────────┐
│         You already have a file for this property        │
│                                                          │
│         We found a transaction in your dashboard that    │
│         matches the property address in this invite:     │
│                                                          │
│         ┌─────────────────────────────────────────┐      │
│         │ 🏠 {existingTransaction.address}        │      │
│         │    Created {existingTransaction.date}   │      │
│         │    {existingTransaction.progress}%      │      │
│         └─────────────────────────────────────────┘      │
│                                                          │
│         What would you like to do?                       │
│                                                          │
│         [Link this file to the chain]                    │
│         (Recommended — your existing progress carries    │
│          over and becomes visible to other chain agents) │
│                                                          │
│         [Create a separate new file]                     │
│         (Use this if the invite is for a different       │
│          property that happens to share an address)      │
│                                                          │
│         [Cancel]                                         │
└─────────────────────────────────────────────────────────┘
```

If multiple matching transactions exist (rare but possible), list them all and let user pick.

## Address matching for duplicate detection

Match logic:
- Same user (logged-in user's transactions only)
- Postcode matches exactly (uppercased, whitespace stripped)
- First numeric component of street address matches (e.g. "47" in "47 Oak Road")

Example matches:
- "47 Oak Road, BS6 7TH" matches "47, Oak Road, BS6 7TH" ✓
- "47 Oak Road, BS6 7TH" matches "Flat A, 47 Oak Road, BS6 7TH" ✓ (same building)
- "47 Oak Road, BS6 7TH" does not match "48 Oak Road, BS6 7TH" ✗

If postcode is missing on either side, fall back to: city + street name + house number (less reliable, more conservative — only suggest match if very confident). Better to miss a match (user creates duplicate, support handles it) than false-match (user accidentally links wrong files).

## Claim logic (server-side)

The actual claim mutation. Called after login/signup or after confirmation:

`POST /api/claim` with body `{ token, action: "create" | "link", existingTransactionId? }`

Server logic:

1. Load `ChainLink` by token. Validate (same checks as landing page load).
2. Validate caller is logged in. Validate caller's email matches the stub email (or starts a process for "this isn't mine, but I am the right agent" — out of scope for v1, just block with helpful error).
3. Permission check: caller cannot be the link's originator.
4. Branch on action:
   - `action: "create"` →
     - Create new `PropertyTransaction` with property address from stub, owned by caller.
     - Set `chainLink.transactionId = newTransaction.id`
     - Set `chainLink.claimedByUserId = caller.id`
     - Set `chainLink.claimedAt = now()`
     - Set `chainLink.inviteStatus = CLAIMED`
     - Set `newTransaction.chainLinkId = chainLink.id`
   - `action: "link"` →
     - Verify `existingTransactionId` belongs to caller and is not already in another chain.
     - Set `chainLink.transactionId = existingTransactionId`
     - Set `chainLink.claimedByUserId = caller.id`
     - Set `chainLink.claimedAt = now()`
     - Set `chainLink.inviteStatus = CLAIMED`
     - Set `existingTransaction.chainLinkId = chainLink.id`
5. Stub data (`stubAgentEmail`, `stubAgentName`, `stubAgentPhone`, `stubNotes`) remains on the link as audit. Operational UI ignores it once claimed.
6. Return success with redirect URL: the new or linked transaction's detail page.

All steps in a single DB transaction for atomicity.

## Post-claim landing

After successful claim, redirect to the transaction detail page (`/agent/transactions/{id}`). On first arrival post-claim, show a one-time toast:

`"You've claimed your position in this chain. Open the chain panel to see other agents."`

Don't show a separate "welcome to the chain" intermediate page — it adds friction without value. The transaction page is where the user wants to be.

If the claimed transaction was newly created (action: "create"), the transaction page will trigger its existing "complete file details" prompt (see Image 6 from design notes) — that's the existing flow, untouched.

## Existing-user claim with email mismatch

If the logged-in user's email doesn't match the stub email, the claim cannot proceed (security — invite was for a specific email). Show:

```
This invite was sent to {stubAgentEmail}. You're logged in as {user.email}.

If you should have received this invite at your account email, ask the
inviting agent to resend the invite to {user.email}.

[Log out and try a different account]   [Cancel]
```

## Edge cases

- **Token claimed in a different browser tab between landing and clicking claim.** Server check at claim time will fail; show error: "This invite has just been claimed. Refresh to see the latest status."
- **Originator deletes the link before recipient claims.** Token becomes invalid. Recipient sees invalid-link page.
- **Originator's chain is deleted before recipient claims.** Same — invalid link.
- **Recipient is the originator.** Server-side check rejects: "You can't claim your own invite." (Shouldn't happen if originator UI is correct, but defensive.)
- **Race condition: two recipients somehow share the URL and click simultaneously.** First one wins (DB transaction), second sees "already claimed".

## Anti-abuse

- Rate limit `/claim` endpoint: max 10 attempts per IP per minute (prevents token brute-forcing — though tokens are unguessable, defence in depth)
- Log all claim attempts (successful and failed) with token ID (not full token), IP, user agent
- If a token is attempted with an invalid format, return generic "invalid link" — don't leak whether token exists
