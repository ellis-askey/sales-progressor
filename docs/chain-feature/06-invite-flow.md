# Chain Feature — Invite Flow

## Overview

When an originator adds a stub link with an email and triggers send (either at chain creation or later), an invite email is sent to that agent. The email contains a unique tokenised URL that lets the recipient claim the link.

## Token generation

When an invite is sent for a `ChainLink`:
- Generate a cryptographically random token (32+ chars, URL-safe). Use `crypto.randomBytes(32).toString('base64url')` or equivalent.
- Store on `chainLink.inviteToken` (unique constraint enforces no collision)
- Token is single-use — claiming consumes it. Resending generates a new token.
- Tokens do not expire in v1. (Could add expiry in v1.1 if abuse becomes an issue. For now, real-world chains can take months and we don't want a usable invite to die.)

## Claim URL

`https://app.thesalesprogressor.co.uk/claim?token={token}`

Use the production domain. In dev/preview environments, swap base URL via env var.

## Email content

Subject: `{originatorAgencyName} has added you to a live chain — {originatorPropertyAddress}`

Example: `Akeman Residential has added you to a live chain — 51 The Meadway`

Body (HTML, matching existing transactional email template style — inspect existing email templates in the codebase first for layout/header/footer):

```
Hello {recipientAgencyName or "there"},

{originatorName} at {originatorAgencyName} has added you to a live sales chain
in The Sales Progressor.

They're tracking the sale of {originatorPropertyAddress} and have linked your
sale at {stubPropertyAddress} as the {position} link in the chain.

You're #{linkPosition} of {totalLinks} in this chain. {claimedCount} of {totalLinks}
agents are already tracking it together.

This link lets you claim your position in the chain and get visibility on
what's happening across every sale in the transaction.

What you'll be able to do:
  • View the full chain structure
  • See real-time milestone progress on every sale
  • Understand what's holding the chain up
  • Update your own file and keep other agents informed

The aim: fewer chase calls, clearer visibility, faster exchanges.

[Claim this sale]

If the button doesn't work, copy and paste this link into your browser:
https://app.thesalesprogressor.co.uk/claim?token={token}

Not the right agent? [This isn't mine →]

Need help? support@thesalesprogressor.co.uk
```

Notes on the copy:
- `{recipientAgencyName}` falls back to "there" if no agency was provided in stub (shouldn't happen since agency is required, but defensive)
- `{position}` reads "above your sale" or "below your sale" relative to the originator
- `{linkPosition}` and `{totalLinks}` give chain context — important social proof
- `{claimedCount}` counts the originator + any other already-claimed agents (typically 1 at first invite — just the originator)
- "This isn't mine" link goes to a server route that marks the invite as DECLINED and shows a confirmation page

## Send mechanism

Use the existing transactional email infrastructure (inspect codebase — likely Resend, Postmark, or SendGrid given the Vercel deployment). Don't introduce a new email provider.

Send asynchronously where possible. If using a queue, enqueue the send job. If sending synchronously from the server action, do it after the DB writes have committed so a send failure doesn't roll back the link creation.

Track the send result:
- Success → status remains `SENT`
- Bounce (hard bounce only — soft bounces retry automatically by the provider) → update to `BOUNCED`, set `inviteBouncedAt`, notify originator
- Provider error → log, retry with exponential backoff up to 3 attempts, then mark `BOUNCED` with error logged

## Bounce handling

The email provider's bounce webhook (or polling) updates the link's `inviteStatus` to `BOUNCED`. Originator sees this in:

1. The View Chain drawer — affected card shows "Invited ⚠ Email bounced" status (see `04-view-chain-drawer.md`)
2. An in-app notification (use existing `ToastContext` or notification primitive — inspect codebase for current pattern). Notification text: `"Your chain invite to {email} for {address} couldn't be delivered. Update the email and try again."`
3. An email to the originator (optional in v1 — if email infra makes it trivial, include it; otherwise rely on in-app)

When the originator updates the email and resends:
- Generate a new token (invalidate the old one — set `chainLink.inviteToken = newToken`)
- Increment `inviteResendCount`
- Reset `inviteStatus = SENT`, `inviteBouncedAt = null`, `inviteSentAt = now()`

## Resend (manual, no bounce)

Originator can manually resend any time (e.g. they nudged the agent verbally and want a fresh invite). Same logic as bounce-resend but without the bounce reset.

Limit: max 5 resends per link in v1. After 5, the resend button is disabled with helper text: "Maximum resends reached. Contact support if needed." (Generous limit — covers reasonable retry without enabling spam.)

## Decline flow

When the recipient clicks "This isn't mine" in the email:

1. Hits a server route: `GET /claim/decline?token={token}`
2. Server validates token, finds link, sets `inviteStatus = DECLINED`, `inviteDeclinedAt = now()`
3. Response page (no auth required):

```
Thanks — we've let the agent know.

This invite has been declined. {originatorName} at {originatorAgencyName} will
see this and can update the contact details if needed.

If you received this in error and want to report it, email
support@thesalesprogressor.co.uk
```

4. Originator gets notified (in-app and/or email): "{recipientEmail} declined your chain invite for {address}."

## Originator notifications for invite events

In v1, originators see invite events through:

1. **In-app card status** (always) — bounce/decline/claim status visible on the chain card in the View Chain drawer
2. **Toast/inline notification** when the originator is active in the app and an invite event happens

Do NOT send email notifications to the originator for invite events in v1 (notification infrastructure is deferred to v1.1). The exception is bounce — it's worth a one-time email to the originator on first bounce, because they may not be in the app to see the toast.

## Pre-claim landing page

Visiting `/claim?token={token}` (the URL from the email):

1. Server validates token. Possible states:
   - **Valid token, link unclaimed** → render claim landing page (see `07-claim-flow.md`)
   - **Valid token, link already claimed** → render "Already claimed" page: "This chain link has already been claimed. If you believe this is a mistake, contact support."
   - **Valid token, link declined** → render "Already declined" page: "This invite was declined. Contact the inviting agent if you'd like to be re-invited."
   - **Invalid/expired token** → render "Invalid link" page with support contact

2. Claim landing page is described in detail in `07-claim-flow.md`.

## Token security

- Tokens are unguessable (cryptographic random)
- No PII in tokens (use them as opaque lookup keys only)
- Tokens are not logged in URLs (don't log full URLs in app logs — use the link ID instead)
- HTTPS only (enforced at Vercel)
- Tokens are not invalidated on view, only on claim/decline (so a recipient can preview the claim page without committing)

## Email rendering

Use existing transactional email template wrapper (header with logo, footer with company info and support link). Inspect the existing milestone email templates for the agent-app brand styling and replicate.

If using React Email or similar JSX-based email rendering, create the chain invite as a new template component. Plain text version must also be provided (plain-text fallback for clients that don't render HTML).

## Internationalisation

Not in v1 scope — English only. But avoid hardcoding strings deep in business logic; keep email copy in template files so future translation is feasible.

## Testing requirements

Implementation must include:
- Unit test: token generation produces unique, URL-safe tokens
- Integration test: invite send creates email with correct token in URL
- Integration test: bounce webhook updates link status
- Integration test: decline endpoint updates status and shows confirmation page
- Integration test: claim with valid token works, with invalid token shows error
- Integration test: resending generates a new token and invalidates old
