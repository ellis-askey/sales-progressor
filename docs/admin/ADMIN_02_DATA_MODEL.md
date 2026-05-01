# ADMIN_02 — Data Model & Schema Deltas

**Audience:** Claude Code
**Status:** Final (post-discovery) — all `[PENDING_DISCOVERY]` resolved 2026-05-01
**Depends on:** ADMIN_00 discovery report
**Read before implementing:** ADMIN_01 §2 (the SP/PM lens), ADMIN_01 §5.1 (refresh model)

---

## 1. Goals

This doc defines the schema changes required for the command centre. It covers:

1. The self-progressed vs progressor-managed distinction (foundation)
2. A unified `Event` table for all activity tracking
3. A unified `OutboundMessage` table for email + social + AI drafts
4. Rollup tables for fast analytics queries
5. Signup attribution
6. Admin audit trail
7. Indexes required for query performance

It does NOT cover business logic, UI, or jobs. Those live in ADMIN_01, ADMIN_03, and ADMIN_05.

---

## 2. The SP/PM distinction — transaction-level, with derived agency rollup

**Resolved by ADMIN_00 discovery.** The distinction already exists on `PropertyTransaction` via `progressedBy` and `serviceType` (Scenario B from the original draft, refined: the field exists at *transaction* level, not agency level). Agencies can — and do — mix modes. A single agency may self-progress easy deals and hand chain-heavy ones to your team.

This changes the model meaningfully from the original draft. Truth is per-transaction; agency-level is derived.

### 2.1 The canonical fields

Use the existing fields as authoritative. No new column on `PropertyTransaction` needed:

```prisma
// Already exists — confirmed by ADMIN_00:
model PropertyTransaction {
  // ... existing fields
  progressedBy  String   // existing
  serviceType   String   // existing — this is the SP/PM signal
  // ...
}
```

CC must verify in the schema migration PR which of `progressedBy` or `serviceType` (or a combination) is the canonical signal, and which exact string values map to "self-progressed" vs "progressor-managed." If it's a free-text field with inconsistent values, normalise to a typed enum as part of this migration:

```prisma
// New enum — applies only if normalisation is needed
enum ServiceType {
  self_progressed
  progressor_managed
}
```

If the existing field is already a clean enum or constrained string, leave it alone and use it directly. **Don't add a parallel field "for clarity" — the existing one is the truth.**

### 2.2 Derived agency rollup (NEW — needs to be added)

For the leaderboard, cohort tables, and any per-agency view, an agency needs a rollup label answering "which mode does this agency mostly use?" Add this as a computed field, refreshed by the nightly rollup job:

```prisma
enum AgencyModeProfile {
  predominantly_self_progressed   // > 80% of last-90d transactions are SP
  predominantly_managed           // > 80% of last-90d transactions are PM
  mixed                           // neither dominates
  no_recent_activity              // 0 transactions in last 90d
}

model Agency {
  // ... existing fields
  modeProfile           AgencyModeProfile @default(no_recent_activity)
  modeProfileComputedAt DateTime?
  @@index([modeProfile])
}
```

The 80% threshold is a starting point; adjustable via a config constant in `lib/command/constants.ts`. Computed nightly by the rollup job (per §5) from `PropertyTransaction.serviceType` filtered to last 90 days.

### 2.3 What this changes downstream

- **Every metric in ADMIN_03 that splits by SP/PM** reads `transaction.serviceType` for transaction-level metrics (almost all of them) and `agency.modeProfile` only for agency-level rollups (leaderboard, cohort retention)
- **The page-level SP/PM toggle** (ADMIN_01 §5.2) filters transactions by `serviceType`, not agencies by mode. An agency will appear in BOTH the SP and PM view if it has transactions of both kinds.
- **The "Active agencies" headline metric** is the count of agencies with ≥1 active transaction of the selected mode in the period — not the count of agencies with that mode profile.
- **No backfill needed** for `serviceType` (already populated). Backfill needed for `modeProfile` — one-off script reads last 90 days of transactions per agency and computes the label.

### 2.4 Cross-cutting query helper

Add `lib/command/scope.ts` exporting:

```ts
export type ModeFilter = 'self_progressed' | 'progressor_managed' | 'all'

// For transaction-scoped queries (most metrics)
export function applyServiceTypeFilter<T>(
  where: T,
  filter: ModeFilter
): T

// For agency-level queries (leaderboard, cohorts)
export function applyAgencyModeProfileFilter<T>(
  where: T,
  filter: ModeFilter,
  options?: { includeMixed?: boolean }   // default true when filter is 'all', false otherwise
): T
```

Both helpers are imported wherever an admin query filters by mode. No raw `where: { serviceType: ... }` scattered across services. The helper centralises the "does mixed count?" decision.

---

## 3. Unified `Event` table

Today, "what happened" is spread across `MilestoneCompletion.completedAt`, `CommunicationRecord.sentAt`, `User.lastLoginAt` (if it exists), `ChaseTask.updatedAt`, and likely several other implicit signals. This is impossible to query for activity feeds and heatmaps without 6 unions.

We add one append-only `Event` table that every meaningful action writes to. The existing tables stay as-is — the event table is a parallel index optimised for the command centre's read pattern.

### Schema

```prisma
model Event {
  id              String   @id @default(cuid())
  occurredAt      DateTime @default(now())

  // Who
  agencyId        String?
  userId          String?
  isInternalUser  Boolean  @default(false)

  // What
  type            EventType
  entityType      String?  // "transaction" | "milestone" | "contact" | "user" | "agency" | etc.
  entityId        String?

  // Context (small, queryable)
  metadata        Json?    // free-form, kept small (<2KB)

  // Indexes for admin queries
  @@index([occurredAt])
  @@index([agencyId, occurredAt])
  @@index([type, occurredAt])
  @@index([userId, occurredAt])
}

enum EventType {
  // Auth
  user_logged_in
  user_logged_out
  user_invited
  user_accepted_invite
  password_reset_requested
  password_reset_completed

  // Agency lifecycle
  agency_created
  agency_mode_changed
  agency_archived

  // Transaction lifecycle
  transaction_created
  transaction_archived
  transaction_status_changed

  // Milestone activity
  milestone_confirmed
  milestone_marked_not_required
  milestone_reversed
  exchange_gate_unlocked
  contracts_exchanged           // VM19/PM26
  sale_completed                // VM20/PM27

  // Communications (also written to OutboundMessage — see §4)
  chase_sent
  chase_message_generated       // AI draft generated, may not have been sent
  email_parse_attempted

  // Files
  file_uploaded
  file_deleted

  // Feedback
  feedback_submitted

  // Admin
  admin_logged_in
  admin_action_performed        // mirrors AdminAuditLog
}
```

### Write pattern

A thin helper module `lib/events/write.ts`:

```ts
export async function recordEvent(input: EventInput): Promise<void> {
  // Best-effort write. Failures are logged but never throw —
  // event logging must NEVER block the user-facing operation.
  try {
    await db.event.create({ data: input });
  } catch (err) {
    logger.warn("event_write_failed", { input, err });
  }
}
```

Every existing place in the codebase that performs one of the above actions calls `recordEvent` immediately after the primary write succeeds. This is the bulk of the migration work: a careful audit of every service in `lib/services/` to add the call.

**Discovery report §2 will list candidate locations.** Do not start adding `recordEvent` calls until the discovery is in.

### Retention

Events accumulate fast. Retention rules:
- Keep all events for 90 days at full granularity
- Daily rollup job (see §5) summarises older events into aggregate tables, then deletes them
- Audit-grade events (`admin_*`, `password_reset_*`, `agency_mode_changed`) are exempt from deletion — kept indefinitely or migrated to `AdminAuditLog`

### Why not a logging service (Sentry/Logflare/etc.)

Considered. Rejected because:
- Cost grows with event volume; a Postgres table doesn't
- We need to JOIN events with `Agency`, `User`, `PropertyTransaction` for almost every admin query
- We control the retention policy
- Discovery report will tell us if a logging service is already in place; if so, we can revisit

---

## 4. Unified `OutboundMessage` table

Per ADMIN_04, the command centre shows every outbound message ever sent — email, social post, AI-generated draft, anything outbound — in one log.

`CommunicationRecord` already exists and tracks chases. We extend the model rather than add a parallel table.

### Approach — extend `CommunicationRecord` (resolved by discovery)

Per ADMIN_00, `CommunicationRecord` is the existing chase table and `transactionId` on it is currently `NOT NULL`. We rename to `OutboundMessage` and **make `transactionId` nullable** so it can hold non-transaction messages (LinkedIn posts, password resets, retention emails, weekly digests).

This is a destructive change to a real table. CC must:
1. Verify no application code assumes `transactionId` is non-null *after* the migration (search every read site)
2. Run the migration on staging first, smoke-test the existing chase flow end-to-end
3. Add a CHECK constraint that ensures *either* `transactionId IS NOT NULL` (transaction-scoped messages) *or* `channel IN ('linkedin', 'twitter', 'in_app')` (legitimately transactionless), so we don't accidentally lose the transaction link on chase emails:

```sql
ALTER TABLE "OutboundMessage" ADD CONSTRAINT outbound_transaction_required
  CHECK (
    "transactionId" IS NOT NULL
    OR channel IN ('linkedin', 'twitter', 'in_app', 'other')
    OR subject = 'Password reset'
  );
```

(The password-reset clause is brittle. Better long-term: add a `purpose` enum field — `chase | password_reset | retention_email | scheduled_post | digest | other` — and key the CHECK constraint off that. Worth doing now while the table is being rewritten.)

### Target schema

```prisma
model OutboundMessage {
  id              String   @id @default(cuid())
  agencyId        String?               // null for system-level emails (e.g. password reset for orphaned user)

  // Channel + purpose
  channel         OutboundChannel       // email | sms | linkedin | twitter | in_app | other
  purpose         OutboundPurpose       // chase | password_reset | retention | scheduled_post | digest | other
  status          OutboundStatus        // draft | scheduled | queued | sent | delivered | opened | clicked | bounced | failed | cancelled

  // Routing — transactionId is now nullable
  transactionId   String?
  recipientName   String?
  recipientEmail  String?
  recipientHandle String?               // LinkedIn URN, phone number, etc.

  // Content
  subject         String?
  body            String                // full body text. May be markdown / html / plain depending on channel.
  bodyFormat      String                @default("plain") // "plain" | "markdown" | "html"

  // AI provenance
  isAiGenerated   Boolean               @default(false)
  aiModel         String?               // e.g. "claude-haiku-4-5-20251001"
  aiPromptVersion String?               // version tag for prompt template that generated this
  aiTokensInput   Int?
  aiTokensOutput  Int?
  aiCostCents     Int?                  // computed at write time using model pricing at that moment

  // Lifecycle timestamps
  createdAt       DateTime              @default(now())
  scheduledFor    DateTime?
  sentAt          DateTime?
  deliveredAt     DateTime?
  openedAt        DateTime?
  clickedAt       DateTime?
  failedAt        DateTime?
  failureReason   String?

  // Approval (for ADMIN_05 LinkedIn flow)
  requiresApproval  Boolean             @default(false)
  approvedByUserId  String?
  approvedAt        DateTime?
  editedByHuman     Boolean             @default(false)

  // Provider data
  providerMessageId String?             // SendGrid message ID, LinkedIn post URN, etc.
  providerWebhookData Json?             // last webhook payload from provider

  // Indexes
  @@index([agencyId, createdAt])
  @@index([channel, status, scheduledFor])
  @@index([purpose, createdAt])
  @@index([transactionId, createdAt])
  @@index([isAiGenerated, createdAt])
  @@index([sentAt])
}

enum OutboundChannel {
  email
  sms
  linkedin
  twitter
  in_app
  other
}

enum OutboundPurpose {
  chase
  password_reset
  retention_email
  scheduled_post
  digest
  notification
  other
}

enum OutboundStatus {
  draft
  scheduled
  queued
  sent
  delivered
  opened
  clicked
  bounced
  failed
  cancelled
}
```

### Migration from existing `CommunicationRecord`

Sequenced carefully:

1. Add new columns to `CommunicationRecord` with defaults (`channel = 'email'`, `purpose = 'chase'`, `status` derived from existing state, `bodyFormat = 'plain'`)
2. Backfill the new columns for all existing rows
3. Drop NOT NULL on `transactionId`
4. Add the CHECK constraint above
5. Rename `CommunicationRecord` to `OutboundMessage` (Postgres `ALTER TABLE ... RENAME`)
6. Update all read/write call sites in the same PR — `db.communicationRecord` → `db.outboundMessage` everywhere
7. Verify chase flow end-to-end on staging
8. Drop any old columns no longer needed (separate PR after a soak period)

### SendGrid event webhook

Required for `delivered`, `opened`, `clicked`, `bounced` statuses. New endpoint `POST /api/webhooks/sendgrid`. Validates signature, looks up `OutboundMessage` by `providerMessageId`, updates status + relevant timestamp.

ADMIN_00 confirmed SendGrid is in use but the event webhook is not configured. This is a TODO that blocks ADMIN_04's deliverability metrics but not the rest of the command centre.

---

## 5. Rollup tables

Page load on `/command/overview` cannot run "count events grouped by day for last 30 days" against a table with millions of rows. Rollups are pre-computed.

### `DailyMetric`

Because mixed agencies exist, transaction-derived counts split by `serviceType` (per-transaction), and agency-derived counts split by `modeProfile` (per-agency rollup). One table, two natural splits.

```prisma
model DailyMetric {
  id            String   @id @default(cuid())
  date          DateTime @db.Date              // the day this row covers (Europe/London midnight)

  // Scope keys — exactly one of these patterns is set:
  agencyId      String?                        // null = global rollup
  serviceType   ServiceType?                   // for transaction-derived counts: SP slice or PM slice; null = combined
  modeProfile   AgencyModeProfile?             // for agency-derived counts: which agency profile this row covers

  // Transaction-derived counts (split by serviceType)
  transactionsCreated   Int @default(0)
  transactionsExchanged Int @default(0)
  transactionsCompleted Int @default(0)
  milestonesConfirmed   Int @default(0)
  chasesSent            Int @default(0)
  aiDraftsGenerated     Int @default(0)
  filesUploaded         Int @default(0)

  // Agency/user-derived counts (split by modeProfile when global, or unsplit per-agency)
  signups               Int @default(0)
  logins                Int @default(0)
  uniqueActiveUsers     Int @default(0)
  feedbackSubmitted     Int @default(0)

  // AI spend (USD cents)
  aiSpendCents          Int @default(0)

  computedAt    DateTime @default(now())

  @@unique([date, agencyId, serviceType, modeProfile])
  @@index([date])
  @@index([agencyId, date])
  @@index([serviceType, date])
  @@index([modeProfile, date])
}
```

**Three row patterns:**

| Row pattern | `agencyId` | `serviceType` | `modeProfile` | Use |
|---|---|---|---|---|
| Per-agency, all transactions | set | null | null | Agency leaderboard, per-agency cards |
| Per-agency, mode-split | set | set | null | "How much of Agency X is SP vs PM?" |
| Global, by service type | null | set | null | "Total SP transactions yesterday across all agencies" |
| Global, by agency profile | null | null | set | "How many predominantly-managed agencies signed up?" |

The combined-mode totals are computed on read by summing rows — no need to store a fourth pattern.

**Why both splits?** Because the question "how is the SP business doing" can mean two different things:
- "How are SP transactions performing?" → split by `serviceType`
- "How are predominantly-SP agencies performing?" → split by `modeProfile`

Both are valid; both have different answers in a mixed-agency world. The metrics catalogue (ADMIN_03) specifies which split each metric uses.

### `WeeklyCohort`

For the cohort table on the Growth tab. Cohorts are agency-level (you sign up once per agency), so the split is `modeProfile`.

```prisma
model WeeklyCohort {
  id              String   @id @default(cuid())
  signupWeek      DateTime @db.Date            // Monday of the week the cohort signed up
  modeProfile     AgencyModeProfile            // computed at cohort-completion (12 weeks post-signup)

  cohortSize      Int
  activeWeek1     Int @default(0)
  activeWeek2     Int @default(0)
  activeWeek4     Int @default(0)
  activeWeek8     Int @default(0)
  activeWeek12    Int @default(0)

  computedAt      DateTime @default(now())

  @@unique([signupWeek, modeProfile])
  @@index([signupWeek])
}
```

**Important caveat:** Because agencies can shift between mode profiles over time (an agency that started SP might become predominantly PM after 6 months), the cohort's `modeProfile` is fixed at the **agency's profile as of week 12 post-signup**. This stops cohorts being reshuffled retroactively. The choice is captured in `lib/command/constants.ts` as `COHORT_MODE_LOCK_WEEK = 12`.

"Active" definition pulled from ADMIN_03 once you confirm the default in ADMIN_01 §8.

### Rollup job

A nightly job (Vercel Cron at 02:00 Europe/London) that:
1. Computes the previous day's `DailyMetric` rows from `Event` and the canonical tables
2. Recomputes `WeeklyCohort` for any cohort whose retention window is still open (last 12 weeks)
3. Marks any old `Event` rows (>90d, non-audit) for deletion

Job code lives in `lib/command/jobs/rollups.ts`. Idempotent — re-running the same date is safe.

If Vercel Cron is not currently wired in (verify in §6 of the discovery report), this job needs the cron config added to `vercel.json` as part of this migration set.

---

## 6. Signup attribution

Currently (per ADMIN_01 §4.2) signup source is not captured. To enable acquisition source breakdown:

```prisma
model Agency {
  // ... existing fields
  signupSource     String?    // utm_source or "direct" or "referral"
  signupMedium     String?    // utm_medium
  signupCampaign   String?    // utm_campaign
  signupReferrer   String?    // document.referrer at signup
  signupLandingPage String?   // first page visited
  signupAt         DateTime?  // backfilled from createdAt for existing rows
}
```

Capture happens at signup — middleware reads UTM params from URL, stores in a short-lived signed cookie, signup form reads from cookie and writes to `Agency`.

If signup is admin-created (PM agencies often are), these fields are null — that's correct, surfaces as "Direct (admin-created)" in the breakdown.

---

## 7. Admin audit log

```prisma
model AdminAuditLog {
  id            String   @id @default(cuid())
  occurredAt    DateTime @default(now())

  adminUserId   String                       // the superadmin who did this
  ipAddress     String?
  userAgent     String?

  action        String                       // dot.notation: "agency.mode_changed", "user.impersonated", "data.exported"
  targetType    String?
  targetId      String?

  beforeValue   Json?
  afterValue    Json?
  reason        String?                      // optional free text

  @@index([occurredAt])
  @@index([adminUserId, occurredAt])
  @@index([action, occurredAt])
  @@index([targetType, targetId])
}
```

Append-only. No UPDATE, no DELETE. Enforced by:
1. Application code never importing a delete/update method on this model
2. (Defence in depth) Postgres-level revoke on UPDATE/DELETE for the application role on this table — ADMIN_06 §db roles

Every admin action (changing an agency's mode, viewing a transaction, exporting data, impersonating a user) calls a single `recordAdminAction(...)` helper that writes here.

---

## 8. Index audit

The following indexes must exist after this migration. Verify with `\d <table>` after applying:

| Table | Index | Reason |
|---|---|---|
| `Agency` | `(modeProfile)` | Agency-level SP/PM filtering |
| `Agency` | `(signupAt)` | Cohort grouping |
| `PropertyTransaction` | `(serviceType, createdAt)` | Transaction-level SP/PM filtering for activity counts |
| `Event` | `(occurredAt)` | Activity feed reverse-chrono |
| `Event` | `(agencyId, occurredAt)` | Per-agency activity |
| `Event` | `(type, occurredAt)` | Per-event-type charts |
| `Event` | `(userId, occurredAt)` | Per-user activity table |
| `OutboundMessage` | `(agencyId, createdAt)` | Per-agency outbound list |
| `OutboundMessage` | `(channel, status, scheduledFor)` | Scheduler job picks up due messages |
| `OutboundMessage` | `(purpose, createdAt)` | Filter outbound by purpose (chase / retention / etc.) |
| `OutboundMessage` | `(sentAt)` | Outbound log default sort |
| `DailyMetric` | `(date, agencyId, serviceType, modeProfile)` UNIQUE | Idempotent rollup writes |
| `DailyMetric` | `(serviceType, date)` | Global SP/PM transaction-level charts |
| `DailyMetric` | `(modeProfile, date)` | Global agency-profile-level charts |
| `WeeklyCohort` | `(signupWeek, modeProfile)` UNIQUE | Idempotent rollup writes |
| `AdminAuditLog` | `(occurredAt)` | Audit tab default sort |

---

## 9. Migration sequence

In order. Each is one Prisma migration. Apply to staging first, verify the existing portal and progressor flows still work end-to-end, then prod.

1. **`add_superadmin_role`** — add `superadmin` value to the existing `UserRole` enum. Update one user (you) via SQL. Existing `admin` users untouched. Required first because ADMIN_06 audit log references `superadmin` actions.
2. **`add_agency_mode_profile`** — `AgencyModeProfile` enum + `Agency.modeProfile` + `modeProfileComputedAt`. Default `no_recent_activity`. Backfill via one-off script (read last 90d of `PropertyTransaction.serviceType` per agency, compute label). Optionally normalise `PropertyTransaction.serviceType` to `ServiceType` enum if it's currently free text — verify in PR.
3. **`add_event_table`** — `Event` + `EventType` enum + indexes. No backfill possible (no historical event data).
4. **`extend_outbound`** — `OutboundChannel` + `OutboundPurpose` + `OutboundStatus` enums, new columns on `CommunicationRecord` with defaults, backfill new columns, drop NOT NULL on `transactionId`, add CHECK constraint, RENAME table to `OutboundMessage`. Update all read/write call sites in the same PR. Smoke-test chase flow on staging.
5. **`add_signup_attribution`** — new `Agency.signup*` columns
6. **`add_rollup_tables`** — `DailyMetric`, `WeeklyCohort`
7. **`add_admin_audit`** — `AdminAuditLog`
8. **`add_command_indexes`** — any indexes from §8 not added in earlier migrations

After 1–8 are applied: instrument all the existing service code to call `recordEvent` (this is where most of the implementation hours go). Per the kickoff prompt: every `recordEvent` call wrapped in try/catch; one PR per service; regression test confirming the host service still succeeds when event write fails.

---

## 10. Items resolved by ADMIN_00 discovery

| # | Item | Resolution |
|---|---|---|
| 1 | SP/PM distinction | Exists at transaction level (`progressedBy`, `serviceType`); §2 rewritten around transaction-level truth + derived agency `modeProfile` |
| 2 | `CommunicationRecord` schema | `transactionId` is currently NOT NULL; §4 migration drops the constraint and adds CHECK + `purpose` enum |
| 3 | Vercel Cron / job runner | TBC from discovery report — if absent, add cron config to `vercel.json` as part of §5 |
| 4 | SendGrid event webhook | Not configured; deliverability metrics gated on adding it (TODO, doesn't block other tabs) |
| 5 | `User.lastLoginAt` | Not tracked; `user_logged_in` events will accumulate from the moment Event ships, no backfill |
| 6 | `console.log` audit-shaped events | TBC from discovery; CC will list candidate `recordEvent` instrumentation sites |
| 7 | Error monitoring SDK | None present; Health tab error-rate card stays as "not yet wired" until Sentry (or equivalent) is added |
| 8 | Existing `superadmin` role | Does not exist; §9 migration #1 adds it as a new enum value |
| 9 | Existing `app/admin/` route conflict | Confirmed; new founder command centre lives at `/command` and code lives in `app/command/` + `lib/command/` to avoid collision with existing internal admin |
| 10 | Recharts | Already installed; no package decision needed for charts |
