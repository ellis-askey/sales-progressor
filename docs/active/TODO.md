# Technical TODOs

---

## Completions "View all steps" setup modal (filed 2026-08-30)

The Completions empty state for brand-new agency users has a "Track your setup
progress" guide card. It's BUILT BUT HIDDEN behind `SHOW_SETUP_GUIDE = false` in
`app/agent/completions/page.tsx`. Its "View all steps" button should open a modal
that lists the full Getting-started checklist (the 6 onboarding steps) with each
step's done/undone state and a link, so the agent sees the whole setup in one
place. Reuse the onboarding progress source (`/api/agent/onboarding-progress`,
same as `components/agent/OnboardingChecklist.tsx`). When the modal exists, flip
`SHOW_SETUP_GUIDE = true`.

## To-Do "Learn more about to-dos" guide card (filed 2026-08-30)

The To-Do empty state (`components/agent/TodoEmptyState.tsx`) has a "Learn more
about to-dos" guide card, BUILT BUT HIDDEN behind `SHOW_TODO_GUIDE = false`. Its
"View guide" button needs a target — either a help article/URL or a short in-app
explainer of notes vs sale-linked tasks vs progressor requests. Flip
`SHOW_TODO_GUIDE = true` once it exists.

## Demo file "Show me around" contextual tour (filed 2026-08-30)

The demo-file first-arrival popover (`components/transaction/DemoFileMarker.tsx`)
currently has one action, "Explore myself" (dismiss). The spec also called for a
"Show me around" button that kicks off a short contextual product tour of the
demo file (progress, updates, tasks, activity). That contextual tour does not
exist yet, so the button is deliberately omitted for now (no dead control). When
a tour exists, add "Show me around" alongside "Explore myself" and wire it up.
A generic slide tour already lives at `components/agent/TourSlides.tsx`, but it's
not file-contextual and ends by routing to /agent/transactions/new, so it's not a
drop-in — the contextual tour is separate work.

## Updates "Learn more about Updates" guide + card "Learn more" links (filed 2026-08-30)

The Updates empty state (`components/agent/CommsEmptyState.tsx`) has a "Learn more
about Updates" guide card, BUILT BUT HIDDEN behind `SHOW_UPDATES_GUIDE = false`.
The three "What you'll see here" cards are info-only for now (no dead controls per
Law 13). When a guide target exists, add a "Learn more" link to each card and flip
`SHOW_UPDATES_GUIDE = true` so the buttons and the bottom guide card appear together.

---

## Phase-2 arc — BuyerRound per-sale scoping for remaining models

Filed 2026-06-05 as part of the Section 2 Contact-scoping PR. Branch
`feat/buyer-round-phase2-scoping` cuts from `staging` AFTER Section 2
(Contact A1+B3) is verified on staging AND on prod. No Phase-2 PR starts
before that gate (Ellis-locked).

One PR per model, in this order — worst-first, ranked by the cost of a
fell-through buyer's content leaking onto the live file. Reframed
2026-06-05 by the fall-through ledger audit (see
`C:\Users\ellis\.claude\plans\phase-2-fall-through-ledger-audit.md`):

1. **Fall-through cancellation (reframed scope)** — the ledger audit
   established that `relistTransactionImpl` already cancels open
   buyer-side `ReminderLog` + `ChaseTask` at relist time (STEPS 11A-D,
   `app/actions/transactions.ts:2134-2190`). PR 1's real scope:
   - Mirror that cancellation into `changeStatusAction` for the
     withdraw-only path (withdraw-no-relist files were leaving open
     chases firing forever).
   - Emit `Event(type="reminder_cancelled_at_fall_through",
     metadata={ hookPoint, ... })` audit rows at BOTH hook points.
   - **Semantic alignment** — change relist STEP 11D from
     `status="inactive", statusReason="Buyer round archived on relist"`
     to `status="cancelled", statusReason="sale fell through"`. **Must
     ship pre-launch — after prod has data this becomes a migration.**
   - Close open `TransactionHoldPeriod` rows at both hook points
     (`endedAt=now, endedById=session.user.id`, idempotent
     `where endedAt IS NULL`). A withdrawn file isn't paused, it's
     dead; agent reopens on the new sale if needed.
   - Fold in **GAP-4** (agent search Contact scoping) — surface
     old-buyer Contact rows as clearly previous-round (muted, with a
     "Sale {n} · fell through" sub-line) unless labelling is
     disproportionate effort, in which case fall back to hide.
2. **PR 1.5 — queue-time send gate + mirror attribution fix (NEW)**
   — Same fall-through invariant, separate review. Two changes to
   `lib/email/outboundQueue.ts`:
   - The drain skips rows where `recipientContactId` resolves to a
     Contact whose `buyerRoundId !== tx.activeBuyerRoundId` AND
     `roleType="purchaser"`. Mark `errorAt=now,
     error="recipient round archived"` (keeps audit trail) rather
     than delete.
   - The OutboundMessage CLIENT_CHASE mirror stamps to
     `Contact.buyerRoundId` (the contact's actual round) instead of
     `tx.activeBuyerRoundId`. Closes the dead-buyer-receives-chase
     scenario and the new-round mis-attribution.
3. **`TransactionDocument`** — read-path filter + targeted backfill
   (rule: `contactId` resolves to purchaser-role Contact → stamp with
   that Contact's `buyerRoundId`; else NULL). Includes voice-pass on
   the drawer caveat string ("Documents on this file are not tied to a
   specific sale…") which becomes incorrect after this PR.
4. **`OutboundMessage`** — read-path filter (activity timeline +
   `/agent/automated-emails` list + **the `/api/agent/notifications`
   bell-count route at lines 34-43 — GAP-5**) + targeted backfill.
   Bundles the `logAutomatedEmail` write-path gap fix
   (`lib/services/portal.ts:138-161` doesn't stamp today).
5. **`PortalMessage`** — read-path filter + purchaser-only targeted
   backfill (solicitor / broker portal sends stay file-level, known
   limitation flagged in the PR description). Drawer integration:
   folded into the existing Communications section with a "Portal"
   channel pill via `lib/agent/comms-display.tsx` — no new drawer
   section.
6. **`ReminderLog`** — read-path filter (belt-and-braces after PR 1 +
   archived-drawer visibility) + targeted backfill. NO new drawer
   section (decision noted in PR description as chosen, not
   forgotten — the chase-generated comms already surface in the
   drawer's Communications section).
7. **`ChaseTask`** — read-path filter + backfill (inherits from
   parent `ReminderLog` post-PR-6). NO new drawer section, same
   rationale as PR 6.

Each PR follows the same template: read-path scoping + targeted
backfill script + structured stamped/unmatched report + staging-first
verification + Ellis browser gate on the Emily relist fixture (live
Contacts shows active-round only; Sale 1 drawer + Sale 2 drawer hard
gates). Each PR ships to prod before the next is cut. No schema
migrations (`ChaseTask.statusReason` not added per Ellis-locked
decision — parent-log reason + Event metadata is sufficient).

Re-instatement on un-archive is out of scope for this arc. The
`statusReason="sale fell through"` discriminator is preserved if it's
ever revisited.

Full plan including audit findings:
`C:\Users\ellis\.claude\plans\are-the-documents-clickable-downloadable-encapsulated-lighthouse.md`.

---

## Phase-3 arc — (a)-CLASS aggregate restructuring — ✅ SHIPPED 2026-06-05

Cut on `feat/buyer-round-phase3-aggregates`, shipped to staging in
commit `796721e feat(buyer-round): Phase-3 — cross-tx aggregate
restructure ((a)-CLASS resolved)` + verification harness extension
`bdb4088 test(buyer-round): Phase-3 harness assertions — 32/32 PASS`.

**Insurance sentence — RETIRED**:

> ~~Hub pipeline, hub recent activity, analytics, completions, comms
> dashboard, and work-queue item counts remain inflated by
> archived-round milestone completions until the Phase-3 (a)-CLASS
> aggregate restructure lands.~~ — closed 2026-06-05.

**How it was solved**: new shared module `lib/services/round-scope.ts`
exposes `roundScopedOR(activeRoundIds)` + `contactRoundScopedOR(...)`
+ `loadActiveRoundIds(whereClause)`. Each cross-tx aggregate surface
now pre-loads the active-round-id set for its scope, then feeds that
set into an OR clause on the nested MC / Contact / ChaseTask /
OutboundMessage filter. BuyerRound ids are globally unique cuids → the
`buyerRoundId IN [active set]` test is equivalent to "this row's
buyerRoundId === its own tx's activeBuyerRoundId".

**Surfaces patched** (all in this same arc):
- `lib/services/transactions.ts` — listTransactions,
  listTransactionsByScope, getExchangedNotCompleting,
  getCompletingFilesDetailed: contacts + MC + chaseTasks +
  communications all scoped.
- `lib/services/hub.ts` — getHubPipelineStats, getHubFilteredIds,
  getMonthExchangingIds, getHubWeeklyForecast, getHubRecentActivity:
  every MC `some/none` filter + the cross-tx OutboundMessage findFirst
  scoped.
- `lib/services/analytics.ts` — getAnalytics, getMonthlyActivity,
  getSolicitorExchangeStats, getFilesAtRisk: every cross-tx MC + the
  cross-tx ChaseTask filter scoped.
- `lib/services/work-queue.ts` — getWorkQueueItems: the per-tx MC
  include scoped (hasExchanged derivation now ignores archived-round
  PM26/VM19).
- `lib/services/agent.ts` — getAgentTransactions,
  getAgentCompletions, getAgentMilestoneActivity (comms dashboard):
  MC includes + the top-level cross-tx milestoneCompletion findMany
  all scoped via the two-step pattern.

**Cross-tx Contact list reads** that Section 2's
`scopeContactsToActiveRound` couldn't reach (line 42 listTransactions,
line 322 listTransactionsByScope, line 555
getExchangedNotCompleting, line 657 getCompletingFilesDetailed —
GAP-3 from the fall-through ledger audit) are closed in the same arc.

**Verification** (`scripts/verify-phase-2-read-shape.ts`, 32/32 PASS
on the Emily relist fixture):
- cross-tx exchanged-MC count is scoped (scoped ≤ unscoped)
- 12 fall-through-round MCs measured on the fixture — these are the
  rows Phase-3 hides from aggregate dashboards
- cross-tx Contact count is scoped agency-wide (86 → 84: Marcus +
  Terry correctly excluded from cross-tx aggregates)

**Per-site grep**: every restructured filter site carries `// PHASE 1
4d (a)-CLASS resolved — Phase-3 OR scope below.` so future
contributors find every patched location at a glance.

---

## Vercel silently skipping auto-builds for some pushes

Filed 2026-06-04 from the commit 6b fix-up. Commit `fbea564` was pushed to `feat/buyer-round-phase1-uniqueness` and Vercel did NOT trigger a build. The previous push on the same branch (`b700fa7`) had been built within seconds. A manual `vercel` invocation deployed the missing commit successfully (deployment `dlxiqgxwu`).

**Symptom:** `git push` returns success, the remote branch advances, but `vercel ls --yes` shows no new build for that SHA. Other recent pushes deployed normally — this isn't a project-wide hang, it's per-push.

**Hypotheses (none verified):**
- Vercel GitHub integration webhook missed or got rate-limited.
- Some build-step ignore logic in Vercel saw the change as a no-op (the fix-up touched two `.tsx` files + a `.md` — should not be skipped).
- Branch protection or a webhook config change broke the trigger.

**Impact:** The deploy pipeline silently dropping a commit is a runbook risk. If this recurs at the prod cutover, an approved release SHA could be in the repo while a stale build is live. Detection requires explicitly comparing the deployed commit hash to the approved one.

**Mitigations already in place:**
- Prod release runbook Step 2 now MANDATES the hash-match check between approved SHA and `/api/healthz`-reported deployed SHA.
- Until this is root-caused, after every push run `vercel ls --yes | head -3` and confirm the top entry's age matches the push you just made.

**Fix targets:**
1. Verify the GitHub → Vercel webhook is healthy and not paused.
2. Add a healthz endpoint that exposes `commitSha` (if not already there) so the runbook check is one curl.
3. Once root-caused: add a post-push CI step that triggers a manual `vercel deploy` if no auto-build appears within 60 seconds.

**Priority:** Pre-prod must-investigate. Deploy reliability is a security property — silent skip = silent staleness.

---

## Dev server fails on Windows under Turbopack — Tailwind content scanner ENOENT

Filed 2026-06-04 from the commit 6b smoke-test attempt. Blocks local rendered verification on Windows; CI / Vercel deploy unaffected (different runtime). Surfaces as a 500 on every authenticated route.

**Symptom:**

```
HTTP 500 on every /agent/* route
Error: ./app/globals.css
Error evaluating Node.js code
Error: ENOENT: no such file or directory, stat
  'C:\Users\ellis\Downloads\Sales Prog App\full\app\billing-terms\page.tsx'
  at resolveChangedFiles (node_modules/tailwindcss/lib/lib/content.js:236:36)
```

**Confirmed environmental, not a real missing file:**
- `ls app/billing-terms/page.tsx` returns the file (last touched commit `6187598`).
- `next-env.d.ts` got auto-rewritten to `./.next/dev/types/routes.d.ts` (was `./.next/types/...`). Possibly a Next.js / Turbopack version interaction.
- Stack frame is inside `tailwindcss/lib/lib/content.js` — Tailwind v3's file watcher choking on a Windows-pathed entry under Turbopack.

**Working theories:**
1. Tailwind v3 + Turbopack on Windows: `content.js` constructs paths with mixed separators (`\` vs `/`) and `fs.statSync` fails on the combination. Test by upgrading to Tailwind v4 OR switching dev away from `turbopack`.
2. Stale Tailwind cache from a previous run that referenced a now-moved file. Test by deleting `.next/` and `node_modules/.cache/`.
3. Next.js 16.2.4 `dev` build configuration drift in `tsconfig` (note next-env.d.ts auto-rewrite). Test by pinning Next or comparing to a teammate's working setup.

**Impact and workaround:**
- Cannot smoke-test UI changes locally on Windows.
- Vercel deploy preview is the verification path until this is fixed.
- Affected commits documented as such (commit 6b verified on deploy, not local).

**Priority:** Pre-launch must-fix. The current workaround (deploy-to-verify) is slow and tools-around-the-edges; rendered local verification is the right loop for UI work.

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
