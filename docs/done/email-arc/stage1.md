# Email Arc — Stage 1: Design

**Status:** Awaiting approval before Stage 2  
**Date:** 2026-05-20  
**Depends on:** Stage 0 approved (see `docs/EMAIL_ARC_STAGE0.md`)  
**Prerequisite for Stage 2:** Ellis completes manual setup items in `docs/ELLIS_MANUAL_TODO.md` (DNS, SendGrid group, UNSUBSCRIBE_SECRET)

---

## 1. Trigger specs per email type

### Email 1 — Invite (compliance retrofit)

**Status:** Live and sending. Needs List-Unsubscribe header + footer link added. No trigger change.

| Property | Value |
|---|---|
| Trigger | `sendChainInvite()` called — no change |
| Recipients | `ChainLink.stubAgentEmail` — the named agent |
| Sender | `{originatorAgency} <updates@thesalesprogressor.co.uk>` via `agencyFrom()` — no change |
| Frequency cap | 1 per link per 24h (existing resend throttle) |

**Suppression checks (in order):**
1. `ChainLink.inviteUnsubscribedAt IS NOT NULL` → skip (new field)
2. Recipient address on SendGrid global suppression → skip (SendGrid handles via API)
3. `inviteStatus = CLAIMED` or `DECLINED` → skip (existing logic)

**Changes needed in Stage 2:**
- Add `asm: { groupId: SENDGRID_UNSUBSCRIBE_GROUP_ID }` to the `sendEmail()` call (SendGrid adds the List-Unsubscribe header automatically)
- Add unsubscribe footer link to both HTML and text versions
- Check `ChainLink.inviteUnsubscribedAt` before sending

---

### Email 2 — Withdrawal cascade

**Status:** Queue built. Email sender not wired.

| Property | Value |
|---|---|
| Trigger | `ChainNotificationQueue` records with `notifiedAt IS NULL` |
| Fire timing | Immediate (see drain architecture in §5) |
| Recipients | All claimed chain-mates — pre-resolved by `notifyChainMatesOfWithdrawal()` into `ChainNotificationQueue.recipientEmail` |
| Sender | `Sales Progressor <updates@thesalesprogressor.co.uk>` (platform-originated — not agency-branded) |
| Frequency cap | Once per withdrawal event per chain — enforced by queue's `@@unique([withdrawingTransactionId, recipientUserId])` |
| Quiet hours | Sends immediately regardless of time. Withdrawal is operationally urgent |

**Suppression checks (in order):**
1. `notifiedAt IS NOT NULL` → already sent, skip (idempotent drain)
2. `User.emailUnsubscribedAt IS NOT NULL` for the recipient → skip; mark `notifiedAt = now()` to prevent future reprocessing
3. Recipient on SendGrid global suppression → skip; mark `notifiedAt = now()`

**Reason field handling (Q2 decision):**
- `withdrawingReason` is a stored enum value or free-text "Other" field
- Stage 2 implementation must: check if the value matches a defined enum list of structured reasons; include only if it does; omit entirely if the stored value is not in the enum list or is null
- The enum list of safe-to-include reasons is defined in Stage 2 by reading the withdrawal reason options in the codebase

---

### Email 3 — Decline notification to originator

**Status:** Not built. Trigger point exists (decline page writes `inviteStatus = DECLINED`).

| Property | Value |
|---|---|
| Trigger | `inviteStatus` updated to `DECLINED` in `app/claim/decline/page.tsx` (the page's Prisma update at line ~172) |
| Fire timing | Immediate — synchronous call in the decline page's server action |
| Recipients | `ChainLink.chain.createdByUserId` — the agent who created the chain |
| Sender | `Sales Progressor <updates@thesalesprogressor.co.uk>` |
| Frequency cap | Once per decline event. Structurally impossible to fire twice — idempotent by the `inviteStatus` transition |
| Quiet hours | Sends immediately regardless of time. Decline is actionable and the agent should know promptly |

**Suppression checks:**
1. `chain.createdBy.email` not available → skip silently
2. Originator (`User.emailUnsubscribedAt IS NOT NULL`) → skip
3. Originator on SendGrid global suppression → skip

---

### Email 4 — Exchange notification to chain-mates

**Status:** Not built. Trigger point to be hooked into milestone completion.

| Property | Value |
|---|---|
| Trigger | VM19 ("Seller has received confirmation that contracts have exchanged") or PM26 ("Buyer has received confirmation that contracts have exchanged") is marked complete on a transaction that has `chainLinkId IS NOT NULL` |
| Fire timing | Queued with quiet-hours scheduling (see §5) |
| Recipients | All other claimed agents in the chain — `chain.links WHERE inviteStatus = CLAIMED AND transactionId IS NOT NULL AND id != completingLink.id` |
| Sender | `Sales Progressor <updates@thesalesprogressor.co.uk>` |
| Frequency cap | Once per chain link, per exchange event. Guard: `OutboundEmailQueue` deduplication on `(emailType, sourceId, recipientUserId)` where `sourceId = chainLinkId` |
| Quiet hours | Yes — schedule for next business-hours window if triggered outside 08:00-19:00 Mon-Fri UK time |

**Why VM19/PM26 and not VM18/PM25:**
VM18/PM25 are "readiness to exchange" — internal confirmation, not the actual exchange event. VM19/PM26 ("received confirmation that contracts have exchanged") is the publicly significant event that chain-mates need to know about.

Both sides fire the same notification: if VM19 is completed first, one email goes out. If PM26 is completed later (bilateral pair), it checks deduplication and doesn't send a second email to the same recipients for the same event.

**Suppression checks:**
1. `User.emailUnsubscribedAt IS NOT NULL` for recipient → skip
2. Global suppression → skip
3. Deduplication guard in `OutboundEmailQueue` → skip if already queued/sent
4. Chain is already broken (`WITHDRAWN` link exists) → still send (agents need to know exchange happened even if chain is partly broken)

---

### Email 5 — Completion notification to chain-mates

**Status:** Not built.

| Property | Value |
|---|---|
| Trigger | VM20 ("sale has completed") or PM27 ("purchase has completed") is marked complete on a transaction with `chainLinkId IS NOT NULL` |
| Fire timing | Queued with quiet-hours scheduling |
| Recipients | All other claimed agents in the chain |
| Sender | `Sales Progressor <updates@thesalesprogressor.co.uk>` |
| Frequency cap | Once per chain link per completion event — same deduplication as Email 4 |
| Quiet hours | Yes |

**Suppression checks:** Same pattern as Email 4.

---

### Email 6 — Chain completion celebration

**Status:** Not built.

| Property | Value |
|---|---|
| Trigger | After Email 5 fires (completion recorded), check if ALL claimed links in the chain now have VM20 or PM27 complete. If yes, and `PropertyChain.celebrationSentAt IS NULL` → queue celebration |
| Fire timing | Queued with quiet-hours scheduling |
| Recipients | All claimed agents in the chain |
| Sender | `Sales Progressor <updates@thesalesprogressor.co.uk>` |
| Frequency cap | Once per chain, ever — enforced by `PropertyChain.celebrationSentAt` |
| Quiet hours | Yes |

**"All claimed links completed" check (Q4 decision):** Stubs that never claimed are excluded. A chain is "complete" when every `chainLink WHERE inviteStatus = CLAIMED AND transactionId IS NOT NULL` has a completion milestone (VM20 or PM27) recorded. Stage 2 implementation queries `MilestoneCompletion` for all such links.

**Suppression checks:**
1. `PropertyChain.celebrationSentAt IS NOT NULL` → already sent, skip
2. Per-recipient: `User.emailUnsubscribedAt IS NOT NULL` → skip that recipient (celebration still sends to others)
3. Global suppression → skip that recipient

---

## 2. Message specs and voice

Voice rules applied across all emails (from `docs/polish-pass/VOICE_GUIDELINES.md`):
- No system self-references
- No schema jargon as user-facing nouns (milestone → step, link → sale, transaction → sale/file)
- Active, present, specific
- No exclamation marks
- No "Oops!", no apologetic language for system states
- Brisk and respectful — one or two sentences per block
- Email register: same brisk rules, marginal warmth permitted at high-emotional-weight moments (completion celebration only)

All emails share a common footer structure — see §2.7.

---

### 2.1 Invite email (compliance retrofit — copy unchanged)

The existing copy passed voice review (M8 Stage 1 PASS). No copy changes in this arc.

**Changes in Stage 2:** Add footer unsubscribe link block only. Body copy is untouched.

**Subject (existing):** `{originatorAgency} has added you to a live chain — {originatorAddress}`

---

### 2.2 Withdrawal cascade

**Subject:** `{withdrawingAddress} has withdrawn from the chain`

- Address-first: recipient scans inbox and immediately identifies which chain
- No "important update" or "urgent" prefix — the content speaks for itself
- 60-character max target: most addresses fit within this

**Body (HTML + text):**

```
{withdrawingAddress} has withdrawn.

[Reason: {enumReason}]      ← only included if reason is a known enum value

Open the chain to update your plans.
```

Notes on the reason line:
- Present only when the withdrawal reason is a defined enum value (Stage 2 validates against the list)
- Never present when reason is null, "Other", or free-text
- No softening: "Reason: Mortgage offer fell through" — factual, useful, not embellished

**CTA button:** "Open chain"  
**CTA URL:** `{NEXTAUTH_URL}/agent/transactions/{recipientTransactionId}` with the chain drawer pre-opened if technically feasible; otherwise the transaction page

**Structural note:** The withdrawal reason enum list must be confirmed against the actual stored values in Stage 2. The `fallThroughReason` field in the codebase uses the withdrawal reason from the transaction status update. Stage 2 reads the enum definition and hard-codes the safe list.

---

### 2.3 Decline notification

**Subject:** `{stubEmail} declined your invite — {stubAddress}`

**Body:**

```
The agent at {stubEmail} declined your invite for {stubAddress}.

Open the chain to update their details and resend, or remove them from the chain.
```

**CTA button:** "Open chain"

Voice notes:
- "declined your invite" not "has declined your chain invite" (M8 voice rule — "chain" is redundant when context is established)
- Sentence 2 gives two actionable paths — important because the agent is deciding between re-inviting or moving on
- No apologetic framing ("unfortunately the agent declined")

---

### 2.4 Exchange notification

**Subject:** `{exchangedAddress} has exchanged — chain update`

**Body:**

```
{exchangedAddress} has exchanged contracts.

Open the chain to see what this means for yours.
```

**CTA button:** "Open chain"

Voice notes:
- "exchanged contracts" not "exchanged" alone — industry-standard phrase, precise
- Second sentence addresses the recipient's actual question: how does this affect my sale?
- No congratulations — this is information, not a celebration

**Fallback if address unavailable:** `A sale in your chain has exchanged contracts.`

---

### 2.5 Completion notification

**Subject:** `{completedAddress} has completed — chain update`

**Body:**

```
{completedAddress} has completed.

Open the chain to see what's next.
```

**CTA button:** "Open chain"

Voice notes: Forward-looking — "what's next" acknowledges that the recipient may be approaching their own completion.

**Fallback:** `A sale in your chain has completed.`

---

### 2.6 Chain completion celebration

**Subject:** `Your chain has completed`

No "—" suffix. This subject stands alone. No urgency framing needed.

**Body:**

```
Every sale in your chain has completed.

It's been a run — here's to the next one.
```

Voice notes:
- One factual statement + one human moment. This is the only email in the set that earns a warm closing line
- "It's been a run" is informal and genuine without tipping into congratulatory
- No CTA button in the body — there is no action needed. Footer still present
- If the agent wants to look back at the chain, they can navigate themselves

**Fallback:** If somehow the chain can't be confirmed fully complete (edge case), don't send rather than send inaccurately.

---

### 2.7 Shared email footer (all types)

Every email — including the invite — must carry this footer block.

**HTML footer:**

```html
<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e8eaf0">
  <p style="margin:0 0 8px;font-size:12px;color:#8b91a3;text-align:center">
    <a href="{unsubscribeUrl}" style="color:#8b91a3;text-decoration:underline">
      Unsubscribe from all Sales Progressor emails
    </a>
  </p>
  <p style="margin:0;font-size:11px;color:#c0c4d0;text-align:center">
    Need help? 
    <a href="mailto:support@thesalesprogressor.co.uk" style="color:#c0c4d0">
      support@thesalesprogressor.co.uk
    </a>
    &nbsp;·&nbsp;
    <a href="https://www.thesalesprogressor.co.uk" style="color:#c0c4d0;text-decoration:none">
      The Sales Progressor
    </a>
  </p>
</div>
```

**Plain text footer:**

```
---
Unsubscribe from all emails: {unsubscribeUrl}
Need help? support@thesalesprogressor.co.uk
```

The `{unsubscribeUrl}` is a signed token URL — see §6.

The invite email already has a support email in its footer. Stage 2 replaces that with this standardised footer block.

---

## 3. Suppression policy

### 3.1 Per-event idempotency (primary guard)

Each email type has a structural deduplication guard that prevents the same event from generating more than one email to the same recipient:

| Email | Idempotency guard |
|---|---|
| Invite | `ChainLink.inviteResendCount` + 24h rate limit |
| Withdrawal | `ChainNotificationQueue.@@unique([withdrawingTransactionId, recipientUserId])` |
| Decline | `inviteStatus` state machine — DECLINED is a terminal state |
| Exchange | `OutboundEmailQueue` deduplication on `(emailType, sourceId, recipientUserId)` |
| Completion | Same as exchange |
| Celebration | `PropertyChain.celebrationSentAt` flag |

This idempotency layer is the primary defence against duplicate sends. It does not depend on rate-limiting or caps.

### 3.2 Cross-event daily cap

**Decision: no blanket daily cap in V1.**

Reasoning: each of the 6 email types fires at most once per unique business event (one withdrawal, one exchange, one completion, etc.). The mathematical worst case — two exchanges and one withdrawal all completing on the same chain on the same day — produces 3 emails to affected agents. That is genuinely informative, not noise. A blanket cap would risk silently dropping a completion notification. Rely on per-event idempotency instead.

Revisit in V1.1 if usage data shows multi-email days are causing complaints.

### 3.3 Quiet hours

**Policy:**
- Withdrawal cascade: sends immediately, 24/7
- Decline notification: sends immediately, 24/7
- Exchange notification: queued; scheduled for next available window
- Completion notification: queued; scheduled for next available window
- Chain completion celebration: queued; scheduled for next available window

**Business hours definition:** Monday–Friday, 08:00–19:00 UK local time (Europe/London, accounting for BST/GMT)

**Scheduling logic:**
```
if current_time is within business_hours:
    scheduledFor = now()
else:
    scheduledFor = next_weekday_08:00_london
```

"Next weekday 08:00" means: if it's Saturday at any time, or Friday after 19:00, the next window is Monday 08:00.

**Implementation note:** UK local time must use `Europe/London` timezone for correct BST/GMT handling year-round. Do not use UTC+1 as a static offset.

### 3.4 Global suppression checks

Before every outbound send (after quiet-hours scheduling):
1. `User.emailUnsubscribedAt IS NOT NULL` → skip
2. SendGrid global suppression list → skip (checked via ASM group setting — SendGrid handles at send time)

For unclaimed recipients (invite only under Model A):
1. `ChainLink.inviteUnsubscribedAt IS NOT NULL` → skip

### 3.5 Bounce handling

The `handleBouncedInvite()` function in `lib/chain/invite.ts` already handles invite bounces: marks `inviteStatus = BOUNCED`, notifies originator.

**Extended bounce policy for V1:**

| Bounce type | Action |
|---|---|
| Hard bounce (invite) | Existing: mark `BOUNCED`, notify originator (already implemented) |
| Hard bounce (operational emails) | Set `User.emailUnsubscribedAt = now()` to auto-suppress all future emails; no notification to originator (operational emails are platform-sent, not agent-to-agent) |
| Soft bounce | No retry in V1 — SendGrid retries soft bounces automatically for 72 hours. If delivery ultimately fails, it becomes a hard bounce and the hard bounce policy applies |

**Recovery path (Q2 addition):** An agent whose email hard-bounced and was auto-suppressed has no self-serve recovery path in V1. They must contact `support@thesalesprogressor.co.uk` to have the suppression lifted. This is acceptable at pre-launch scale. V1.1 can add a "re-enable emails" option in account settings.

**SendGrid webhook:** Hard bounce events arrive via the existing SendGrid event webhook. Stage 2 extends the webhook handler to route hard bounces on non-invite emails to the new suppression logic. The existing `handleBouncedInvite()` continues unchanged for invite bounces.

**Notification to originator on operational bounce:** No in-app notification; no email. The originator cannot act on another agent's bounce. The bouncing agent's `emailUnsubscribedAt` flag simply prevents future sends.

---

## 4. Schema migrations

All additive, non-breaking. Apply to staging first, verify, then production.

### Migration 1 — User email suppression

```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailUnsubscribedAt" TIMESTAMP(3);
```

Prisma schema: `emailUnsubscribedAt DateTime?` on `User`

### Migration 2 — Chain link invite suppression

```sql
ALTER TABLE "ChainLink" ADD COLUMN IF NOT EXISTS "inviteUnsubscribedAt" TIMESTAMP(3);
```

Prisma schema: `inviteUnsubscribedAt DateTime?` on `ChainLink`

### Migration 3 — Outbound email queue (quiet-hours scheduling)

```sql
CREATE TABLE "OutboundEmailQueue" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "emailType"      TEXT NOT NULL,
  "sourceId"       TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "payload"        JSONB NOT NULL,
  "scheduledFor"   TIMESTAMP(3) NOT NULL,
  "sentAt"         TIMESTAMP(3),
  "errorAt"        TIMESTAMP(3),
  "errorMessage"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "OutboundEmailQueue_dedup" ON "OutboundEmailQueue" ("emailType", "sourceId", "recipientUserId");
CREATE INDEX "OutboundEmailQueue_drain" ON "OutboundEmailQueue" ("sentAt", "scheduledFor");
```

Prisma schema:

```prisma
model OutboundEmailQueue {
  id             String    @id @default(cuid())
  emailType      String    // "EXCHANGE" | "COMPLETION" | "CELEBRATION"
  sourceId       String    // chainLinkId (for exchange/completion) or chainId (for celebration)
  recipientEmail String
  recipientUserId String?
  payload        Json      // all data needed to build the email without additional DB queries
  scheduledFor   DateTime
  sentAt         DateTime?
  errorAt        DateTime?
  errorMessage   String?
  createdAt      DateTime  @default(now())

  @@unique([emailType, sourceId, recipientUserId])
  @@index([sentAt, scheduledFor])
}
```

**Why store payload as JSON:** The cron drain runs asynchronously, potentially hours after the triggering event. Serialising all required data at enqueue time means the drain doesn't need to re-query the DB to build the email. If a transaction's address changes in the interim, the email reflects the address at the time the event occurred — which is correct.

### Migration 4 — Chain celebration flag

```sql
ALTER TABLE "PropertyChain" ADD COLUMN IF NOT EXISTS "celebrationSentAt" TIMESTAMP(3);
```

Prisma schema: `celebrationSentAt DateTime?` on `PropertyChain`

### Summary

| Migration | Field added | Purpose |
|---|---|---|
| 1 | `User.emailUnsubscribedAt` | Global opt-out for claimed agents |
| 2 | `ChainLink.inviteUnsubscribedAt` | Invite opt-out for unclaimed stubs |
| 3 | `OutboundEmailQueue` (new table) | Quiet-hours scheduling for milestone/celebration emails |
| 4 | `PropertyChain.celebrationSentAt` | Once-per-chain celebration guard |

---

## 5. Drain job architecture

### Withdrawal — synchronous fire with queue fallback

Withdrawal notifications use a different pattern from milestone/celebration emails: they are operationally urgent and the queue is already built.

**Primary path:** When `notifyChainMatesOfWithdrawal()` is called, extend it to immediately attempt the email sends in the same function, after creating the queue records. If all sends succeed, mark `notifiedAt` on each record immediately.

**Fallback path:** A cron job (hourly) processes any `ChainNotificationQueue` records where `notifiedAt IS NULL`. These are records whose immediate send failed (network error, SendGrid down) or were inserted before the synchronous path was deployed.

This means withdrawal emails are sent within seconds of the event under normal conditions. The queue provides the safety net.

### Milestone / Celebration — async drain via cron

These use `OutboundEmailQueue` with `scheduledFor` timestamps.

**Cron endpoint:** `GET /api/cron/email-drain`  
**Schedule:** Every hour (free Vercel tier; upgrade to every 5 minutes with Vercel Pro)  
**Vercel cron definition:**

```json
{
  "crons": [
    {
      "path": "/api/cron/email-drain",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Drain logic:**

```
SELECT * FROM OutboundEmailQueue
WHERE sentAt IS NULL
  AND errorAt IS NULL
  AND scheduledFor <= now()
LIMIT 50  // process in batches to avoid cron timeout

FOR EACH record:
  1. Check User.emailUnsubscribedAt — skip if set
  2. Build email from record.payload (no extra DB queries)
  3. Call sendEmail() with ASM group ID
  4. On success: UPDATE sentAt = now()
  5. On error: UPDATE errorAt = now(), errorMessage = error.message
     (do not retry in the same run — next cron will pick up errorAt IS NOT NULL records after a cooldown)
```

**Retry policy:** Records with `errorAt IS NOT NULL AND sentAt IS NULL AND errorAt < now() - 1 hour` are eligible for retry. After 3 failed attempts (requires an `attemptCount` field — can add in Stage 2 if needed, or omit for V1 simplicity and just alert on errors).

**Cron authentication:** Vercel cron requests include `Authorization: Bearer {CRON_SECRET}`. The drain endpoint verifies this header. `CRON_SECRET` is an env var.

**Batch size of 50:** Conservative for a 10-second function timeout. Each `sendEmail()` call takes roughly 200–500ms. 50 × 500ms = 25 seconds — fits within Vercel's 30-second function timeout. Adjust in Stage 2 if needed.

---

## 6. Unsubscribe flow

### Token format

HMAC-SHA256 signed token. Format: `{recipientType}:{recipientId}:{timestamp}:{signature}`

Where:
- `recipientType`: `u` (User/claimed) or `l` (ChainLink/unclaimed invite)
- `recipientId`: User ID or ChainLink ID
- `timestamp`: Unix seconds at token creation (tokens don't expire — the recipient should always be able to unsubscribe — but the timestamp allows future expiry enforcement if needed)
- `signature`: HMAC-SHA256(`{recipientType}:{recipientId}:{timestamp}`, `UNSUBSCRIBE_SECRET`), base64url-encoded

Full token: base64url of `{parts joined by :}`. Keep it compact for URL embedding.

**Why HMAC, not JWT:** No library needed beyond Node's built-in `crypto`. No expiry management complexity for unsubscribe tokens. Simpler to audit.

### API / page

**Route:** `GET /api/unsubscribe?t={token}`

This is an API route, not a page. It validates, applies suppression, then redirects to a static confirmation page.

**Flow:**
```
1. Parse token from query param
2. Validate HMAC signature — if invalid, return 400
3. Determine type (u or l)
4. For type u (User):
   a. UPDATE User SET emailUnsubscribedAt = now() WHERE id = recipientId
   b. Call SendGrid Groups API: add email to suppression group
   c. Redirect to /unsubscribed?status=success
5. For type l (ChainLink):
   a. UPDATE ChainLink SET inviteUnsubscribedAt = now() WHERE id = recipientId
   b. Call SendGrid Groups API: add email to suppression group
   c. Redirect to /unsubscribed?status=success
6. On error: redirect to /unsubscribed?status=error
```

**Confirmation page:** `app/unsubscribed/page.tsx` (new, minimal)

Content:
```
You've been unsubscribed.

You won't receive further emails from Sales Progressor.
If this was a mistake, contact support@thesalesprogressor.co.uk.
```

No re-subscribe link in V1. Agent contacts support to re-enable.

### Unsubscribe error state handling

| Case | Response |
|---|---|
| **Invalid / tampered token** (HMAC fails) | Redirect to `/unsubscribed?status=invalid`. Page copy: "This unsubscribe link isn't valid. If you want to stop receiving emails, contact support@thesalesprogressor.co.uk." Do not expose why validation failed. |
| **Already unsubscribed** (`emailUnsubscribedAt` already set, or `inviteUnsubscribedAt` already set) | Redirect to `/unsubscribed?status=success`. Treat as a no-op success — do not show an error. The outcome the user wanted (no more emails) is already true. |
| **Token valid, User no longer exists** | Set no DB field (nothing to set). Call SendGrid suppression API with the email address from the token (stored in the token payload). Redirect to `/unsubscribed?status=success`. The user is gone; suppressing at SendGrid is sufficient and prevents any future sends if the address is somehow re-created. |

These three cases have distinct root causes but only two visible outcomes: `success` (the user gets what they wanted) and `invalid` (they need to contact support). No other states are shown.

---

### Token generation

`sendEmail()` doesn't currently accept a recipient ID. Stage 2 extends it to accept an optional `unsubscribeToken` param and embed it in the footer.

Alternatively, a `generateUnsubscribeToken(recipientType, recipientId)` helper in `lib/email/unsubscribe.ts` (new file) handles signing. Each email-building function calls this helper when constructing the footer.

### SendGrid list-unsubscribe header

SendGrid automatically adds the `List-Unsubscribe` and `List-Unsubscribe-Post` headers when you pass the `asm` field in the send call:

```typescript
await sgMail.send({
  ...existingParams,
  asm: {
    groupId: Number(process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID),
  },
});
```

This is the V1 approach for all emails. The `SENDGRID_UNSUBSCRIBE_GROUP_ID` env var is set by Ellis after creating the group (see `ELLIS_MANUAL_TODO.md`).

---

## 7. Test plan

Development principle: no real addresses should receive emails during development or testing. All test sends go to a sandbox.

### 7.1 SendGrid sandbox mode

`sendEmail()` should check `process.env.EMAIL_SANDBOX_MODE === "true"` and pass `{ mailSettings: { sandboxMode: { enable: true } } }` to the SendGrid call when set. Sandbox mode: SendGrid validates the request and returns 200 but does not deliver the email. Safe for local dev and staging.

**Env var:** `EMAIL_SANDBOX_MODE=true` in `.env` (local) and Vercel staging. False in production.

### 7.2 Per email type — verification matrix

| Email | How to trigger in dev | What to verify |
|---|---|---|
| Invite (retrofit) | Send an invite via chain drawer with sandbox on | List-Unsubscribe header present in SendGrid activity; footer link in email body; correct ASM group ID |
| Withdrawal | Mark a test transaction as `withdrawn` with a chain link that has claimed chain-mates | Queue record created; drain fires; email delivered to sandbox; `notifiedAt` set; reason included/omitted per enum rules |
| Decline | Visit `/claim/decline?token={test_token}` | Originator receives sandbox email; correct subject + body |
| Exchange | Mark VM19 or PM26 complete on a transaction with `chainLinkId` | `OutboundEmailQueue` record created with correct `scheduledFor`; drain processes; email delivered to sandbox |
| Completion | Mark VM20 or PM27 complete | Same as exchange |
| Celebration | Mark completion on the last remaining claimed link in a chain | `PropertyChain.celebrationSentAt` set; celebration email delivered to sandbox; not re-fired on second run |

### 7.3 Suppression tests

| Scenario | Expected behaviour |
|---|---|
| Recipient has `emailUnsubscribedAt` set | Email skipped; `notifiedAt` or `sentAt` set to prevent reprocessing |
| Unsubscribe link clicked | `emailUnsubscribedAt` set; redirect to `/unsubscribed`; subsequent send skipped |
| Hard bounce on operational email | `User.emailUnsubscribedAt` set; no further sends |
| Withdrawal fires twice (bug scenario) | Second `ChainNotificationQueue.createMany` call hits unique constraint; skips silently |
| Exchange milestone completed twice (uncomplete + recomplete) | Second `OutboundEmailQueue` insert hits unique constraint; second email not queued |
| Celebration attempted when only partial completion | Check query returns false; no record created |

### 7.4 Quiet hours tests

| Scenario | Expected behaviour |
|---|---|
| Exchange milestone completed at 14:00 UK weekday | `scheduledFor = now()`; drain processes immediately |
| Exchange milestone completed at 21:00 UK weekday | `scheduledFor = next_day_08:00`; drain skips until then |
| Exchange milestone completed Saturday 15:00 | `scheduledFor = Monday_08:00` |
| Withdrawal occurs at 23:00 | Sends immediately (quiet hours do not apply) |
| BST active (summer) | `scheduledFor` computed in `Europe/London` — 08:00 BST = 07:00 UTC |

### 7.5 Token / unsubscribe tests

| Scenario | Expected behaviour |
|---|---|
| Valid token, User | `emailUnsubscribedAt` set; redirect to `/unsubscribed?status=success` |
| Valid token, ChainLink | `inviteUnsubscribedAt` set; redirect to `/unsubscribed?status=success` |
| Tampered token | 400 response or redirect to `/unsubscribed?status=error` |
| Token for deleted User | No-op; redirect to `/unsubscribed?status=success` (idempotent — if the user is gone, they're already suppressed) |
| Double unsubscribe | Idempotent — second click succeeds silently |

---

## 8. Observability

### 8.1 Audit trail (no new schema required)

Both queue tables persist records after send. They constitute a complete send log:

- `ChainNotificationQueue`: withdrawal emails. `notifiedAt` is the send timestamp.
- `OutboundEmailQueue`: exchange, completion, celebration emails. `sentAt` is the send timestamp.

Neither table should be purged after send. They are the audit trail.

### 8.2 Structured console logging

Every successful send writes a structured log line:

```
[EMAIL_SENT] type={emailType} recipient={recipientEmail} chain={chainId} at={iso8601}
```

Every skipped send (suppression) writes:

```
[EMAIL_SKIP] type={emailType} recipient={recipientEmail} reason={UNSUBSCRIBED|SUPPRESSED|DUPLICATE} at={iso8601}
```

This is immediately queryable via Vercel Log Drains or the Vercel dashboard's log tail. No additional tooling required at V1 scale.

### 8.3 Command Centre frequency view (minimal)

A read-only query page in `/command` (exact path determined in Stage 2) that shows:

- Emails sent in the last 30 days
- Grouped by recipient email and email type
- Sorted by total count descending (surfaces unexpectedly high-frequency recipients at a glance)
- Filterable by date range and email type

Implementation: a single Server Component with a Prisma raw query or aggregate across both queue tables. No new schema. Estimated 30–40 lines of implementation code.

This page allows post-launch monitoring without manual SQL. If an agent received 7 emails in a day, it shows up as the top row.

---

## 9. Open questions for Stage 2 sign-off

1. **Withdrawal reason enum list** — Stage 2 must read the actual stored values for `fallThroughReason` in the codebase (the withdrawal reason picker) and hard-code the safe-to-include list. The implementation cannot infer this from Stage 1; it requires reading `lib/services/transactions.ts` or wherever withdrawal reasons are defined.

2. **Transaction page deep-link** — the "Open chain" CTA in most emails links to the recipient's transaction page. For it to pre-open the chain drawer, the URL would need a `?openChain=1` param and a client-side effect. Decision needed: simple transaction-page link (no auto-open) or deep-link with chain drawer open. Simple is recommended for V1; flag for V1.1.

3. **`ChainNotificationQueue` drain — synchronous vs cron** — Stage 1 recommends the synchronous-primary / cron-fallback pattern. If there are concerns about adding synchronous email sends to the withdrawal recording path (e.g. latency), the pure-cron approach is acceptable — but this extends withdrawal notification delay to up to 1 hour on free Vercel tier. Decision needed before Stage 2 implements the drain.

4. **Vercel Pro for 5-minute cron** — on free Vercel, the email drain runs hourly. Upgrade to Vercel Pro ($20/mo, already noted in ELLIS_MANUAL_TODO.md) enables 5-minute granularity. For milestone/celebration emails with quiet hours, hourly is acceptable. For withdrawal fallback, it matters more. Ellis decides timing of upgrade separately.

5. **`EMAIL_SANDBOX_MODE` on staging** — staging should have sandbox mode enabled so staging-triggered events don't accidentally email real agents. Confirm this is acceptable and that real-send testing will happen against a dedicated test chain with Ellis's own email only.

6. **Bounce webhook routing** — the existing SendGrid bounce webhook handler processes invite bounces via `handleBouncedInvite()`. Stage 2 needs to extend it to route hard bounces on operational emails (identified by email address matching a User record). The current webhook URL is at `/api/webhooks/...` — Stage 2 reads this file to understand the current structure before extending.
