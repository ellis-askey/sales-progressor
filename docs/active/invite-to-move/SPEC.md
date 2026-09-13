# Invite an existing user to move agencies — SPEC

Status: **APPROVED + BUILT (dark, flag off)** — 2026-09-13. Founder signed off D1 (solo + zero sales gate) and the two-path design.
Owner: Ellis
Builds after: Fix 8 (request-to-join, `docs/active/signup-request-to-join/SPEC.md`) lands.
Law 1 note: no prior spec covered this; scope confirmed with founder 2026-09-13.

**Built (flag `MOVE_INVITES_ENABLED`, default off):** schema `AgencyMoveRequest` + `Agency.archivedAt/archivedReason` + migration 20260913150000; `lib/auth/move-invites.ts`; `lib/services/agency-moves.ts` (safety gate + auto-move + support queue + support email); `app/actions/invite-negotiator.ts` (existing-account → move invite); `lib/email/move-invitation.ts`; self-contained confirm route `app/move-invite/[token]/` + `app/actions/accept-move-invite.ts`; tests `__tests__/moves/agency-moves.test.ts`.

**v1 limitation:** the invited person must sign in, then re-open the invite link (the shared login form has no return-URL support and I deliberately didn't modify it). A future pass can add `callbackUrl` support to smooth this.

---

## 1. The problem

The duplicate-agency problem (audit Fix 8 / the Siobhan-at-Akeman case) has two halves:

- **Half A — signup:** a colleague signs up and mints a brand-new agency instead of joining the real one. Fix 8 (request-to-join) catches this **only when the agency has verified its email domain.** We've decided we can't rely on agencies verifying their domain at onboarding, so a large share of duplicates will still happen.
- **Half B — after the fact:** once the duplicate exists, there is currently **no way to fix it.** The negotiator invite and director invite both hard-stop if the email already has an account:
  - `app/actions/invite-negotiator.ts:46-52` → *"A Sales Progressor account already exists for that email."*
  - `app/actions/invite-director.ts:51-57` → same.

So the one person you most need to pull into the real agency — the colleague who already made their own — is the exact person invites refuse. **This spec fixes Half B.**

---

## 2. What we're building (one sentence)

Let a director invite a colleague **even if that colleague already has an account**, and — with the colleague's consent — move them into the director's agency; do the move automatically when it's provably safe, and hand it to the internal team when real data is involved.

---

## 3. Goals / non-goals

**Goals**
- A director can invite an email that already has an account; it no longer hard-stops.
- The invited person consents by accepting, signed in as themselves. A director can never silently absorb someone's account or data.
- When the stray account is an empty accidental agency, the move happens automatically and cleanly, and the empty shell is retired.
- When the stray account has real sales or other staff on it, **nothing is auto-moved**; it's flagged to `support@thesalesprogressor.co.uk` for a hand-checked migration.
- No new duplicate-detection or domain requirement — this works regardless of email domain.

**Non-goals**
- Automatic bulk merging of two data-heavy agencies. That stays a human-checked operation (support queue) in v1.
- Building the internal migration tool for the heavy case. v1 just captures and routes it; the actual heavy move is done by hand for now.
- Changing signup behaviour (that's Fix 8).

---

## 4. The core safety rule (the whole design hinges on this)

At the moment the invited person accepts, look at **their current agency**:

**AUTO-MOVE is allowed only if BOTH are true:**
1. They are the **only user** on their current agency (no other staff attached), AND
2. Their current agency has **zero sales/transactions**.

**Otherwise → SUPPORT PATH** (flag to `support@thesalesprogressor.co.uk`, move nothing).

Rationale: the auto path must have **nothing to migrate** except the user record itself. The instant there is real transaction data, or other people who'd be affected, moving it across tenants is a data migration with privacy and integrity risk — and that must not be a one-click action. This cut makes the auto path carry **zero data-migration risk** by construction.

> Decision D1 (needs your confirm): the auto gate is "solo + zero sales." The stricter alternative is to also require zero prospects/partners/etc.; the looser alternative is to allow auto-move for a solo person *with* a few sales by carrying their sales across. Recommendation: **ship the strict "solo + zero sales" gate**, revisit loosening it once a fully-tested transaction-move routine exists.

---

## 5. Flow

### 5.1 Director sends the invite
- Director enters name + email on the Team page (existing UI).
- The invite no longer blocks on "account already exists."
- **Uniform response** to the director in all cases: *"Invitation sent."* We do **not** tell the director whether the email already had an account. (This also removes the disclosure the current code leaks — see D4.)
- Under the hood, the invite records who/what/where and emails the person.

### 5.2 The invited person accepts
- They open the invite link and are asked to sign in as that email (proves identity + consent). Existing account → they log in; brand-new → today's set-a-password flow, unchanged.
- Once signed in as the invited email, they see a clear confirm: *"Join {agency}? You'll move from your current setup into {agency}."*
- On confirm, we re-check the safety rule (section 4) **live** and branch:

**Auto path (safe):**
1. Move the person: attach them to the new agency with the role the director chose.
2. Retire the empty leftover agency (soft-archive, reversible — not hard-deleted).
3. Tell the person *"You're now part of {agency}."* and tell the director *"{name} has joined your team."*

**Support path (real data or other staff):**
1. Move **nothing.** Their account and data stay exactly as they are.
2. Record the request and email `support@thesalesprogressor.co.uk` with: who wants to move, from which agency, what's on it (number of sales, other staff), into which agency, and who invited them.
3. Tell the person *"We'll move your existing sales across carefully — our team will sort this and be in touch. Nothing has changed yet."*
4. Tell the director *"We're handling {name}'s move — our team will complete it shortly."*
5. The internal team completes the move by hand (v1). Later this becomes a proper internal tool.

### 5.3 If they decline / ignore
- Nothing changes. The invite expires after 7 days (matches existing invites). Their account stays as-is.

---

## 6. Consent & security (non-negotiable)

- **Consent lives with the person being moved.** The move only runs after they accept while authenticated as the invited email. C-D7.
- Only a **director of the target agency** can send a move invite (existing guard).
- Token is single-use and expires (7 days, matching current invites).
- Internal staff accounts (`sales_progressor` / `admin` / `superadmin`, no agency) can never be moved into an agency — invites to those are refused.
- Inviting someone already on your own agency → friendly no-op (*"They're already on your team."*).
- **No enumeration oracle:** the director always sees "Invitation sent," so the feature can't be used to probe which emails are registered.

---

## 7. Data operation — the auto move, precisely

Auto path only runs when the leftover agency is solo + zero sales, so the move is:
1. `User.agencyId` → target agency; `User.role` → director's chosen role; `User.firmName` → target agency's name. (Mirrors how accepting a normal invite attaches a user.)
2. Any small owned-by-user records that are cheap and safe to carry (e.g. their notification prefs) stay with the user automatically because they hang off the user, not the agency.
3. Leftover agency: **soft-archive** (mark inactive/archived with a timestamp + reason), not delete. Reversible if anything looks wrong. D2.
4. Audit log line: `agency_move_auto userId=… from=… to=… by=…`.

Because the gate guarantees zero transactions and no other users, there are **no transaction/contact/milestone/chase/reminder/email rows to reassign** — which is the entire point.

---

## 8. Support handoff — the heavy case, precisely

- Create an `AgencyMoveRequest` record (status `pending`): requesterUserId, fromAgencyId, toAgencyId, invitedByUserId, a snapshot count of sales + other staff, createdAt. D3.
- Email `support@thesalesprogressor.co.uk` with the same details + a link to review.
- This gives the internal team a real queue (and prevents duplicate flags for the same person).
- The actual data move is performed manually in v1. The record is marked `completed` when done.

> D3 (confirmed direction): support queue = a small record + email to `support@thesalesprogressor.co.uk`. Alternative was email-only; the record is worth it for a dedupe-able queue.

---

## 9. Schema changes

- **Reuse** the existing invitation tables for the invite/accept mechanics where possible; add a small flag/marker if needed to tell the accept page "this is a move, not a fresh signup."
- **Add** `AgencyMoveRequest` (support queue) — small: id, requesterUserId, fromAgencyId, toAgencyId, invitedByUserId, salesCount, otherStaffCount, status (`pending`/`completed`/`cancelled`), createdAt, completedAt.
- **Add** a soft-archive marker on `Agency` if one doesn't already exist (e.g. `archivedAt`, `archivedReason`) for retiring emptied shells.
- Migration to **staging first**, then production (Law 3).

Exact fields finalised at build time against the live schema; this section is the shape, not the final DDL.

---

## 10. Notifications & copy (voice-passed at build, Law 21)

- Invite email (existing account): *"{director} has invited you to move to {agency} on The Sales Progressor."* + accept link. No em-dashes, no "delete", no exclamation marks.
- Auto-move success → person + director in-app + email.
- Support path → person ("we'll sort it, nothing's changed"), director ("we're handling it"), support (full detail).
- All strings pass `docs/reference/VOICE.md`.

---

## 11. Rollout

- Ship behind an off-by-default switch (like Fix 8's `SIGNUP_JOIN_REQUESTS_ENABLED`), e.g. `MOVE_INVITES_ENABLED`. D5.
- With the switch off, invites behave exactly as today (existing accounts still blocked). Safe to deploy dark, switch on deliberately.

---

## 12. Edge cases

| Case | Behaviour |
|---|---|
| Invited email has no account | Today's set-a-password invite, unchanged |
| Invited email = solo empty agency | Auto-move + retire the shell |
| Invited email has real sales (solo) | Support path |
| Invited email's agency has other staff | Support path (moving them could orphan the others) |
| Invited person is a director with staff under them | Support path |
| Invited person already on the inviting agency | Friendly no-op |
| Invited person is internal staff (no agency) | Refused |
| Person declines / ignores | Nothing changes; invite expires at 7 days |
| Data changes between invite and accept | Safety rule is re-checked **at accept**, so the decision is always current |
| Same person invited twice | Deduped; one open invite / one support record |
| Person has a pending Fix 8 request elsewhere | Accepting a move supersedes it; the old pending request is cancelled |

---

## 13. Testing

- Unit: the safety-gate decision (solo+zero-sales → auto; anything else → support) across each edge-case row.
- Unit: auto-move reassigns the user + archives the shell + writes the audit line.
- Unit: support path moves nothing, creates the queue record, emails support.
- Unit: consent guard (move refuses unless the accepting session is the invited email); director-only + target-agency scope guard.
- Integration/E2E (happy path): director invites existing solo-empty user → person accepts → lands in the new agency; leftover archived.
- All green + `tsc` clean before commit (Law 2). Staging before prod (Law 3).

---

## 14. Decisions for sign-off

| # | Decision | Recommendation |
|---|---|---|
| D1 | Auto-move gate | **Solo + zero sales.** Everything else → support. (Confirm the "zero sales" threshold.) |
| D2 | Emptied leftover agency | **Soft-archive (reversible)**, not hard-delete |
| D3 | Support queue | **Small record + email to support@thesalesprogressor.co.uk** (confirmed) |
| D4 | Director-side response | **Uniform "Invitation sent"** — no disclosure of whether the email exists (also removes today's leak) |
| D5 | Rollout | **Off-by-default switch**, ship dark like Fix 8 |
| D6 | Role on move | **Director's pick at invite time** (as today) |
| D7 | Consent | **Person must accept, signed in as that email** — non-negotiable |

---

## 15. Out of scope (future)

- A proper internal one-click **heavy-merge tool** to replace the manual support step.
- Loosening D1 to auto-carry a solo person's sales once a fully-tested transaction-move routine exists.
- Catching duplicates at signup without domain verification (separate, harder problem — deliberately not attempted here).
