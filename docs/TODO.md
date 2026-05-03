# Technical TODOs

## reminders/run — scaling ceiling

`/api/reminders/run` processes all active transactions in a single serverless function invocation,
batched 8 at a time via `Promise.allSettled`. This works well up to ~100–150 active transactions
before the 120s `maxDuration` becomes a hard ceiling.

**When this matters:** once active transaction volume exceeds ~150 concurrently.

**Options when the time comes:**
- Split into paginated cron runs (e.g. two cron schedules, each processing half by ID range)
- Move reminder evaluation to a queue (Vercel Queue, or a dedicated worker with a persistent loop)
- Shard by agency so each invocation handles one agency's transactions

Tracked here so it doesn't get lost. No action needed until volume warrants it.

---

## Full RLS activation — all 18 unprotected tables + Prisma middleware

PR 51 enabled RLS on 5 tables (PropertyTransaction, User, Contact, ManualTask, SolicitorFirm)
with PERMISSIVE bypass policies. 18 additional tables with agency-specific data are unprotected
at the DB level (MilestoneCompletion, OutboundMessage, ChaseTask, ReminderLog, TransactionDocument,
TransactionNote, TransactionFlag, PriceHistory, PortalMessage, PropertyChain, ChainLink,
SolicitorContact, AgencyRecommendedSolicitor, VerifiedDomain, UserVerifiedEmail,
AgentPushSubscription, RetentionEmailLog, FeedbackSubmission).

Current enforcement model: application-layer agencyId checks (hardened by PR 52).

**To activate strict DB-level RLS:**
1. Write ENABLE/FORCE/CREATE POLICY for all 18 remaining tables
2. Build Prisma middleware that calls
   `SELECT set_config('app.current_agency_id', agencyId, TRUE)`
   at the start of every request (replacing the opt-in withAgencyRls wrapper pattern)
3. Handle superadmin paths (privileged DB role or explicit bypass)
4. Drop the 5 staging bypass policies and activate strict policies
5. One week of monitoring

**Estimated effort:** 2–3 days dev + 1 day testing.
**Timing:** Pre-Series-A / pre-first-enterprise-customer. No action until then.
**Reference:** docs/MANUAL_TASKS.md (bypass policy SQL + strict policy SQL kept for reference).

---

## Ownership enforcement helper — deferred to Package D

Package D will introduce `lib/security/access-scope.ts` as the standard ownership-enforcement helper. Until then, inline `findFirst({ where: { id, agencyId } })` patterns are the live mechanism. Do NOT build `lib/security/assertOwnership.ts` — Package D's helper replaces it with a more complete model that handles internal staff and outsourced file access correctly. Reference: see PACKAGE_D_SCOPE §3 (Root cause and fix shape).
