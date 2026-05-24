# Push notification strings — complete inventory for voice review

Every push the app fires today, enumerated by call site and by branch. **One row per distinct rendered string.** Numbers in brackets at the end of each row link to the call site.

**Method.** Grep'd `pushToUser` / `pushToContact` / `pushToTransaction` across the entire codebase. Found **14 distinct call sites**. Each site may produce multiple rendered strings depending on which conditional branch fires (e.g. "exchange-approaching" picks today / tomorrow / N-days). **Total: 39 distinct rendered strings** across the 14 sites.

**Conventions.**
- `{short}` = `propertyAddress.split(",")[0]` — first line of the address only
- `{label}` = `getMilestoneCopy(code).label` — per-milestone label, lookup in [lib/portal-copy.ts](lib/portal-copy.ts); reads differently for each of the ~45 milestone codes
- `{milestoneLabel}` = `MilestoneDefinition.name` from the DB — verbose system name (vs `label` which is the friendlier portal copy)
- `{contact name}` = `Contact.name`, `{progressor name}` = `User.name`, etc.
- All other braces are interpolated from data at fire time

**Sources:** ✱✱✱ = client-facing (buyer/seller via portal subscription) · ✦✦✦ = agent-facing (file owner / assignee via agent subscription)

---

## ✦✦✦ Agent-facing (14 distinct strings across 7 call sites)

### Site 1 — Phase A: client confirmed a milestone via portal
`pushToUser` in `lib/services/portal.ts:525`, gated on `push.clientConfirmation` (default OFF)

| Branch | Title | Body |
|---|---|---|
| Always (1 branch) | `{contact name} confirmed: {milestoneLabel}` | `{short}` |
| **Example** | `Mrs Hartley confirmed: Buyer has booked their survey` | `73 Jutland House` |

### Site 2 — Phase A: client left a chase-note on Respond page
`pushToUser` in `lib/services/portal-messages.ts:108`, gated on `push.clientChaseNote` (default ON)

| Branch | Title | Body |
|---|---|---|
| Always (1 branch) | `{contact name} replied` | `{message content, truncated to 80 chars + "…" if longer}` |
| **Example** | `Mrs Hartley replied` | `Solicitor's away til Monday — I'll chase them then` |

### Site 3 — Phase A: chase task escalated
`pushChaseEscalation` helper in `lib/agent/push-events.ts:68`, called from 3 call sites:
- `app/actions/tasks.ts` (manual escalate button)
- `lib/services/reminders.ts:374` (auto, in cron `evaluateTransactionReminders`)
- `lib/services/reminders.ts:585` (auto, in `advanceChaseTask` action)

Gated on `push.chaseEscalation` (default ON)

| Branch | Title | Body |
|---|---|---|
| milestone label known (typical) | `Escalated: {milestone name w/o "Chase:" prefix}` | `{short}` |
| milestone label null (rare fallback) | `Chase escalated` | `{short}` |
| **Example (typical)** | `Escalated: Buyer has booked their survey` | `73 Jutland House` |

### Site 4 — Phase A: file assigned to user
`pushFileAssigned` helper in `lib/agent/push-events.ts:92`, called from `app/actions/transactions.ts` (`assignUserAction`)

Gated on `push.fileAssigned` (default ON)

| Branch | Title | Body |
|---|---|---|
| Always (1 branch) | `New file assigned to you` | `{short}` |
| **Example** | `New file assigned to you` | `40 Tresco Road` |

⚠ **Note:** the `assignerName` is passed in but currently unused in the push payload. The string doesn't say WHO assigned it. Worth voicing — `New file assigned to you by Tom` vs current.

### Site 5 — Phase A: exchange target ≤7 days
`pushExchangeApproaching` helper in `lib/agent/push-events.ts:113-117`, called from `lib/services/morning-digest.ts` (cron, dedup via Notification row)

Gated on `push.exchangeApproaching` (default ON)

| Branch | Title | Body |
|---|---|---|
| daysUntil ≤ 0 | `Exchange approaching` | `{short} — exchange target is today` |
| daysUntil === 1 | `Exchange approaching` | `{short} — exchange target is tomorrow` |
| daysUntil ≥ 2 | `Exchange approaching` | `{short} — exchange target in {N} days` |

### Site 6 — Phase A: chain events
`pushChainEvent` helper in `lib/agent/push-events.ts:140-146`, called from 3 sites in `lib/email/chainNotifications.ts`:
- `fireChainCascadeNotifications` (3 kinds: LOST_BUYER / LOST_PURCHASE / ASKED_TO_WAIT)
- `sendChainWaitNudges` (WAIT_NUDGE)
- `fireDeclineNotification` (DECLINE)

Gated on `push.chainEvent` (default ON)

| Branch (kind) | Title | Body |
|---|---|---|
| LOST_BUYER | `Chain update: buyer fell through` | `{short}` (first line of recipient's property address) |
| LOST_PURCHASE | `Chain update: purchase fell through` | `{short}` |
| ASKED_TO_WAIT | `Chain update: asked to wait` | `{short}` |
| WAIT_NUDGE | `Still waiting — chain update needed` | `{short}` |
| DECLINE | `Chain invite declined` | `{short}` (the stub-link's property address) |

### Site 7 — Phase B: test push (diagnostic)
`pushToUser` in `app/actions/agent-preferences.ts:247-251`, fired from "Send test push" button in `/agent/settings`. **Bypasses all toggles.**

| Branch | Title | Body |
|---|---|---|
| Always (1 branch) | `Sales Progressor — test push` | `If you see this, push is working.` |

---

## ✱✱✱ Client-facing (25 distinct strings across 7 call sites)

### Site 8 — Agent/SP confirmed a milestone (regular flow)
`pushToTransaction` in `app/actions/milestones.ts:170` (function: `confirmMilestoneAction`). Sends to **all portal contacts on the file** (any with a `portalToken`).

5 branches, ordered by precedence in the if/else chain:

| Branch (milestone code) | Title | Body |
|---|---|---|
| VM19 or PM26 (exchange) | `Contracts exchanged!` | `{short} — your transaction is now legally committed.` |
| VM20 or PM27 (completion) | `Completed!` | `{short} — congratulations, your transaction has completed.` |
| VM18 or PM25 (ready-to-exchange gate) | `Ready to exchange` | `{short} — your solicitor has confirmed everything is in place.` |
| Any other code WITH `eventDate` passed | `Date confirmed — {short}` | `{label}: {date "5 May"}` |
| Any other code WITHOUT `eventDate` (fallback) | `Progress update` | `{short} — "{label}" is complete.` |

The `{label}` field pulls from `getMilestoneCopy(code).label` — different for each of ~45 milestone codes. So the last two branches each produce ~45 distinct rendered strings depending on which milestone was confirmed. Examples:

| Confirmed code | Rendered fallback title | Rendered fallback body |
|---|---|---|
| VM1 (Vendor confirmed sale) | `Progress update` | `73 Jutland House — "Your file is open" is complete.` |
| VM4 (Memorandum of sale issued) | `Progress update` | `73 Jutland House — "Memorandum of sale issued" is complete.` |
| PM5 (Mortgage application submitted) | `Progress update` | `73 Jutland House — "Mortgage application submitted" is complete.` |
| PM24 (Deposit transferred) | `Progress update` | `73 Jutland House — "Deposit transferred" is complete.` |

Full label list lives in `lib/portal-copy.ts` keyed by code. I haven't expanded the full ~45 here — flag if you want each one tabulated.

### Site 9 — Agent/SP confirmed via exchange reconciliation wizard
`pushToTransaction` in `app/actions/milestones.ts:638` (function: `confirmExchangeReconciliationAction`). Sends to **all portal contacts on the file**.

This is the "bulk-tick at exchange time" flow. **Subset of Site 8 — only 3 branches** (no ready-to-exchange branch, no date-confirmed branch):

| Branch | Title | Body |
|---|---|---|
| VM19 or PM26 (exchange) | `Contracts exchanged!` | `{short} — your transaction is now legally committed.` |
| VM20 or PM27 (completion) | `Completed!` | `{short} — congratulations, your transaction has completed.` |
| Any other code (fallback) | `Progress update` | `{short} — "{label}" is complete.` |

### Site 10 — Client-visible comm logged
`pushToTransaction` in `lib/services/comms.ts:210`, fired when `createCommunicationRecord` is called with `visibleToClient: true`. Sends to **all portal contacts on the file**.

| Branch | Title | Body |
|---|---|---|
| Always (1 branch) | `Update on {short}` | `{comm content, truncated to 100 chars + "…" if longer}` |
| **Example** | `Update on 73 Jutland House` | `Spoke to your solicitor today — they confirmed they're ready for exchange next week…` |

### Site 11 — Client confirmed a milestone via portal (echo to other contacts)
`pushToTransaction` in `lib/services/portal.ts:400` (function: `portalCompleteMilestone`). Sends to **all portal contacts on the file** — INCLUDING the contact who just confirmed.

**Same 5-branch structure as Site 8:**

| Branch (milestone code) | Title | Body |
|---|---|---|
| VM19 or PM26 | `Contracts exchanged!` | `{short} — your transaction is now legally committed.` |
| VM20 or PM27 | `Completed!` | `{short} — congratulations, your transaction has completed.` |
| VM18 or PM25 | `Ready to exchange` | `{short} — your solicitor has confirmed everything is in place.` |
| Any other code WITH `eventDate` | `Date confirmed — {short}` | `{label}: {date "5 May"}` |
| Any other code WITHOUT `eventDate` (fallback) | `Progress update` | `{short} — "{label}" is complete.` |

### Site 12 — Client confirmed via portal, push to CONFIRMING contact specifically
`pushToContact` in `lib/services/portal.ts:712` (function: `logPortalMilestoneConfirm`). Sends to the **single contact who just confirmed**.

**5 branches — different copy from the "other contacts" version (Site 13).** Notable: exchange/completion bodies start with `Congratulations` and address the contact directly; the default branch is friendlier (`Step confirmed` + "your sale is progressing").

| Branch (milestone code) | Title | Body |
|---|---|---|
| VM19 or PM26 (exchange) | `Contracts exchanged!` | `Congratulations — your transaction at {short} is now legally committed.` |
| VM20 or PM27 (completion) | `Completed!` | `Congratulations — your transaction at {short} has completed.` |
| VM18 or PM25 (ready-to-exchange) | `Ready to exchange` | `{short} — your solicitor has confirmed everything is in place.` |
| Any other code WITH `eventDate` | `Date confirmed — {short}` | `{milestoneLabel}: {date "5 May"}` |
| Any other code WITHOUT `eventDate` (fallback) | `Step confirmed` | `Your {sale OR purchase} is progressing — a step has been recorded.` |

⚠ Note the `{sale OR purchase}` branch — picks based on `confirmingRole === "vendor"`. Effectively 2 sub-variants of the last row.

### Site 13 — Client confirmed via portal, push to OTHER contacts on the file
`pushToContact` in `lib/services/portal.ts:723` (in a loop over `tx.contacts.filter(c => c.id !== contactId && (vendor|purchaser))`)

**5 branches — slightly different from Site 12** (the exchange/completion strings are IDENTICAL between Sites 12 and 13; the rest differ):

| Branch (milestone code) | Title | Body |
|---|---|---|
| VM19 or PM26 (exchange) | `Contracts exchanged!` | `Congratulations — your transaction at {short} is now legally committed.` |
| VM20 or PM27 (completion) | `Completed!` | `Congratulations — your transaction at {short} has completed.` |
| VM18 or PM25 (ready-to-exchange) | `Ready to exchange` | `{short} — your solicitor has confirmed everything is in place.` |
| Any other code WITH `eventDate` | `Date confirmed — {short}` | `{milestoneLabel}: {date "5 May"}` |
| Any other code WITHOUT `eventDate` (fallback) | `Progress update` | `Your transaction is moving forward. Log in to see the latest.` |

⚠ **Voice mismatch worth flagging:** when a confirming-side client triggers a non-flagship milestone, they personally get `Step confirmed` / "your sale/purchase is progressing" while the other-side clients get `Progress update` / "your transaction is moving forward". Different verbs, different framing — feels deliberate (confirmer gets personal validation; observer gets situation update) but worth double-checking against your voice direction.

### Site 14 — Agent/SP sent portal message to a client
`pushToContact` in `lib/services/portal-messages.ts:182` (function: `sendProgressorPortalReply`). Sends to the **single contact the message is addressed to**.

| Branch | Title | Body |
|---|---|---|
| Always (1 branch) | `Message from {progressor name}` | `{message content, truncated to 80 chars + "…" if longer}` |
| **Example** | `Message from Tom` | `Hi Mrs Hartley — your solicitor confirmed they're chasing the management pack today.` |

---

## Completeness check

- **14 call sites grep'd:** 10 direct (`pushToUser` / `pushToContact` / `pushToTransaction`) + 4 indirect via the `push-events.ts` wrappers (each wraps `pushToUser` internally). All represented above.
- **39 distinct rendered strings** (counting each branch within each site, treating the "Any other code" fallback as ONE row even though it expands to ~45 milestone-label variants).
- **All branches enumerated:** every `if / else if / else` inside each push call has its own row.

If you want me to expand the "Any other code" fallback rows into all ~45 milestone-label variants (so you can voice each per-milestone string individually), I can pull the full `getMilestoneCopy` label map and tabulate. Otherwise the templates + the four examples per row cover the voice review.

---

## Strings I'd voice differently in passing

These read off to me. Not edits — just flags as I went through. Defer or accept your call.

1. **Site 4 (`New file assigned to you`)** — currently doesn't say WHO assigned it. The `assignerName` is captured into `pushFileAssigned({ assignerName })` but never used in the payload. Suggest body: `Assigned by {assignerName} · {short}` or title: `{assignerName} assigned a file to you`.

2. **Site 6 chain events** — all five use the same body (`{short}`) but titles vary. "Still waiting — chain update needed" reads differently from the others (it's a verb-led nag rather than `Chain update: X`). Either bring it in line (`Chain update: still waiting`) or accept the deliberate intensity bump for nudges.

3. **Sites 8 / 9 / 11 default body** (`{short} — "{label}" is complete.`) — quotation marks around a milestone label that already reads as a sentence (e.g. `"Buyer has booked their survey" is complete`) sounds awkward. Consider `{label} — {short}` or `{label} on {short}` without quotes.

4. **Site 12 vs 13 default branches** — same event, different bodies for confirming-contact vs other-contacts. Could be intentional (see callout above) but the asymmetry surfaces only in tests. Worth a deliberate decision: "yes keep distinct" or "unify".

5. **Site 7 test push** — works but the "Sales Progressor — " prefix is unique among all 39 strings (no other push prefixes the brand). Either remove for consistency (`Test push` / `If you see this, push is working.`) or accept it as a one-off diagnostic exception.

6. **Site 10 (`Update on {short}`)** — the title reads vague when stripped of context. If the comm is, say, an inbound email logged as visible, the push body shows the email content but the title doesn't hint at *what kind* of update. Possible: `New update — {short}` to signal "something happened" more clearly.

7. **Exchange/completion variants between sites 8, 9, 11 and sites 12, 13** — Sites 8/9/11 (agent-confirmation flow) use `{short} — your transaction is now legally committed.` while Sites 12/13 (client-confirmation flow) use `Congratulations — your transaction at {short} is now legally committed.`. The `Congratulations` prefix feels right for the client-self-confirm case but disappears from the agent-flow case. Easy to unify either direction.

Mark up in place — I'll pull approved edits into the source files in a follow-up.
