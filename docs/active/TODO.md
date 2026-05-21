# Technical TODOs

---

## FileTimeSession — privacy / GDPR (pre-launch required)

Filed 2026-05-15. Review before first paying customer.

- Update privacy policy to disclose per-user, per-file time tracking
- Add delete-on-offboarding path: wipe `FileTimeSession` rows when a user is deactivated
- Decide retention policy — recommended: 12 months rolling, enforce in `data-retention` cron

---

## Chase prompt calibration — follow-up items

Filed 2026-05-08. Ship current glossary integration first; address these in a follow-up after a week of real-use observation.

### CP1 — Urgent tone reads as Polite-Yet-Firm

**Observed in:** §7.1 acceptance test (Deborah, WhatsApp, Urgent, VM2 — MOS receipt).

**Symptom:** The generated Urgent message used only softeners ("just chasing in," "just wanted to check," "if there's anything unclear") without any of the urgency signals the tone modifier is supposed to require. The output was warm and correct but not meaningfully different from a Polite-Yet-Firm message. A deadline-at-risk message should feel different in register.

**Required fix (to `PROMPT_SPEC.md §5.2` Urgent tone guidance):**
- (a) Require a factual statement of the timeline outstanding ("X days since we sent the MOS"), not just naming the target date.
- (b) Require a direct ask without softening modals on the key action — "could you confirm" is fine; "if there's anything unclear" as the primary ask is not.
- (c) Require explicit ordering: shared deadline first, what specifically needs to happen next, then volunteer help. The current guidance says this but the model ignores the ordering under Urgent.

**Reference:** Email 12 in `docs/chase-generation/VOICE_CORPUS.md` is the canonical Urgent example — use it to rewrite the guidance. Re-run §7.1 acceptance test after the fix and verify the output no longer reads as Polite-Yet-Firm.

---

### CP2 — Multi-item connective phrases need register filtering

**Observed in:** §7.2 acceptance test (Marcus, email, Polite-Yet-Firm, two milestones).

**Symptom:** The model bridged two administrative milestones (mortgage offer and buildings insurance) with "On a lighter note" — a tone-shifting connective that implies one item is more significant than the other. Both items were straightforward administrative tasks; the shift in register was wrong and slightly informal relative to the Polite-Yet-Firm tone.

**Required fix (to `PROMPT_SPEC.md §4.7` multi-item message structure):**
- (a) Explicitly exclude tone-shifting connectives: "On a lighter note," "On a more serious note," "More importantly," and similar phrases that imply relative weight between milestones.
- (b) Add a rule: connective phrases must be register-neutral — they bridge paragraphs without implying that one milestone matters more than another or that the tone should shift.
- (c) Replace the current connective example list with neutral-only options: "Also," "While we're here," "On a side note," "One other thing —," "Alongside that."

Re-run §7.2 acceptance test after the fix and verify the bridging phrase is register-neutral.

---

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

## Prisma migration history drift — shadow DB reconciliation

`prisma migrate dev` fails on the shadow database because migration `20250418000000_sprint2_milestones` references a table (`PropertyTransaction`) that doesn't exist when replaying from scratch. Additionally, the live DB contains a `bodySearch` column on `OutboundMessage` that is not in `schema.prisma`, causing `db push` to warn about data loss.

**Root cause:** At some point, schema changes were applied to the live DB outside of Prisma migrations (raw SQL, Supabase console, or similar).

**Impact:** New schema changes can't be delivered via `migrate dev`. Current workaround: add columns via `prisma db execute` with raw SQL + `prisma generate`.

**To fix (when time permits):**
1. Audit the live DB against `schema.prisma` to find all drifted columns (the `bodySearch` column on `OutboundMessage` is one known instance)
2. Add the missing columns to `schema.prisma` (or mark them as ignored)
3. Use `prisma migrate resolve --applied <migration_name>` to mark the broken migration as already applied, or squash the migration history
4. Verify `prisma migrate dev` runs cleanly on a fresh shadow DB

**Timing:** Not urgent, but must be resolved before launch when reliable migration deploys to production matter.

---

## Ownership enforcement helper — deferred to Package D

Package D will introduce `lib/security/access-scope.ts` as the standard ownership-enforcement helper. Until then, inline `findFirst({ where: { id, agencyId } })` patterns are the live mechanism. Do NOT build `lib/security/assertOwnership.ts` — Package D's helper replaces it with a more complete model that handles internal staff and outsourced file access correctly. Reference: see PACKAGE_D_SCOPE §3 (Root cause and fix shape).

---

## Deferred from May 2026 audit

These items came out of the end-to-end audit (docs/audit-2026-05.md)
but were deliberately deferred. Listed here in rough priority order.

### High priority (should be picked up within the next quarter)

1. **C3 — Billing event recording.** No BillingEvent / Invoice model exists.
   Exchange milestones (VM19/PM26) trigger no billing record. Fee
   calculation exists in lib/services/fees.ts but is never persisted.
   Once we have ~10 paying customers, this becomes urgent — manual fee
   reconciliation will not scale. Estimated: 2-3 days for proper
   BillingEvent model + Stripe integration scaffolding.

2. **C2 — Audit Event table never written to.** Schema defines 20+
   EventType values; only 1 write call exists in lib/command/events/
   write.ts. Everything else uses console.log("[AUDIT]...") which goes
   to Vercel logs only. Need to wire EventType writes for: login,
   transaction_created, milestone_confirmed, status_changed, etc.
   This is the proper home for the audit trail; PostHog is for product
   analytics. Estimated: 1 day to wire ~10 event types.

3. **G4 — 2FA for agent users.** User.totpSecret + totpActivatedAt
   already in schema. /api/command/setup-2fa exists for superadmin.
   Need equivalent flow for agents. Trust signal for enterprise
   prospects. Estimated: half a day.

### Medium priority (nice to have, no fire)

4. **I3 — TransactionStatus has no `exchanged` state.** Files go from
   active to completed. No filter for "files where contracts have
   exchanged but legal completion is pending." Genuine product-design
   question, not just a fix. Estimated: 2-3 hours UI + DB migration.

5. **I4 — Audit log O(n) fetch + in-memory sort.** Will degrade for
   busy agencies. Not a problem today (small data), but lib/services/
   audit.ts:30-35 needs proper pagination + DB-side sort before agencies
   reach ~1000 transactions. Estimated: half a day.

6. **I6 — canViewAllFiles flag has no UI.** Directors can't toggle
   negotiator-level "see all agency files" without DB edit. Add to
   Team management UI in Settings. Estimated: 2 hours.

### Low priority (papercuts)

7. **U1 — Dead `draft` value in TransactionStatus enum.** Never used
   by any UI. Either remove or implement draft transactions properly.

8. **U2 — Hub "exchanging soon" requires expectedExchangeDate or
   overridePredictedDate.** Files with neither are never counted.
   Should likely fall back to a heuristic for files with no date set.

9. **U3 — purchasePrice stored in pence (Int).** Field name doesn't
   indicate units. Add a comment or rename to purchasePricePence.

10. **U4 — agentFeeIsVatInclusive nullable creates three-value
    logic.** Refactor to non-null with explicit default, or make
    enum-typed (yes/no/unknown).

11. **U5 — TransactionDocument.source is `String @default("portal")`
    with no enum validation.** Typos possible. Convert to enum.

### Already noted in earlier TODO sections

- **bodySearch column on OutboundMessage** — exists in production DB
  with 261 non-null rows but not in prisma/schema.prisma. Investigate
  and reconcile (keep or drop) during next migration history pass.
- **Prisma migration history shadow DB drift** — `migrate dev` fails;
  workaround using `prisma db execute` with targeted SQL. Reconcile
  before launch.

---

## RemindersSection / AgentRemindersList drift audit

Filed 2026-05-12 during work queue Stage 1 inventory.

`components/reminders/RemindersSection.tsx` (transaction-detail) and
`components/reminders/AgentRemindersList.tsx` (work queue) contain
near-parallel inline sub-components:

- `RowSnoozeMenu` (RemindersSection:87 / AgentRemindersList:143)
- `SideSnoozeMenu` (RemindersSection:117 / AgentRemindersList:86)
- `ColumnSection` ↔ `SideColumn` (RemindersSection:162 / AgentRemindersList:199)
- `EmptyColumn` (RemindersSection:147 / AgentRemindersList:375)
- `GROUP_CONFIG` constant — duplicated verbatim
- `classifyActive` / `classifyForStats` — near-identical urgency classifiers
- `addBusinessDays` / `isSunday` helpers — duplicated across three files
  (work-queue/page.tsx, AgentRemindersList.tsx, RemindersSection.tsx)

Each parallel implementation differs in prop API (RemindersSection's
snooze handlers carry `logId` for inline cascade; AgentRemindersList's
carry only `taskId` because the parent page revalidates), so a naive
hoist-and-share is not possible without harmonising the action layer
first.

**Action:** audit both files for visual + behaviour drift one month
after both pages have been deployed to a real-use environment. If
drift is minimal, consolidate by introducing a shared
`useReminderActions` hook + lifted sub-components. If drift is
substantial (e.g. visual treatments have diverged), keep parallel
implementations and document the intentional divergences in
ANIMATION_STANDARDS.md as a new deliberate exception (similar to E1).

**Out of scope for the polish pass** — surface inconsistencies will be
caught by Stage 4 spec rows, but structural consolidation is a
separate refactor.

---

## Stage 1 inventory checklist: grep for component-local string constants

Filed 2026-05-12 after the transaction-detail retroactive sentence-case
fix (PropertyHero.STATUS_VARIANTS + StatusControl.STATUSES rendered
"On Hold" while the rest of the app moved to "On hold"). The
transaction-detail Stage 4 sign-off missed these because the inventory's
component-by-component tracking captures imports, not component-local
constants that hold user-facing strings.

**Pattern to add to Stage 1 inventory workflow (fold into
`INVENTORY_TEMPLATE.md` during next batched doc tightening):**

When walking a component for §7 copy inventory, additionally grep for
component-local Record / object constants that map to user-facing labels:

- `*_LABELS` / `*_LABEL`
- `*_VARIANTS` / `*_VARIANT`
- `*_CONFIG` / `*_CONFIGS`
- `STATUSES` / `STATUS_OPTIONS`
- `*_OPTIONS`

Each such constant should be listed in the §7 copy inventory if its values
render to users. Otherwise app-wide updates (e.g. STATUS_LABELS sentence-
case migrations) will silently miss the component-local copies and create
drift between pages.

**Not urgent.** Catch on the next batched doc tightening pass; the four
remaining polish-pass inventories (dashboard, analytics, completions,
to-do, etc.) can apply this workflow ad hoc until the template is updated.
