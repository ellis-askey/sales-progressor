# Request to join your agency — signup flow SPEC

**Status:** DRAFT for Ellis sign-off. Do not build until the open decisions in §14 are settled.
**Audit ref:** Fix 8 / P1-8 (signup fragmentation). Motivating case: Siobhan at Akeman Resi self-registered a brand-new agency instead of joining the existing one.
**Author:** pre-launch fix pass, 2026-09-13.

---

## 1. Problem

Every new account mints a **brand-new Agency**. The only way to join an existing agency is a director-issued invite, which a colleague signing up on their own doesn't know to ask for. So a real agency of a director + N negotiators, all told "sign up at the link", becomes N+1 separate single-person tenants that can't see each other's files, with per-agency billing.

## 2. Goal

When someone signs up whose work email belongs to an agency **already on TSP**, route them into that agency (pending a director's approval) instead of silently creating a duplicate. Cover **every** way an account can be created. Never reveal to an arbitrary person whether a given domain is a TSP customer. Never auto-merge based on domain alone — a human (the agency's director) always approves.

## 3. The two entry points that create an agency (verified in code)

Both funnel through one chokepoint, `createDirectorWithAgency` (`lib/auth/create-director-with-agency.ts`), which creates the Agency then the User in one `$transaction`:

1. **Email + password** — `app/register/page.tsx` → `POST /api/register` → `createDirectorWithAgency({ email, password, role, agencyName })`. No email verification today; account is live immediately and the client auto-signs-in.
2. **OAuth (Microsoft / Google) first login** — a net-new OAuth user is created by the Prisma adapter as `role = viewer`, `agencyId = null`. The jwt callback sets `needsSignupCompletion = true` (viewer + no agency). `requireSession()` routes them to `/signup/complete` → `completeOAuthSignup` action → the SAME `createDirectorWithAgency({ userId, role, agencyName })` (update branch). A later re-login with still-no-agency lands here again, so this one page also covers "re-login with no agency".

**Interception happens at the decision layer** (the `/api/register` route and the `completeOAuthSignup` action), immediately before `createDirectorWithAgency`, because we need to branch to "create a join request" *instead of* creating an agency.

## 4. The core decision: email domain → destination

A shared helper, `resolveSignupDestination(email)` in a new `lib/auth/signup-destination.ts`:

```
domain = email.split("@")[1].toLowerCase()
matches = verifiedDomain.findMany({ where: { domain, status: "verified" }, select: { agencyId } })
  0 matches  → { kind: "new-agency" }              // normal signup, unchanged
  1 match    → { kind: "join-request", agencyId }   // route to request-to-join
  >1 matches → { kind: "new-agency" }               // ambiguous, never guess (see §12)
```

Because verified domains are an agency's **own custom domain** proven via SendGrid DKIM/SPF (`VerifiedDomain`, `check-domains` cron), generic mailboxes (gmail/outlook/hotmail) never match — so a request-to-join only triggers on a strong, custom-domain signal. `VerifiedDomain` uniqueness is only `[agencyId, domain]`, so the multi-match case is handled explicitly (fall back to new-agency, never route to the wrong tenant).

## 5. Data model (new — additive migration, no backfill)

```prisma
model AgencyJoinRequest {
  id              String            @id @default(cuid())
  agencyId        String
  requesterUserId String            // the viewer/no-agency User created at signup
  requesterEmail  String            // lower-cased, snapshot for display + dedup
  requesterName   String
  status          JoinRequestStatus @default(pending)
  decidedByUserId String?           // director who approved/rejected
  decidedAt       DateTime?
  expiresAt       DateTime          // signup + 7 days (mirrors NegotiatorInvitation)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  agency        Agency @relation(fields: [agencyId], references: [id], onDelete: Cascade)
  requesterUser User   @relation("JoinRequestRequester", fields: [requesterUserId], references: [id], onDelete: Cascade)
  decidedByUser User?  @relation("JoinRequestDecidedBy", fields: [decidedByUserId], references: [id])

  @@index([agencyId, status])
  @@index([requesterUserId])
}
enum JoinRequestStatus { pending approved rejected expired cancelled }
```

Back-relations added to `Agency` and `User`. No change to existing tables. One additive migration (applies on deploy, same as the solicitor-CC one).

**Design choice — create the User, then hold the request (not "hold everything before creating the user").** For BOTH paths the requester ends up as a real `User` row with `role = viewer`, `agencyId = null`, plus a `pending AgencyJoinRequest`. This unifies email + OAuth, reuses the existing `needsSignupCompletion` / `requireSession` machinery, lets the person log back in to see their status, and means "approve" is exactly the proven invite-accept transaction (stamp `agencyId` + `role` onto the existing User). For email-password, the password is stored on the User as normal (bcrypt), so nothing new to persist.

## 6. Flow A — OAuth first login (clean, disclosure-safe by construction)

The OAuth provider has already **proven the person controls the mailbox**, so no extra verification is needed and there's no enumeration oracle (only someone who can sign in as `@domain` learns of a match).

1. Net-new OAuth user exists as `viewer` / `null` agency (unchanged).
2. At `/signup/complete`, before showing the "name your agency" form, call `resolveSignupDestination(session.user.email)`.
   - `new-agency` → the existing complete-signup form (unchanged).
   - `join-request` → **skip the form.** Create a `pending AgencyJoinRequest` (idempotent on `requesterUserId`), notify the agency's director(s) (§9), and redirect to `/signup/pending` (§10). Do not create an agency.

## 7. Flow B — email + password (the disclosure decision lives here)

Email ownership is **not** proven at `/register` today (no verification). Two options, and this is the main product decision (§14, D1):

- **Option B1 — verify-first (recommended).** `/register` always responds with a neutral "Check your email to finish signing up" and sends a verification link (new `verificationToken`, reuse the forgot-password token machinery). Only when the link is clicked (mailbox ownership proven) do we branch via `resolveSignupDestination`: `new-agency` → create agency + sign in; `join-request` → create the pending request + notify directors + show `/signup/pending`. Because the branch happens only after the person proves they receive mail at that domain, there is **no enumeration oracle**, and this also closes the audit's separate "no email verification" finding. Cost: signup is no longer instant-sign-in for password users (one email round-trip). This is a deliberate change to the current low-friction posture.
- **Option B2 — reveal-on-match (lighter, MVP).** Keep instant signup. `resolveSignupDestination` runs at `/api/register`: `new-agency` → today's behaviour; `join-request` → create the pending request + neutral "Your account needs your agency administrator's approval" + notify directors. Residual: a person signing up with `x@acme.co.uk` learns acme is a customer (mild B2B-low-sensitivity oracle; mitigated by custom-domain-only matching + the existing IP signup rate-limit). Acceptable at pre-launch scale; upgrade to B1 before broad launch.

OAuth (Flow A) is unaffected by this choice — it's always disclosure-safe.

## 8. What "approve" does (reuse the proven invite-accept transaction)

Mirrors `app/invite-negotiator/[token]/accept/page.tsx`:

```
$transaction:
  user.update({ where:{ id: req.requesterUserId }, data:{ agencyId: req.agencyId, role: <chosen>, firmName: <director's firmName> } })
  agencyJoinRequest.update({ where:{ id }, data:{ status:"approved", decidedByUserId, decidedAt: now } })
then: notify the requester (in-app + email "You're in — log in"), and bump the requester's sessionVersion so their next request picks up the new agency (or rely on the needsSignupCompletion re-read, which already clears once agencyId is set).
```

**Reject** → `status:"rejected"`, notify the requester with a neutral message ("Your request wasn't approved. Contact your agency administrator."). The requester User stays as viewer/no-agency; offer them "create your own agency instead" (§12).

## 9. Notifications to the director(s)

- **Who:** `user.findMany({ where:{ agencyId, role:"director", isDemo:false }, select:{ id, name, email } })` (canonical director query, per `lib/agency/director-status.ts`).
- **In-app bell:** one `createNotification({ userId, type:"agency_join_request", payload:{ title, body, requestId } })` per director (`lib/services/notifications.ts`). Add a typed wrapper `notifyDirectorsOfJoinRequest(requestId)`.
- **Email:** a new `lib/email/join-request-*.ts` helper, sent to each director, "Someone from your agency has asked to join TSP" with an Approve link into the team page (§11). Send via the agency-sender-policy-aware path (per `reference_agency_sender_policy`), mirroring `notifyDirectorOfAcceptance`.

## 10. Requester experience while pending

- New page `/signup/pending` (public-ish, session-gated): "Thanks — your request to join {agencyName? or 'your agency'} is with your administrator. We'll email you when it's approved." (Avoid naming the agency if we want to minimise disclosure; naming it is friendlier — a §14 sub-decision.)
- The requester is a `viewer`/no-agency user with a pending request. **Session/middleware routing** must send such users to `/signup/pending` instead of `/signup/complete`. Implement by computing `hasPendingJoinRequest` in the jwt callback (same pattern as `needsSignupCompletion`, re-read while true) and branching in `requireSession()` (`lib/session.ts`) + the `/signup/complete` page guard.
- On decision, email the requester (approved → log-in CTA; rejected → neutral + "create your own agency" link).

## 11. Director approval surface

- Surface pending requests on the existing team area (`/agent/settings` team tab, or `/agent/account/team` — confirm the live route). Reuse `agency-team` service patterns.
- A "Join requests" list: requester name + email + "asked N days ago", with **Approve** (defaults role to negotiator; optional director/negotiator toggle) and **Reject** buttons. Server actions `approveJoinRequestAction(requestId, role)` / `rejectJoinRequestAction(requestId)`, both director-only, both scoped so a director can only act on their own agency's requests (`request.agencyId === session.user.agencyId`).
- The Approve email link deep-links here.

## 12. Edge cases

- **Agency has no active director** (can't approve): fall back to notifying internal TSP staff (admin), or auto-expire to a new-agency offer. MVP: notify internal staff; the request still shows for any future director.
- **Multiple agencies verified the same domain** (rare; uniqueness is per-agency): `resolveSignupDestination` returns `new-agency` (never guess the tenant).
- **Genuine new agency on a matched domain** (very rare for custom domains): the director rejects; the requester gets the "create your own agency instead" path (a one-click that runs the normal `createDirectorWithAgency`).
- **Expiry** (`expiresAt`, +7d): a nightly sweep (small cron, or fold into an existing one) sets stale `pending` → `expired` and emails the requester "your request expired — ask your admin to invite you, or create your own agency."
- **Duplicate requests:** idempotent on `requesterUserId` (one open request per user); re-signup with a pending request just returns them to `/signup/pending`.
- **Generic mailboxes** (gmail/outlook): never match a verified domain → always `new-agency`. No false positives.
- **Domain later verified after someone already made a new agency:** out of scope (no retro-merge); the existing invite path handles consolidation.

## 13. Migration & rollout

- One additive migration (`AgencyJoinRequest` + enum + back-relations). Applies on deploy (Vercel `migrate deploy`), same as the solicitor-CC table. No backfill.
- Feature-flag the interception (`SIGNUP_JOIN_REQUESTS_ENABLED`, default off) so it can ship dark and be switched on deliberately — matches the house pattern (chase kill-switches).

## 14. Decisions — SETTLED (Ellis, 2026-09-13)

- **D1 — email-password:** **B2 instant / reveal-on-match.** No email verification, no added friction. Intercept at `/api/register`; on a verified-domain match create the pending request immediately and show a neutral "needs your administrator's approval". (Revisit verify-first before broad launch.)
- **D2 — role on approval:** the director **chooses** director/negotiator at approval, **defaulted to the role the signer selected** at signup. So the request stores `requestedRole`, and the approve UI pre-selects it.
- **D3 — name the agency** to the requester on the pending/approval screens (e.g. "your request to join Hartwell & Partners").
- **D4 — no-director fallback:** email **support@thesalesprogressor.co.uk** so TSP handles it. The request still persists for any future director.
- **D5 — expiry:** **7 days.**

## 15. Build phases (once decisions are in)

1. **Schema + decision helper + flag:** `AgencyJoinRequest` model + migration; `resolveSignupDestination`; `SIGNUP_JOIN_REQUESTS_ENABLED` (off). No behaviour change yet.
2. **OAuth path (Flow A):** intercept at `/signup/complete`; create request; `/signup/pending` page; director notifications; `hasPendingJoinRequest` routing. This is the clean, disclosure-safe slice — ship it first.
3. **Director approval surface:** team-tab list + approve/reject actions (the reused invite-accept transaction) + requester decision emails.
4. **Email-password path (Flow B):** per D1 — either add verify-first (B1) or reveal-on-match (B2) interception at `/api/register`.
5. **Edge handling:** expiry sweep, no-director fallback, "create your own agency instead".

## 16. Testing plan

- Unit: `resolveSignupDestination` (0/1/>1 verified-domain matches; generic domains; case-insensitivity). Approve/reject transactions (agencyId scoping; role stamp; status transitions; director-only). Notification fan-out to N directors.
- Integration: OAuth first-login with a matching verified domain → request created, no agency, routed to /signup/pending. Approve → user gets agencyId + role, request approved, requester notified. Reject → stays viewer, neutral notice.
- Regression: a non-matching signup (generic email, or unverified domain) still creates a new agency exactly as today (flag on and off).
- Security: cross-agency — a director of agency B cannot approve/reject agency A's request; the domain oracle behaves per the chosen D1 option.
