# Push notification strings — for voice review

Every push notification the app fires today, with the exact `title` and `body` strings. Voice these against the rest of the product copy and flag any that read off — I'll update the source files in a follow-up.

**Convention so far:**
- `title` is short, fits a phone lock-screen line. Often "Verb: subject" or "Subject confirmed: thing"
- `body` is one short line of context — typically the property address (first line only, no postcode) or a name + short preview
- All strings are interpolated server-side from real data; the templates below show placeholders in `{braces}`

**Audience:** Every push goes to ONE recipient — either a portal contact (buyer/seller) or an agent (the file owner = `assignedUser ?? agentUser`). Marked per row.

---

## Agent-facing pushes

### 1. Chase escalated (manual or auto)

| Field | Value |
|---|---|
| Source | [app/actions/tasks.ts](app/actions/tasks.ts) (manual click) + [lib/services/reminders.ts](lib/services/reminders.ts) (2 auto-escalation sites via `pushChaseEscalation` helper) |
| Recipient | File owner (assignedUser ?? agentUser) |
| Toggle | `chaseEscalation` (default **ON**) |
| Title | `Escalated: {milestone name}` &nbsp; · &nbsp; fallback `Chase escalated` if milestone name unknown |
| Body | `{first line of property address}` |
| Example title | `Escalated: Buyer has booked their survey` |
| Example body | `73 Jutland House` |

### 2. File assigned to me

| Field | Value |
|---|---|
| Source | [app/actions/transactions.ts](app/actions/transactions.ts) `assignUserAction` |
| Recipient | New assignee (skipped on reassignment to same user, skipped on unassign) |
| Toggle | `fileAssigned` (default **ON**) |
| Title | `New file assigned to you` |
| Body | `{first line of property address}` |
| Example title | `New file assigned to you` |
| Example body | `40 Tresco Road` |

### 3. Exchange ≤7 days

| Field | Value |
|---|---|
| Source | [lib/services/morning-digest.ts](lib/services/morning-digest.ts) `fireExchangeApproachingPushes` (fires from the daily morning-digest cron, deduped via Notification row) |
| Recipient | File owner |
| Toggle | `exchangeApproaching` (default **ON**) |
| Title | `Exchange approaching` |
| Body | varies by days remaining: `{address} — exchange target is today` &nbsp; / &nbsp; `{address} — exchange target is tomorrow` &nbsp; / &nbsp; `{address} — exchange target in {N} days` |
| Example title | `Exchange approaching` |
| Example body | `73 Jutland House — exchange target in 5 days` |

### 4. Chain — buyer fell through

| Field | Value |
|---|---|
| Source | [lib/email/chainNotifications.ts](lib/email/chainNotifications.ts) `fireChainCascadeNotifications` (kind=LOST_BUYER) |
| Recipient | Chain link's recipientUserId |
| Toggle | `chainEvent` (default **ON**) |
| Title | `Chain update: buyer fell through` |
| Body | `{first line of property address}` |
| Example title | `Chain update: buyer fell through` |
| Example body | `40 Tresco Road` |

### 5. Chain — purchase fell through

| Field | Value |
|---|---|
| Source | same as above (kind=LOST_PURCHASE) |
| Recipient | Chain link's recipientUserId |
| Toggle | `chainEvent` (default **ON**) |
| Title | `Chain update: purchase fell through` |
| Body | `{first line of property address}` |

### 6. Chain — asked to wait

| Field | Value |
|---|---|
| Source | same as above (kind=ASKED_TO_WAIT) |
| Recipient | Chain link's recipientUserId |
| Toggle | `chainEvent` (default **ON**) |
| Title | `Chain update: asked to wait` |
| Body | `{first line of property address}` |

### 7. Chain — still waiting (nudge)

| Field | Value |
|---|---|
| Source | [lib/email/chainNotifications.ts](lib/email/chainNotifications.ts) `sendChainWaitNudges` |
| Recipient | Chain link's recipientUserId |
| Toggle | `chainEvent` (default **ON**) |
| Title | `Still waiting — chain update needed` |
| Body | `{first line of property address}` |

### 8. Chain — invite declined

| Field | Value |
|---|---|
| Source | [lib/email/chainNotifications.ts](lib/email/chainNotifications.ts) `fireDeclineNotification` |
| Recipient | Chain originator |
| Toggle | `chainEvent` (default **ON**) |
| Title | `Chain invite declined` |
| Body | `{stub address}` (the declined link's property) |

### 9. Client confirmed a milestone

| Field | Value |
|---|---|
| Source | [lib/services/portal.ts](lib/services/portal.ts) `logPortalMilestoneConfirm` |
| Recipient | File owner |
| Toggle | `clientConfirmation` (default **OFF** — opt-in due to volume) |
| Title | `{contact name} confirmed: {milestone label}` |
| Body | `{first line of property address}` |
| Example title | `Mrs Hartley confirmed: Survey complete` |
| Example body | `73 Jutland House` |

### 10. Client replied on Respond page

| Field | Value |
|---|---|
| Source | [lib/services/portal-messages.ts](lib/services/portal-messages.ts) `sendClientPortalMessage` |
| Recipient | File owner |
| Toggle | `clientChaseNote` (default **ON** — pre-existing behaviour preserved) |
| Title | `{contact name} replied` |
| Body | `{message content, truncated to 80 chars with ellipsis}` |
| Example title | `Mrs Hartley replied` |
| Example body | `Solicitor's away til Monday — I'll chase them then` |

---

## Client-facing pushes (buyers + sellers via portal subscriptions)

Different recipient model (`pushToContact` writes to `portalPushSubscription`). Not gated by agent toggles. Included for completeness — voice these too.

### A. Agent/SP confirmed a milestone — client recipient sees the milestone they confirmed

| Field | Value |
|---|---|
| Source | [app/actions/milestones.ts:170](app/actions/milestones.ts#L170) `confirmMilestoneAction` |
| Recipient | All portal contacts on the file (via `pushToTransaction`) |
| Title | `Update on {property short name}` (generic), OR specific titles for big events |
| Body | varies by milestone — see source for milestone-specific copy |
| Example exchange title | `Exchanged!` |
| Example exchange body | `73 Jutland House — your transaction is now legally committed.` |
| Example completion title | `Completed!` |
| Example completion body | `73 Jutland House — congratulations, your transaction has completed.` |
| Example ready-to-exchange title | `Ready to exchange` |
| Example ready-to-exchange body | `73 Jutland House — your solicitor has confirmed everything is in place.` |
| Example date-confirmed title | `Date confirmed — {property short name}` |
| Example date-confirmed body | `{milestone label}: {formatted date}` |

### B. Client-visible comm logged — clients see new update on their file

| Field | Value |
|---|---|
| Source | [lib/services/comms.ts:210](lib/services/comms.ts#L210) `createCommunicationRecord` (only when `visibleToClient: true`) |
| Recipient | All portal contacts on the file |
| Title | `Update on {property short name}` |
| Body | `{comm content, truncated to 100 chars with ellipsis}` |
| Example title | `Update on 73 Jutland House` |
| Example body | `Spoke to your solicitor today — they confirmed they're ready for exchange next week...` |

### C. Client confirmed milestone — push to the OTHER side's clients

| Field | Value |
|---|---|
| Source | [lib/services/portal.ts:703-714](lib/services/portal.ts#L703-L714) `logPortalMilestoneConfirm` |
| Recipient(s) | Buyer/seller contacts OTHER than the confirming contact |
| Confirming-contact title (themselves) | `{specific based on milestone}` e.g. `Exchanged!` / `Date confirmed — {short}` |
| Confirming-contact body | `{specific based on milestone}` |
| Other-side title | same as confirming title |
| Other-side body | same as confirming body |

### D. Agent → Client portal reply

| Field | Value |
|---|---|
| Source | [lib/services/portal-messages.ts:176](lib/services/portal-messages.ts#L176) `sendProgressorPortalReply` |
| Recipient | The client the reply is addressed to |
| Title | `Message from {progressor name}` |
| Body | `{message content, truncated to 80 chars with ellipsis}` |
| Example title | `Message from Tom` |
| Example body | `Hi Mrs Hartley — your solicitor confirmed they're chasing the management pack today.` |

---

## What to look for when reviewing

- **Consistency of verb tense.** "Confirmed" vs "Has confirmed" vs "Just confirmed" — pick one.
- **Voice match with the rest of the product.** Sales Progressor copy tends to be warm + direct ("Your transaction is now legally committed") not formal/corporate ("The transaction has reached legally binding status").
- **Body redundancy.** Some bodies just repeat the title with the address tacked on. That's OK if the title alone is too short for the lock screen, but sometimes a more useful body (next step, sender name) would help.
- **Address truncation.** Body always uses `propertyAddress.split(",")[0]` — first line only. Check this reads correctly for short / long addresses.
- **Phone vibration matters.** Pushes interrupt. Title should make scan-while-driving sense — "Mrs Hartley confirmed: Survey complete" passes; "Update" alone fails.
- **Anything actively missing.** Is there a string you'd voice differently to make the agent actually act on it (e.g. "Solicitor went silent — chase now" vs "Chase escalated")?

Mark up this file in place — I'll pull the new strings into the source files in a follow-up commit.
