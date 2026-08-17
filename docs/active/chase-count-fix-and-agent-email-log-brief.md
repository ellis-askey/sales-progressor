# Brief: chase-count inflation fix + Command Centre agent-email log

Written 2026-08-17 for handoff to an implementing session. Founder-approved plan
from the 2026-08-17 investigation (Siobhan Becker / Walnut Tree Barn). Read
CLAUDE.md first as usual; migrations staging-first (Law 3); one concern per PR
(Law 5); no em dashes in user-facing strings (Law 21).

---

## Context: what happened

Siobhan Becker (negotiator, Akeman Residential, one OUTSOURCED file:
Walnut Tree Barn, tx `cmsry176n0002t8grnccl291x`) received the agent weekly
brief on Mon 2026-08-17 08:10 UK, subject "1 file need attention this week",
flagging "1 escalated chase" on her file. Nothing on the file was genuinely
escalated. Verified via SendGrid activity API + prod DB.

## Root cause (verified in prod)

`enqueueClientChaseDigest` (lib/email/client-chase-digest.ts, ~line 525) runs
ONCE PER CONTACT. At its tail it calls `applyChaseToTask(task.id)`
(lib/services/reminders.ts ~line 1036) for every pending ChaseTask matching the
digest's milestone codes. With 3 seller contacts on one file, ONE morning chase
round applies the chase to the SAME task 3 times. Effects, each per round:

1. `ChaseTask.chaseCount` +3 instead of +1 (Walnut Tree Barn showed
   "Chased 6x" after 2 real rounds x 3 seller contacts).
2. `ReminderLog.nextDueDate` advanced 3x COMPOUNDING (each apply adds
   repeatEveryDays on top of the previous apply, base = max(today, currentDue)).
   Seller MOS next-chase landed 27 Aug instead of ~19-20 Aug, i.e. the seller
   is now UNDER-chased.
3. Escalation (threshold on chaseCount) trips ~3x early -> phantom "escalated"
   tasks -> fed the weekly brief's "needs attention" count -> false alarm email
   to the agency.

Per-CONTACT chase records (`ClientChaseState.chaseCount`) were always correct
(2 per contact, cadence fine). Only the task-level aggregation is wrong.

Manual paths also call the same helpers but should KEEP counting per action:
- "Chased" button -> advanceChaseTaskAction (app/actions/tasks.ts ~180,
  increments itself, not applyChaseToTask) - do not change.
- Logging a manual comm -> lib/services/comms.ts ~508 calls applyChaseToTask -
  leave semantics as-is unless trivially safe.

## Part A - the fix (approved)

In the automated digest path ONLY (client-chase-digest.ts ~line 525-540):
filter the `pendingTasks` query to tasks NOT already chased today (UK day), e.g.
`lastChasedAt` null OR before start of today Europe/London (see setUkChaseTime
in lib/services/reminders.ts for the UK-day convention). Result: one apply per
task per day regardless of recipient count. Do NOT change applyChaseToTask
itself (manual comm path shares it).

Add a unit test: 3 contacts, 1 task -> one drain -> chaseCount +1, nextDue
advanced once. (No test file exists for client-chase-digest; jest is
configured, see lib/email/__tests__/ for conventions.)

### Part A2 - one-shot data correction (approved)

Platform-wide, every multi-contact file has inflated `ChaseTask.chaseCount` and
over-advanced `ReminderLog.nextDueDate`. Correction for PENDING tasks whose
rule targets a code with ClientChaseState rows on the same tx:

- true rounds = MAX(ClientChaseState.chaseCount) across that tx's contacts for
  the target milestone code (per-contact records are trustworthy).
- set task.chaseCount = true rounds (only where current > true rounds).
- set ReminderLog.nextDueDate = setUkChaseTime(lastChasedAt + repeatEveryDays)
  where the stored nextDueDate is later than that (pull back, never push out).
- do NOT touch priority (current escalated flags may be legitimate; see below).

One-shot script under scripts/ with a SCRIPTS_REGISTRY.md entry + deletion
criteria (Law 15). Run staging first, verify Walnut Tree Barn (task
cmsry1eq30032t8grytbbodas: count 6 -> 2, nextDue 27 Aug -> ~19 Aug), then prod.
Needs engine-equipped prisma client (plain `npx prisma generate`, NOT
--no-engine).

### Important nuance - escalation may still happen legitimately

CLIENT_CHASE_COUNT_CAP = 2: after 2 unanswered chases per contact the design
HANDS the chase to a human (escalation pass, findEscalationCandidates in
lib/services/client-chase-cron.ts). Walnut Tree Barn's sellers are at 2/2 with
no engagement, so a REAL escalation may fire once the second window closes.
That is correct behaviour and will honestly mark the file at-risk internally.
The fix only removes the PREMATURE escalations caused by count inflation.

## "At risk" pill on the internal dashboard (founder asked)

The risk level is COMPUTED LIVE on render (lib/services/risk.ts - triggers
include escalatedTaskCount, overdue tasks, pace, activity gaps). There is no
stored risk column, so nothing extra to migrate: once Part A + A2 land, phantom
escalations stop feeding it and the pill recomputes honestly. If it still says
At risk afterwards, it is telling the truth for another reason (e.g. the
legitimate 2-chases-no-response escalation above, or overdue tasks).

## Part B - weekly brief on outsourced files (approved direction, confirm copy)

lib/services/agent-weekly-brief.ts sends to ALL directors+negotiators, includes
outsourced files, and surfaces internal chase-ops state ("N escalated chases")
to agencies. Founder rule: on OUTSOURCED files agencies get client-visible
progress only.

- Where tx.serviceType = "outsourced": exclude escalated-chase counts (and the
  "no activity in Nd" internal signal) from needsAttention; keep
  approaching-exchange + on-track sections.
- Self-managed files unchanged.
- Fix subject grammar: "1 file needs attention" (currently "1 file need").
- Law 21 voice pass on any copy touched.

## Part C - Command Centre agent-email log (approved)

Today, emails to CLIENTS are queued/logged (OutboundEmailQueue + file activity).
Emails to AGENTS (agency users) fire straight through sendEmail with NO record.
Build a log + CC surface. Command Centre code isolation rules apply (Law 8:
/lib/command/* and /app/command/* only, commandDb from lib/command/prisma.ts,
utilitarian dark visual system per Law 9 - no glass, hairline borders #262626,
blue accent).

### C1 - data model

New model `AgentEmailLog` (prisma/schema.prisma), migration staging-first:
- id, sentAt (default now)
- toEmail; userId? (FK User, SetNull); agencyId? (FK Agency, SetNull)
- kind (string; see taxonomy below), subject
- text (plain body), html (nullable - see auth redaction)
- transactionId? (FK, SetNull), meta Json?
- indexes: sentAt, kind, agencyId

### C2 - logging wrapper + wiring (hand-rolled per site, Law 16)

Helper `sendAgentEmail` (suggest lib/email/agent-log.ts) = sendEmail + best-
effort AgentEmailLog write (failure must never block the send). Wire into each
sender with its kind:

| kind | sender | notes |
|---|---|---|
| weekly_brief | lib/services/agent-weekly-brief.ts | |
| morning_digest | lib/services/morning-digest.ts | recipients incl. internal roles - log all, role visible via userId |
| retention | lib/services/retention.ts | activation/retention sequence |
| welcome | lib/emails/send-welcome.ts | |
| claim_welcome | lib/emails/send-claim-welcome.ts | |
| team_invite | lib/email/director-invitation.ts + negotiator-invitation.ts | |
| team_accepted | lib/email/director-accepted.ts + negotiator-accepted.ts | |
| portal_message | lib/services/portal-messages.ts ~145 (the "Message from {contact}" TO the agent). The ~218 send is client-facing - do NOT log |
| domain_auth | app/api/cron/check-domains/route.ts | |
| verified_email | lib/services/verified-emails.ts | |
| chain_invite | lib/chain/invite.ts | external agents: userId null, toEmail only |
| password_reset | app/api/auth/forgot-password/route.ts | REDACTED: log kind+subject+recipient, html/text NULL (body contains live reset link - security decision, founder-approved) |

Client-facing senders (chase, milestone confirmations, portal invites,
client-weekly-update, survey, quote links, instructions email) are explicitly
OUT of scope - already logged on the file.

### C3 - CC surface

New page /command/(protected)/agent-emails (+ /api/command/agent-emails route
using commandDb), superadmin-gated like siblings, nav item in
components/command/CommandSidebar.tsx ("Agent emails").

- KPI strip: sent 7d, sent 30d, by-kind breakdown.
- Tabs (kind groups): All | Briefs & digests (weekly_brief, morning_digest) |
  Onboarding & team (welcome, claim_welcome, retention, team_invite,
  team_accepted) | Alerts (domain_auth, verified_email) | Portal messages |
  Chain invites | Auth (password_reset, redacted rows).
- Rows: sentAt, recipient (name/email/role/agency), kind pill, subject.
  Click -> detail (drawer or expanding row per CC conventions): rendered HTML
  via sandboxed iframe srcDoc + plain-text fallback; redacted kinds show a
  "body not stored" note.
- Filters: agency picker, recipient search.
- Pagination: sentAt desc, take 50 + cursor.

Known limitation (accepted): log starts at ship date; no backfill possible
(SendGrid activity retention ~3 days).

Retention/PII of stored bodies: no auto-purge in v1; file a POLISH_TBD row to
revisit at the data-retention review.

## Order + verification

1. PR1: Part A guard + unit test.
2. PR2: Part A2 correction script (staging -> verify Walnut Tree Barn -> prod).
3. PR3: C1+C2 (schema + wrapper + wiring). Migration staging-first.
4. PR4: C3 (CC page).
5. PR5: Part B (after confirming copy with founder).

Each PR: tsc clean, jest green, commit --only with explicit paths, no push
until founder signal (pushes are batched on his word; staging -> master ff).

## Open items for the founder

- Part B copy: exact wording for outsourced-file briefs.
- Whether morning-digest internal recipients (admin/SP) should appear in the
  CC log (current plan: yes, all rows logged).
