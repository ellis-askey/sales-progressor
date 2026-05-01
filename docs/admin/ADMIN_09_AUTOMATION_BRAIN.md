# ADMIN_09 — Automation Brain

**Audience:** Claude Code + you
**Status:** Draft — channel decisions deferred to discovery (see §3)
**Depends on:** ADMIN_02 (`Event`, `OutboundMessage`), ADMIN_04 (Outbound Log)
**Implements:** lifecycle automation engine + the `/command/automations` tab

---

## 1. What this is

An IF/THEN engine that runs against `Event` data and triggers actions: emails, in-app nudges, WhatsApp messages, Slack pings to internal team — whatever the rule says. It's how you scale operational responses without doing them manually.

Examples of what it should do:

- IF a user signs up but doesn't add a sale within 24h → nudge them
- IF a user hasn't logged in for 5 days → re-engagement sequence
- IF a user is highly active → prompt the upsell from self-progressed to progressor-managed
- IF a transaction stalls for 14 days → ping the assigned progressor (internal Slack)
- IF an agency adds their 5th transaction → trigger a "you might want managed service" email

Three things it isn't:

- **Not a CRM.** No deal pipeline, no sales sequences for prospects. Activates on existing user/agency events only.
- **Not a marketing automation platform.** No newsletters, no broadcast campaigns. Trigger-based only.
- **Not an event router.** It doesn't replace the existing reminder engine that drives chases — that's product logic and stays where it is.

---

## 2. Critical: discovery before build

You flagged that some lifecycle emails already exist. Before any new rules go live, we have to know what's already firing — otherwise we'll double-message users, blow up unsubscribe lists, and look like spammers from inside our own product.

**The first ticket on this doc is a discovery prompt for CC, not implementation.** It produces an inventory of every existing automated/triggered email (and any other outbound that's not user-initiated), with: trigger condition, channel, frequency cap, suppression logic, and provider. That inventory becomes Appendix A of this doc, and any new rule we propose is checked against it for overlap.

The discovery prompt is in §10. Treat it like ADMIN_00 — paste, get report back, then proceed.

---

## 3. Channel decisions — deferred until discovery

You said: *"We already have some emails set up for lack of engagement so don't want to clash with that. Maybe need to ask Claude when he gets to that point to ask or decide?"*

Right call. Here's what gets decided when:

| Decision | When | Who |
|---|---|---|
| Which channels exist today | After §10 discovery | CC produces report |
| What overlaps with proposed automation rules | After §10 discovery | CC flags conflicts; you approve resolution |
| Whether to add WhatsApp / SMS in v1 | After conflict resolution | You |
| Which provider for new channels | After above | You + CC recommendation |

Until those answers land, the schema in §4 supports all channels and the rule engine in §5 can be built channel-agnostic. We're not blocked on the channel question; we just don't fire any channel until you've signed off on the conflict matrix.

---

## 4. Schema

### 4.1 The rule

```prisma
model AutomationRule {
  id              String   @id @default(cuid())
  name            String                          // human-readable
  description     String?

  trigger         Json                            // structured trigger spec — see §5
  conditions      Json                            // additional filters that must match
  steps           Json                            // ordered list of actions — see §6

  scope           AutomationScope                 // 'all' | 'self_progressed' | 'progressor_managed'
  active          Boolean  @default(false)        // off by default; explicit enable required
  shadowMode      Boolean  @default(true)         // when true, evaluates and logs but doesn't fire

  createdByUserId String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  lastEditedBy    String?

  // Frequency caps
  perUserCooldownDays  Int @default(0)            // don't fire for same user within N days
  globalDailyCap       Int?                       // max fires per day across all users

  @@index([active, shadowMode])
}

enum AutomationScope { all self_progressed progressor_managed }
```

### 4.2 The fire log

```prisma
model AutomationFire {
  id          String   @id @default(cuid())
  ruleId      String
  firedAt     DateTime @default(now())

  // Subject
  agencyId    String?
  userId      String?
  triggerEventId String?                          // the Event row that fired this

  // Result
  shadowMode  Boolean                             // copied from rule at fire time
  outcome     AutomationOutcome                   // queued | sent | suppressed | failed | shadow
  outcomeReason String?                           // e.g. "user_unsubscribed", "cooldown_active", "global_cap"

  // Linked outbounds (a fire may produce multiple messages)
  outboundMessageIds String[]

  @@index([ruleId, firedAt])
  @@index([userId, firedAt])
  @@index([agencyId, firedAt])
}

enum AutomationOutcome { queued sent suppressed failed shadow }
```

### 4.3 Suppression

```prisma
model AutomationSuppression {
  id          String   @id @default(cuid())
  userId      String?
  agencyId    String?
  ruleId      String?                              // null = suppress all rules
  channel     String?                              // null = suppress all channels
  reason      String                               // 'unsubscribed' | 'bounce' | 'manual' | 'spam_complaint'
  createdAt   DateTime @default(now())
  expiresAt   DateTime?

  @@index([userId])
  @@index([agencyId])
  @@unique([userId, ruleId, channel])
}
```

Hard rule: every channel-sending step in every rule consults `AutomationSuppression` before firing. If a suppression matches, the fire is logged with `outcome = suppressed`. No bypass — not for "important" rules, not for transactional. Transactional emails (password reset, security) live outside the automation system entirely.

---

## 5. The trigger spec

Each rule's `trigger` field is a structured JSON spec:

```json
{
  "type": "event_based",
  "eventType": "agency_created",
  "delay": { "days": 1 },
  "guard": {
    "noEventOfType": "transaction_created",
    "withinDaysSinceTrigger": 1
  }
}
```

Or:

```json
{
  "type": "absence_based",
  "missingEventType": "user_logged_in",
  "forDays": 5,
  "subject": "user"
}
```

Or:

```json
{
  "type": "threshold_based",
  "metric": "transactions_created_count",
  "operator": ">=",
  "value": 5,
  "scope": "agency",
  "windowDays": 30
}
```

The engine evaluates triggers on a 5-minute schedule. Each rule has an evaluator function in `lib/command/automations/triggers/{event,absence,threshold}.ts`. New trigger types can be added by adding a new evaluator + extending the schema enum — no other code changes.

---

## 6. The step spec

Each rule's `steps` is an ordered list:

```json
[
  {
    "type": "send_email",
    "template": "no_first_sale_24h",
    "delay": { "hours": 0 }
  },
  {
    "type": "wait",
    "duration": { "days": 2 }
  },
  {
    "type": "send_email",
    "template": "no_first_sale_72h",
    "skipIf": { "eventOccurred": "transaction_created" }
  },
  {
    "type": "in_app_nudge",
    "nudgeId": "add_first_transaction",
    "skipIf": { "eventOccurred": "transaction_created" }
  }
]
```

Step types for v1:

| Step type | What it does |
|---|---|
| `send_email` | Generates an `OutboundMessage` with `channel = email`, sends via SendGrid |
| `in_app_nudge` | Creates an in-app notification (new `Notification` table — small, separate) |
| `wait` | Pauses the sequence for the duration |
| `slack_internal` | Posts to a configured internal Slack channel — for "ping the team" rules |
| `tag_user` | Adds a tag to the user record (for later filtering) |
| `tag_agency` | Same for agency |

Step types deferred to post-discovery:

- `send_whatsapp` — pending channel decision (§3)
- `send_sms` — same

Every step that produces an outbound action writes to `OutboundMessage` (per ADMIN_02 §4) with the rule ID + fire ID in metadata. Everything is auditable in ADMIN_04.

---

## 7. Shadow mode (mandatory before any rule fires for real)

Every new rule starts with `shadowMode = true`. In shadow mode:

- Triggers evaluate normally
- Conditions are checked
- Suppressions are checked
- A `AutomationFire` row is written with `outcome = shadow`
- **No outbound action actually fires**

You watch the shadow log for at least 7 days. Verify:
- It fires on the right people
- It doesn't fire on people it shouldn't
- It doesn't conflict with existing emails (cross-check against Appendix A from §10 discovery)
- The volume is what you expected

Then you flip `shadowMode = false`. Real fires begin.

This is the single most important guardrail in this doc. Skipping it on a rule that hits 200 users is how you spam your customer base.

---

## 8. The Automations tab UI

### 8.1 List view

Sortable table:

| Column | |
|---|---|
| Name | rule.name |
| Status | active / shadow / paused / draft (badge) |
| Trigger summary | human-readable trigger description |
| Fires last 7d | count from `AutomationFire` |
| Sent last 7d | count where outcome = sent |
| Suppressed last 7d | count where outcome = suppressed |
| Open rate (if email) | from SendGrid event webhook |
| Last fire | most recent firedAt |

Filter by status, scope (SP/PM), trigger type.

### 8.2 Rule editor

Form-based editor for non-developers. Trigger picker → conditions builder → steps builder → frequency caps → scope. Plus:

- **Preview pane** — shows last 10 events that *would* have fired this rule if it had been active
- **Conflict check** — runs the rule spec against Appendix A and warns if it overlaps an existing channel + audience combination
- **Save as draft / Save and shadow / Save and activate** (the last requires an explicit confirm dialog and writes to `AdminAuditLog`)

### 8.3 Fire log per rule

Click a rule → see every fire in the last 30 days. Each row shows: when, who, outcome, linked outbound message (link to ADMIN_04), trigger event (link to event detail).

### 8.4 Health view

A dashboard tab on this page showing aggregate health:

- Total fires today / week / month
- Suppression rate trend
- Bounce / spam-complaint trend per rule
- Rules with anomalous suppression rates flagged

If a rule's bounce rate goes above 2% or spam rate above 0.1%, it's auto-paused (set `active = false`) and an alert raised. Email deliverability is a precious resource — protect it.

---

## 9. Default rule set (proposals — none enabled until you approve)

Once §10 discovery is done and conflicts are mapped, here are the rules to consider seeding (in shadow first):

| Name | Trigger | Steps |
|---|---|---|
| Welcome — Day 1 | `agency_created` + 1d delay | Email if no `transaction_created` |
| Welcome — Day 3 | `agency_created` + 3d delay | Email if no `transaction_created` |
| First sale celebration | First `transaction_created` per agency | In-app nudge + email |
| Quiet user — 5 days | Absence of `user_logged_in` for 5d | Email + in-app nudge on next login |
| Quiet agency — 14 days | Absence of any agency event for 14d | Email to agency admin + internal Slack |
| Stuck transaction (internal) | `transaction_created` + no milestone for 14d | Internal Slack to assigned progressor (PM only) |
| Power user upsell | Agency reaches 5+ active transactions in 30d (SP only) | In-app nudge promoting managed service |
| Cohort milestone | Agency hits 10 exchanges lifetime | Email celebration + ask for testimonial |
| Onboarding stall | `agency_created` but no `user_invited` in 7d | Email asking if they need help |

Every one of these is a proposal. None ships without §10 discovery + your approval + 7 days shadow.

---

## 10. Discovery prompt for CC (paste into Claude Code first)

> I'm about to add a triggered automation engine to the platform. Before I build anything, I need an inventory of every automated, scheduled, or triggered outbound currently in the system. Read-only investigation. Do not modify code.
>
> Produce a markdown report titled `ADMIN_09_AUTOMATION_INVENTORY.md`. For each piece of existing automation, capture:
>
> 1. **Name / location** — file path + function name
> 2. **Trigger** — what causes it to fire (cron schedule, event, user action, lifecycle hook)
> 3. **Audience** — who receives it (user role, agency mode, specific segment)
> 4. **Channel** — email, in-app, push, SMS, internal Slack, etc.
> 5. **Provider** — SendGrid, Twilio, custom, etc.
> 6. **Content** — template name + a one-line summary of what the message says
> 7. **Frequency cap or cooldown** — does it have one? where enforced?
> 8. **Suppression / unsubscribe handling** — how does the user opt out?
> 9. **Where it logs** — does it write to `CommunicationRecord`, console, somewhere else, or nowhere?
>
> Search exhaustively. Specifically check:
> - Every file under `lib/services/` for SendGrid calls
> - `lib/services/reminders.ts` and any reminder-related code
> - Cron job files (`vercel.json` cron entries, any `app/api/cron/*` routes)
> - Any `notification`, `notify`, `alert`, `digest`, `summary`, `reminder` files
> - Any code that runs on `Agency` or `User` create/update hooks
> - Onboarding flow code
> - Password reset and similar transactional email paths
>
> Also list any **scheduled but not currently used** automation infrastructure (commented-out cron entries, dead code paths, env vars referencing email systems we're not using — e.g. the Resend key that's set but not called).
>
> Output structure:
> ```
> ## Active automations
> [one section per automation, with all 9 fields above]
>
> ## Inactive / dead automations
> [things wired up but not currently firing]
>
> ## Infrastructure present but unused
> [Resend key, etc.]
>
> ## Risk flags
> [any automation with no suppression handling, no logging, no frequency cap — anything that could be a spam vector]
> ```
>
> Read-only. Cite file paths and line numbers. Do not modify or write any application code. Save the report to the repo root as `ADMIN_09_AUTOMATION_INVENTORY.md`.

When the report is back, share it here. I'll add it as Appendix A to this doc and update the default rule set in §9 to remove anything that conflicts with what already exists.

---

## 11. Decisions required from you (after discovery)

- [ ] After CC's inventory, decide: pause / consolidate / leave-as-is for each existing automation
- [ ] Which proposed rules in §9 to seed (all? subset?)
- [ ] Add WhatsApp / SMS to v1, or defer? (Recommend defer — get email-only sequences working and measure first)
- [ ] If WhatsApp: provider (Twilio recommended for fastest path)
- [ ] Internal Slack channel for `slack_internal` step type — channel name + webhook URL
- [ ] Deliverability budget — at what bounce / spam rate does a rule auto-pause? (Defaults: 2% bounce, 0.1% spam)

---

## 12. Out of scope for v1

- A/B testing of rule variants (defer to ADMIN_08 once experiment infrastructure is mature)
- Branching sequences ("if user clicks A, branch to X, else branch to Y") — linear sequences only in v1
- AI-generated message content per fire (use static templates with merge fields; AI generation comes later if static perform well)
- Multi-language support
- Time-of-day / time-zone optimisation per recipient (send-time intelligence) — defer
- Customer-segment-specific rule scoping beyond SP/PM split (defer)
- Drag-and-drop visual rule builder (form-based editor only in v1)
