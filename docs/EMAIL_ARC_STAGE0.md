# Email Arc — Stage 0: Strategic Decisions

**Status:** Awaiting approval before Stage 1  
**Date:** 2026-05-20  
**Scope:** V1 email strategy — types, recipients, compliance, deliverability

---

## Existing baseline

Before decisions: what is already live or built.

| Component | State |
|---|---|
| `sendEmail()` in `lib/email.ts` | Live — plain text or naive HTML, no List-Unsubscribe headers |
| Invite email (`lib/chain/invite.ts`) | Live — wired to SendGrid, HTML + text, sends via `agencyFrom()` |
| `ChainNotificationQueue` (withdrawal) | Queue built, `notifiedAt` flag ready — email sender **not wired** |
| Decline notification | In-app banner only — no email path |
| Milestone emails | No infrastructure exists |
| Unsubscribe mechanism | None |
| Default sender | `Sales Progressor <updates@thesalesprogressor.co.uk>` |

The invite email is the only chain email that currently sends. Everything else is queued (withdrawal) or absent.

---

## Section 1 — Email types in scope for V1

### Tier 1 — Must ship

**1. Invite email**

Already live. Included here for completeness and to confirm it needs the compliance additions (unsubscribe header, List-Unsubscribe) before V1 ships — currently it sends neither.

- **Trigger:** `inviteStatus` transitions to `SENT` (resend included)
- **Recipients:** `stubAgentEmail` on the chain link — the named agent
- **Frequency cap:** 1 per chain link per 24 hours (resend throttle, already partially enforced)
- **Suppression:** Link already CLAIMED or DECLINED; recipient on global suppression list; no valid email address
- **Gap to close:** Add `List-Unsubscribe` header and footer unsubscribe link

---

**2. Withdrawal cascade notification**

The queue is built (`ChainNotificationQueue`), populated on withdrawal, and drain logic just needs implementing. This is the highest-stakes email: a sale falling through is the event agents most need to know about instantly, not on next login.

- **Trigger:** `notifyChainMatesOfWithdrawal()` creates queue records; drain job processes them
- **Recipients:** All claimed chain-mates (agents with `inviteStatus = CLAIMED`, `transactionId != null`), excluding the withdrawing party — already resolved in the queue
- **Frequency cap:** Once per withdrawal event per chain. The queue's `@@unique([withdrawingTransactionId, recipientUserId])` prevents duplicates natively
- **Suppression:** `notifiedAt` already set (idempotent drain); recipient on global suppression list
- **Drain mechanism:** Recommend a Vercel cron job (e.g. every 5 minutes) that processes unsent queue records. No real-time requirement — 5 minutes is fine for a withdrawal notification

---

**3. Decline notification to originator**

The in-app banner (`chainDeclineNotificationAddress` + `chainDeclineNotificationAt`) works only if the originator logs in. An agent who gets a decline at 6pm Friday and doesn't check the app until Monday has missed 2.5 days to re-invite. Email closes that gap.

**Recommendation: include in V1.**

- **Trigger:** `inviteStatus` transitions to `DECLINED` (the decline page mutation)
- **Recipients:** `chain.createdByUserId` — the agent who sent the invite
- **Frequency cap:** Once per decline event. No repeat
- **Suppression:** Originator on global suppression list; originator email not available
- **Note:** The in-app banner stays. Email is supplementary, not a replacement

---

**4. Exchange notification to chain-mates**

When a sale in the chain exchanges, every other claimed agent needs to know. Exchange is the single event that unlocks everyone else's exchange readiness. This is more operationally useful than any other milestone email.

- **Trigger:** The "Exchange of contracts" milestone completes on a transaction that has a chain link
- **Recipients:** All other claimed agents in the same chain
- **Frequency cap:** Once per chain link per exchange event. One email, not repeatable
- **Suppression:** Chain already broken (withdrawn link in chain); recipient on global suppression list; recipient is the same agent who completed the milestone

**Milestone identification:** This requires knowing which milestone ID maps to "Exchange of contracts." That's a Stage 1 question (reading `MILESTONES_SPEC_v1.md` to confirm the milestone slug). Flag for Stage 1.

---

**5. Completion notification to chain-mates**

When a sale completes, other agents in the chain should know. Lower urgency than withdrawal or exchange, but high goodwill value and directly relevant to their own completion readiness.

- **Trigger:** The "Completion" milestone completes on a transaction that has a chain link
- **Recipients:** All other claimed agents in the same chain
- **Frequency cap:** Once per chain link per completion event
- **Suppression:** Same as exchange — global suppression, same-agent check

---

### Tier 2 — Proposed for V1 (with conditions)

**6. Completion celebration (all chain-mates)**

When the entire chain completes — every link reaches completion — a single celebratory email to all participants. Brand moment, goodwill, potential testimonial prompt.

**Recommendation: include in V1, but only as a simple text email. No elaborate design.**

- **Trigger:** The last uncompleted chain link completes (all links in chain have completion milestone)
- **Recipients:** All claimed agents in the chain
- **Frequency cap:** Once per chain — fires at most once in the chain's lifetime
- **Suppression:** Global suppression
- **Condition for V1 inclusion:** Low complexity. Detecting "all links completed" requires checking chain state after each completion event. Not expensive. Worth the brand value

---

**7. Chain visibility nudge to unclaimed agents**

Covered fully in Section 2. See below.

---

### Tier 3 — Explicitly deferred, not in V1

| Email type | Why deferred |
|---|---|
| Risk/inaction alert (no milestone progress for N days) | Requires threshold logic and per-transaction state tracking; false positive risk is high before you've calibrated thresholds against real data |
| Weekly chain health digest | Digest infrastructure (aggregation, scheduling per user) is significant build. Deferred to V2 |
| Morning brief | Same as above — personalised daily aggregation |
| Mortgage offer notification to chain-mates | Lower signal value than exchange/completion; agents don't consistently act on this. V1.1 |
| Searches received/survey booked | Too early-stage to be chain-relevant; creates noise before trust is established. V1.1 |
| New transaction created notification | Internal signal, not cross-chain |
| Solicitor-facing emails | Different audience, different compliance surface |
| Re-engagement sequences | Not relevant at pre-launch scale |
| Referral/review request post-completion | Premature — no critical mass of completions yet |

---

## Section 2 — Claimed vs unclaimed recipient policy

### The three models

**Model A — Only claimed agents get operational emails post-invite**
After the initial invite, silence until they claim. If they claim, they enter the claimed-agent notification path.

**Model B — Unclaimed agents receive ongoing operational updates**
Treat unclaimed stubs as participants; send withdrawal notifications, milestone updates, etc.

**Model C — Unclaimed agents get one follow-up nudge tied to a significant chain event, then silence**
Invite sent → event-triggered nudge (once) → silence until they claim or the invite expires.

---

### Recommendation: **Model A** for V1, with the door open for Model C in V1.1

Here is the reasoning.

**PECR / UK GDPR analysis**

PECR applies to "electronic mail" marketing to "individual subscribers." The line between transactional and marketing email matters.

- The **invite email** is transactional: the agent was directly named, their address used by a third-party agency to invite them to a specific service. This is defensible as a legitimate business communication under both PECR (soft opt-in for B2B) and UK GDPR legitimate interests.
- A **follow-up nudge** is harder. The agent received one email. A second email that was not triggered by their action is, by most readings, electronic direct marketing. For corporate email addresses (limited companies), PECR is softer — legitimate interests applies. For sole traders or personal addresses (common in estate agency), prior consent or a prior relationship is required.
- **The problem:** you cannot reliably distinguish corporate from personal addresses at invite time without a reverse-lookup you don't have.

The safer default is to treat all unclaimed addresses as requiring explicit consent for anything beyond the initial invite.

**Spam complaint risk**

An unclaimed agent who receives a second email they didn't ask for and don't recognise is a spam complaint risk. One spam complaint per 1,000 emails is the rough threshold before inbox providers start degrading deliverability. At pre-launch scale with a small pool of invites, even two or three complaints could damage the sending subdomain's reputation during the period when you're trying to establish it.

The invite email converts or it doesn't. A nudge email has some marginal conversion lift — but the cost of a spam complaint at this stage outweighs that lift.

**Conversion lift estimate**

Realistically, a follow-up nudge email tied to a chain event might recover 5–15% of "lost" invitees who meant to claim but forgot. At current scale (handful of live chains), that's potentially one or two agents. Not worth the compliance surface right now.

**Why not Model C in V1?**

Model C is the right long-term model. But implementing it safely requires:
- Per-type opt-out tracking for unclaimed recipients (no User record exists for them)
- Token-based unsubscribe on every nudge email (signed token linked to chain link)
- A clear legal basis documented for the nudge category
- A defined trigger that's genuinely event-based, not just a timer

That's meaningful engineering. Doing it badly (no unsubscribe, weak trigger, unclear basis) is worse than Model A. Build it right in V1.1 after you have deliverability reputation established.

**Model A operational implication**

Unclaimed agents after V1: invite email (with unsubscribe footer) → silence. If they claim, they enter the claimed-agent path and receive operational emails going forward. If they don't claim within the invite window, no further contact.

This is clean, defensible, and leaves zero regulatory surface open.

---

## Section 3 — Subdomain and deliverability

### Recommendation: dedicated sending subdomain

**Authenticated sending domain:** `mail.thesalesprogressor.co.uk`  
**From address:** `Sales Progressor <updates@thesalesprogressor.co.uk>` (existing, unchanged)  
**Reply-To:** `support@thesalesprogressor.co.uk`

Reasoning on the sending subdomain: SendGrid signs outbound mail with DKIM using the authenticated domain. If you authenticate `thesalesprogressor.co.uk` directly and a spam complaint lands, the main domain's reputation is at risk — affecting the marketing site, portal logins, and any future email infrastructure. A dedicated sending subdomain (`mail.`) isolates reputation: email deliverability issues are contained to the subdomain, not the root.

The From address can remain `updates@thesalesprogressor.co.uk` while the DKIM signing domain is `mail.thesalesprogressor.co.uk`. This is SendGrid's standard whitelabel setup and is fully compliant.

### Sender address

`updates@thesalesprogressor.co.uk` is already in the codebase as `DEFAULT_FROM`. Keep it. It's recognisable and consistent with what test users have already seen.

Do not use `noreply@`. It creates a dead end for agents who hit reply, and Gmail and Outlook treat noreply addresses as lower-trust signals. Use `updates@` for chain/system emails.

### Reply-To

Route replies to `support@thesalesprogressor.co.uk`. Agents who reply to a chain email are either confused or have a problem — both should reach a monitored inbox, not bounce.

**Open question for Ellis:** Does `support@thesalesprogressor.co.uk` currently exist as a monitored inbox? If not, this needs creating before V1 ships.

### SPF / DKIM / DMARC

| Record | Recommendation |
|---|---|
| SPF | `include:sendgrid.net` on `mail.thesalesprogressor.co.uk` (SendGrid generates the exact record) |
| DKIM | Two CNAME records pointing to SendGrid's signing infrastructure (SendGrid generates these) |
| DMARC | Start at `p=none; rua=mailto:dmarc@thesalesprogressor.co.uk` — monitoring mode. Escalate to `p=quarantine` after 2–4 weeks of clean reports |

DMARC reporting address (`dmarc@thesalesprogressor.co.uk`) just needs to be a monitored inbox or a DMARC reporting tool. Can be the same as support@ initially.

**Manual setup required:** SendGrid domain authentication for `mail.thesalesprogressor.co.uk`, plus DNS records at the registrar. This belongs in `docs/ELLIS_MANUAL_TODO.md`. Stage 2 will flag it.

### Provider

SendGrid. No reason to change — it's live, integrated, and the `sendEmail()` wrapper already uses it. Switching providers at this stage would be disruption without benefit.

---

## Section 4 — Unsubscribe and preferences

### Minimum viable architecture for V1

**Required on every email (even transactional):**

1. **Footer unsubscribe link** — one-click, token-authenticated. "Unsubscribe from all Sales Progressor emails." Not per-type — global only in V1.
2. **`List-Unsubscribe` header** — Gmail and Outlook render a native unsubscribe button when this header is present. SendGrid supports this natively via their unsubscribe group feature, or it can be added manually to the `sendEmail()` call.
3. **`List-Unsubscribe-Post` header** — RFC 8058 one-click POST unsubscribe, required by Gmail's bulk sender rules (>5,000 emails/day, but good practice now). SendGrid handles this automatically if using their unsubscribe groups.

**No preference centre in V1.** With 5 email types and pre-launch scale, a preference centre adds engineering surface without meaningful user benefit. An agent who doesn't want emails should have a simple "unsubscribe from all" path. That's it.

### Storage architecture

**For claimed agents (User record exists):**
- Add `emailUnsubscribedAt DateTime?` to the User model
- Before any outbound email to a known user, check this field — skip the SendGrid call if set
- On unsubscribe: set `emailUnsubscribedAt`, also add to SendGrid's global suppression list
- Mirroring to the User record avoids a SendGrid API call on every send and makes it queryable

**For unclaimed agents (no User record):**
- Unsubscribe is token-based: the invite email footer link encodes a signed token that identifies the chain link
- On click: mark `ChainLink.inviteUnsubscribedAt` (new field — schema change needed) and add to SendGrid suppression
- Under Model A, this only applies to the invite email — unclaimed agents don't receive subsequent emails, so the surface is small

**Schema changes required:**
- `User.emailUnsubscribedAt DateTime?`
- `ChainLink.inviteUnsubscribedAt DateTime?`

Both are small, nullable, additive migrations. No existing data affected.

### What "transactional" exemption means in practice

Some argue transactional emails (password reset, account-critical notifications) don't require unsubscribe. This is technically true under PECR for certain categories. However:

- Google and Microsoft penalise emails without unsubscribe paths regardless of legal category
- An agent who can't unsubscribe from withdrawal notifications they don't want will mark as spam — worse outcome than losing the notification value
- The goodwill cost of a one-click unsubscribe path is near zero

**Recommendation:** Put unsubscribe on everything. The exception not to is the password reset / account security category — which isn't in scope here.

---

## Section 5 — Escalated to V1.1 / V2

### V1.1 (next arc after V1 ships and deliverability is confirmed)

| Feature | Rationale for deferral |
|---|---|
| **Model C nudge for unclaimed agents** | Needs per-link opt-out tracking + legal basis clarity. Build after V1 reputation is established |
| **Mortgage offer notification to chain-mates** | Lower urgency than exchange/completion. Add once V1 signal quality is validated |
| **Per-type unsubscribe preferences** | Adds meaningful engineering. Justified once you know which email types users actually want to control |
| **Searches received / survey booked** | Low chain-relevance signal. Add if usage data shows demand |
| **Invite expiry reminder** | "Your chain invite expires in 24h" — useful, defensible as transactional, low build cost. Good V1.1 candidate |

### V2 (significant build, needs separate scoping)

| Feature | Why it's a separate arc |
|---|---|
| **Weekly chain health digest** | Requires aggregation pipeline, per-user scheduling, digest template design — separate arc |
| **Morning brief** | Personalised, AI-assisted — separate arc (already noted in deferred features) |
| **Risk / inaction alert** | Needs calibrated thresholds from real data. Can't ship until you have usage data |
| **Response capture (yes/no CTA buttons)** | Requires inbound webhook handling, state machine for response tracking — significant scope |
| **Custom frequency controls** | Immediate / daily digest / weekly — meaningful preference centre, V2 |
| **Benchmark emails** | "3 of 5 agents in your chain have reached mortgage offer" — data aggregation + privacy implications |

---

## Open questions requiring decisions before Stage 1

1. **`support@thesalesprogressor.co.uk` inbox** — does this exist and is it monitored? Needs a yes before Reply-To is confirmed.

2. **Withdrawal email copy approach** — the withdrawal notification has a `withdrawingReason` field (from `fallThroughReason`). Does the V1 email include the reason, or just that a withdrawal occurred? Including reason is more useful but exposes the withdrawing party's stated reason to all chain-mates. Decide on privacy posture.

3. **Exchange milestone slug** — Stage 1 needs to confirm the exact milestone identifier for "Exchange of contracts" from `MILESTONES_SPEC_v1.md` to wire the trigger. Flagging here so it's not forgotten.

4. **Completion detection for celebration email** — "all chain links completed" requires checking chain state post-completion. Is the chain considered complete when all claimed links reach completion, or when all links (including unclaimed stubs) do? Stubs will never have a milestone record. Recommendation: all *claimed* links only, but needs a decision.

5. **`agencyFrom()` behaviour for chain notifications** — the invite email currently sends from the originator's agency name via `agencyFrom()`. Withdrawal notifications, decline notifications, and milestone emails are platform-originated (not from any individual agent). These should use the default `Sales Progressor <updates@thesalesprogressor.co.uk>` sender, not a specific agency. Confirm this is the right approach.

6. **SendGrid unsubscribe group setup** — V1 uses a single "all emails" group in SendGrid (simplest). Stage 2 will need the SendGrid unsubscribe group ID to wire the List-Unsubscribe header. Manual setup required: Ellis creates the group in the SendGrid dashboard before Stage 2 implementation begins.

---

## Summary of recommendations

| Decision | Recommendation |
|---|---|
| V1 email types | Invite (+ compliance additions), withdrawal cascade, decline to originator, exchange notification, completion notification, chain completion celebration |
| Unclaimed recipient policy | Model A — no operational emails beyond the initial invite |
| Sending subdomain | `mail.thesalesprogressor.co.uk` (authenticated) / `updates@thesalesprogressor.co.uk` (From) |
| Reply-To | `support@thesalesprogressor.co.uk` |
| Provider | SendGrid (no change) |
| DMARC launch posture | `p=none` monitoring, escalate to `p=quarantine` after 4 weeks |
| Unsubscribe V1 | Global only (not per-type) — footer link + List-Unsubscribe header on all emails |
| Preference centre | Deferred to V1.1 |
| Schema additions | `User.emailUnsubscribedAt`, `ChainLink.inviteUnsubscribedAt` |
