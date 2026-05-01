# CC Prompt — ADMIN_02 Schema Migrations

Paste the contents of the boxed section below into Claude Code at the repo root, after the docs have been updated to the post-discovery versions.

---

```
The discovery report from ADMIN_00 is in. The four-doc revision pass is
complete. ADMIN_02, ADMIN_03, ADMIN_06, and the README are now post-discovery
("Final" status). Re-read these four files before doing anything — the SP/PM
model in particular has changed materially from the previous draft.

Three confirmed decisions you need to know:

1. The new founder command centre lives at `/command` (NOT /admin — that is
   the existing internal progressor admin and must not be touched).
2. Code goes under `app/command/` and `lib/command/`.
3. A new `superadmin` role is added to the existing UserRole enum, sitting
   above `admin`. Existing `admin` users are unchanged.

═══════════════════════════════════════════════════════════════════════════════
TICKET: ADMIN_02 SCHEMA MIGRATIONS
═══════════════════════════════════════════════════════════════════════════════

Goal: implement migrations 1–8 from ADMIN_02 §9 in sequence. No UI. No
business logic. No event instrumentation calls inside existing services
(that's a separate later ticket per ADMIN_02 §9 closing paragraph).

The migrations:

1. add_superadmin_role          — UserRole enum gets `superadmin`
2. add_agency_mode_profile      — AgencyModeProfile enum + Agency.modeProfile + backfill
3. add_event_table              — Event + EventType enum + indexes
4. extend_outbound              — CommunicationRecord → OutboundMessage rename + new enums + nullable transactionId + CHECK constraint + backfill
5. add_signup_attribution       — Agency.signup* columns
6. add_rollup_tables            — DailyMetric, WeeklyCohort
7. add_admin_audit              — AdminAuditLog
8. add_command_indexes          — anything from §8 not already added

═══════════════════════════════════════════════════════════════════════════════
NON-NEGOTIABLES
═══════════════════════════════════════════════════════════════════════════════

ISOLATION

- Do not touch any code in app/portal/, app/admin/, or any existing service
  EXCEPT where ADMIN_02 §4 mandates updating chase code to use the renamed
  OutboundMessage table.
- For migration 4 (the rename), update every read/write site in the SAME PR.
  The codebase must be at green-build state at the end of every commit.
- All new code lives in lib/command/ and app/command/. The app/command/
  directory may not exist yet — create it.

SAFETY

- Apply every migration to staging first.
- After EACH migration on staging, run the existing test suite and smoke-test
  the existing portal and progressor flows end-to-end.
- After migration 4 specifically (the OutboundMessage rename), manually
  verify that:
    a. Existing chase emails still send
    b. Existing chase records are still readable in the progressor UI
    c. The CHECK constraint accepts every legitimate purpose
- Do not promote any migration to production until staging has been verified
  for at least 24h with no regressions.

BACKFILLS

- Migration 2 (Agency.modeProfile): write a one-off script
  scripts/backfill-mode-profile.ts that reads PropertyTransaction.serviceType
  for the last 90 days per agency and computes the AgencyModeProfile label.
  Run it once after the migration. Schedule the same logic to run nightly
  via the rollup job (per ADMIN_02 §5) — do NOT skip the nightly because
  the one-off "covers it." Profiles drift; the nightly is the source of truth.
- Migration 4 (CommunicationRecord backfill): every existing row gets
  `channel = 'email'`, `purpose = 'chase'`, `bodyFormat = 'plain'`, and a
  status derived from existing fields. Verify counts before and after.

TESTING

- Each migration has its own PR.
- Each PR includes a Prisma migration file, a backfill script if relevant,
  and tests.
- For migration 4 specifically: regression test that proves the existing
  chase send flow still works against the renamed table. This is the
  highest-risk migration; treat it accordingly.
- The CHECK constraint on OutboundMessage gets its own dedicated test with
  one row per legitimate purpose.

ESLINT

- Add the eslint rule from ADMIN_06 §3.1 (no-admin-audit-mutation) in this
  ticket so it's in place before AdminAuditLog gets used elsewhere.
- Add a second eslint rule that prevents anything outside app/command/ and
  lib/command/ from importing from lib/command/. Failing CI is the goal.

═══════════════════════════════════════════════════════════════════════════════
ORDER OF EXECUTION
═══════════════════════════════════════════════════════════════════════════════

PR 1 — add_superadmin_role
  * Add `superadmin` to UserRole enum
  * Migration applied to staging
  * SQL UPDATE statement (commented in migration, run manually) for
    promoting one user to superadmin
  * No code changes in services
  * Tests: enum value present, no existing role checks broken

PR 2 — add_agency_mode_profile
  * AgencyModeProfile enum
  * Agency.modeProfile + Agency.modeProfileComputedAt
  * scripts/backfill-mode-profile.ts (one-off)
  * Confirm in code review which of progressedBy / serviceType (or combo)
    is the canonical signal — discovery report should specify; if it's
    free text, normalise to a typed enum as part of this PR
  * Tests: backfill script produces correct labels for fixture agencies

PR 3 — add_event_table
  * Event model + EventType enum + indexes
  * lib/command/events/write.ts with the recordEvent helper
    (try/catch wrapped, never throws)
  * No instrumentation calls into existing services in this PR — that's
    a separate later set of PRs, one per service
  * Tests: helper writes successfully; helper swallows errors silently

PR 4 — extend_outbound  [HIGHEST RISK]
  * OutboundChannel + OutboundPurpose + OutboundStatus enums
  * New columns on CommunicationRecord with defaults
  * Backfill new columns
  * DROP NOT NULL on transactionId
  * ADD CHECK constraint
  * RENAME CommunicationRecord → OutboundMessage
  * Update every read/write call site
  * Tests: existing chase send flow still works; CHECK constraint
    accepts every purpose

PR 5 — add_signup_attribution
  * Agency.signupSource / signupMedium / signupCampaign / signupReferrer /
    signupLandingPage / signupAt
  * Backfill signupAt from existing createdAt for existing rows
  * Tests: defaults work

PR 6 — add_rollup_tables
  * DailyMetric + WeeklyCohort
  * Empty tables; no rollup job in this PR (the job comes with ADMIN_03
    later)
  * Tests: schema valid, indexes present

PR 7 — add_admin_audit
  * AdminAuditLog model
  * lib/command/audit/write.ts with recordAdminAction helper
  * Postgres-level REVOKE on UPDATE/DELETE for application_role
    (or document why the current connection role can't have this revoked
    and what the alternative is)
  * Tests: helper writes successfully

PR 8 — add_command_indexes
  * Sweep ADMIN_02 §8 for any indexes not added by previous PRs
  * Verify with `\d <table>` after applying

═══════════════════════════════════════════════════════════════════════════════
WHAT TO DO RIGHT NOW
═══════════════════════════════════════════════════════════════════════════════

1. Re-read ADMIN_02, ADMIN_03, ADMIN_06, README.

2. For each of the eight migrations, write a brief implementation plan
   (5–10 lines per migration). Cover:
   - Schema delta (Prisma DSL)
   - Backfill if any
   - Read/write sites that need updating
   - Tests required
   - Specific risks for this migration

3. Stop and post the eight implementation plans in chat. Do not start
   PR 1 until the plans are reviewed.

The order matters and #4 is the dangerous one — getting the plan right
before any code is written saves a rollback.

WHAT NOT TO DO

- Do not start writing migrations before the plans are reviewed
- Do not bundle multiple migrations into one PR
- Do not add any UI
- Do not add `recordEvent` calls into existing services in this ticket
- Do not touch the existing `/admin` route or app/admin/ directory
- Do not skip the staging verification step between migrations
- Do not "tidy up" anything outside lib/command/ and app/command/
```
