# Prospects — Command Centre implementation plan

**Status:** planning only. No code, schema, or migrations written yet.
**Author:** Claude Code, 2026-08-29. Grounded in a codebase audit (file paths below are real and verified unless marked UNVERIFIED).

**Purpose (kept deliberately narrow):** find an estate agent → contact → follow up → land one live sale → watch whether they become a repeat/active TSP agency. The value is *reducing prospecting effort* and *producing clean acquisition data*, not building a CRM. Every design choice below biases toward low input and automatic updates over manual maintenance.

The funnel we are wiring end to end:
**Prospect → Contact → Follow-up → Interested → First sale → Second sale → Active agency → Revenue** — with acquisition attribution that *survives conversion* into a real `Agency`.

---

## A. Current-state audit (what we reuse vs build new)

### Reuse directly (no change)
- **Access + DB isolation.** Every Command Centre action calls `requireSuperAdmin()` (`app/actions/command-centre.ts:24-28`) → `hasSuperAdminPowers` (`lib/agent-session.ts:65-69`), and all reads/writes go through the isolated `commandDb` (`lib/command/prisma.ts:11-15`). Prospects follows this exactly.
- **Page skeleton + nav.** Layout `app/command/(protected)/layout.tsx` (dark `#0a0a0a`, `max-w-6xl`, `PageFadeIn`). Nav is a static array in `components/command/CommandSidebar.tsx` (`NAV_SECTIONS`, lines 31-85; active state at line 307). Add one `{ href:"/command/prospects", label:"Prospects", Icon: UserPlus }` to the **Growth** section.
- **Stat cards / search / status chips / filters / tabs.** Copy: `Stat`/`CapabilityStat` (`app/command/(protected)/adoption/page.tsx:147-157, 251-258`); search box + view toggle + status-chip row (`app/command/(protected)/agencies/page.tsx:221-257`); rich filter component (`components/command/OutboundFilters.tsx`); tabs (server-link style `app/command/(protected)/activity/page.tsx` `WHO_TABS`, or client `components/command/rules/RulesTabs.tsx`).
- **Detail drawer.** The one command-themed right-side drawer is inline in `components/command/ChaseHubTable.tsx:86-138` (fixed overlay, `max-w-md`, lazy-loads detail via a server action on row click). Mirror this for the prospect detail drawer.
- **Activity feed markup.** `app/command/(protected)/activity/page.tsx:294-337` (divided list, coloured type badge via `typeBadge()`, actor, relative timestamp). Mirror for the prospect timeline.
- **Create/edit form pattern.** `"use client"` + `useTransition` + server action + `router.refresh()`: `components/command/NewExperimentForm.tsx` (create), `app/command/(protected)/providers/[id]/ProviderFirmEditor.tsx` (edit with dirty-tracking), server actions split into a domain file like `app/actions/provider-firms.ts` returning `{ ok, data|error }`.
- **Email sending.** `sendEmail(...)` / `sendChainEmail(...)` (`lib/email.ts:35-160`; the latter has `trackOpens?`) and agency-verified sender `sendFromVerifiedAddress` (`lib/services/sendgrid.ts:97-122`). SendGrid webhook `app/api/webhooks/sendgrid-bounce` joins events by `customArgs.queueId`.
- **Outreach email log.** `model AgentEmailLog` (`prisma/schema.prisma:3488-3522`) is the right fit: nullable `userId`/`agencyId` ("null for external agents on chain invites"), string `kind` (no migration to add a new kind), `toEmail`, `subject`, `text`/`html`, optional `transactionId`, `meta Json`. We log prospect outreach here.
- **AI drafting.** `lib/anthropic.ts` (`anthropic` client + `callClaude`, model `claude-haiku-4-5-20251001`). Drafting templates to copy: `app/actions/command-centre.ts:239-243` (Opus, the experiment-idea generator — closest analogue) and `lib/services/insight/daily-brief.ts:27-31` (Haiku with a system prompt).
- **Chain-invite warm-prospect feed.** `model ChainLink` stub fields (`stubAgencyName`, `stubAgentEmail`, `stubAgentName`, `stubAgentPhone`, `inviteStatus`, `inviteSentAt`, `inviteFirstViewedAt`, `claimedAt`; `prisma/schema.prisma:1792-1879`) and `lib/command/chain-invites.ts` (`getUninvitedNeighbours`, the "looked but haven't joined" call list). This is a ready-made source; we link to it, we do not duplicate its funnel.

### Build new
- **`Prospect` + `ProspectContact` + `ProspectActivity` models.** `Contact` (`prisma/schema.prisma:731-832`) is confirmed per-transaction with a required `propertyTransactionId` FK and cascade-delete — unusable for acquisition. A prospect is agency/branch-level with its own people.
- **Prospects UI** (list, pipeline, follow-up queue, detail drawer, log-call, compose-follow-up, CSV import).
- **`app/actions/prospects.ts`** server-action bundle.
- **CSV import** — no existing upload/parse/preview pattern anywhere (only CSV *export* at `app/api/agent/analytics-export/route.ts`). Build the upload → preview → dedupe → confirm flow new.
- **Command-themed editable email compose.** `components/email/EmailPreviewModal.tsx` has the right view↔edit/load/save *structure* but is agent-app themed (`--agent-*`, `usePortalTheme`); restyle to neutral-900/800.

### UNVERIFIED / gaps to note
- **Prospect email open + reply tracking.** `AgentEmailLog` has **no** `openedAt` and is not joined by the SendGrid webhook (that webhook stamps `OutboundEmailQueue`, which requires a `User`/`Contact` FK a prospect doesn't have). So out of the box we can log *sends* but not *opens/replies* for prospects. Treated as a later enhancement (see F + Decisions).
- Inbound reply capture (Outlook sync, `lib/services/email-interpret.ts`) matches to *transaction files*, not prospects — no automatic "email received" for prospects without new matching. Manual "Log reply" in Phase 3; automated later.

---

## B. Proposed UX

One route, `/command/prospects`, with three views via a link-based tab bar (Pipeline / All prospects / Follow-ups). A detail **drawer** (not a route) opens on click — it matches the ChaseHubTable pattern and keeps you in the list.

**Top of page (all views):** title + a compact stat row — `Total`, `Follow-ups due`, `Interested`, `Trials / first sale`, `Active` — then a control row: **Search**, **+ Add prospect**, **Import**, and status/source filter chips. Keep it airy (copy the adoption page spacing, not a dense grid).

**Pipeline view:** columns for each status (New, Contacted, Replied, Interested, Trial/First sale, Active, Lost) as vertical lists of compact cards (agency name · location · primary contact · days-since-contact · a next-follow-up chip). Read-only kanban feel; clicking a card opens the drawer. (No drag-and-drop in v1 — status changes happen in the drawer/quick actions; simpler and lower-risk.)

**All prospects view:** a filterable table (agencies-page markup). Columns: Agency · Branch/location · Primary contact · Role · Status · Last contact · Next follow-up · Latest note (truncated) · Source. Sortable by last/next contact.

**Follow-ups view (the operational core):** filter chips Today / Overdue / Upcoming / All over `Prospect.nextFollowUpAt`. Each row: agency · contact · reason/last-interaction · days since contact · stage · and inline quick actions → Follow up · Call · Note · Reschedule. Reuse the same drawer + actions; this view is just a query over `nextFollowUpAt`.

**Detail drawer:** header (agency name, status pill, source); a persistent action bar (**Email · Log call · Follow up · Change status · More**); then sections — Agency info · Contacts (multiple, primary flagged) · Next follow-up · Notes/context · **Activity timeline** (reverse-chronological). If converted, a banner links to the live `Agency` and shows transaction count + exchanged revenue to date.

---

## C. Proposed data model (Prisma — NOT applied yet)

Three new models. All string-keyed enums-as-Prisma-enums where the set is stable; the *activity* type stays a free string (like `FeatureEvent`) so new activity kinds never need a migration.

```prisma
// A prospective estate agency / branch we want to acquire.
model Prospect {
  id            String   @id @default(cuid())
  agencyName    String
  branch        String?
  website       String?
  location      String?
  postcode      String?
  phone         String?
  generalEmail  String?
  branchCount   Int?
  sizeNote      String?  // approx listings / size, freeform

  source        ProspectSource @default(other)
  status        ProspectStatus @default(new)

  ownerUserId   String?  // internal owner (defaults to creator)
  notes         String?  // rolling context (latest note also lives in timeline)

  lastContactedAt DateTime?
  nextFollowUpAt  DateTime?
  followUpCount   Int      @default(0)

  convertedAt        DateTime?
  convertedAgencyId  String?  @unique   // survives conversion — the attribution link
  lostAt             DateTime?
  lostReason         ProspectLostReason?
  revisitAt          DateTime?          // reappears in the follow-up queue

  // Provenance when this prospect came from a chain invite (warm lead).
  sourceChainLinkId  String?

  // GDPR / deliverability
  optedOutAt   DateTime?
  bouncedAt    DateTime?
  archivedAt   DateTime?

  createdById  String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  convertedAgency Agency?           @relation(fields: [convertedAgencyId], references: [id], onDelete: SetNull)
  sourceChainLink ChainLink?        @relation(fields: [sourceChainLinkId], references: [id], onDelete: SetNull)
  contacts        ProspectContact[]
  activities      ProspectActivity[]

  @@index([status, nextFollowUpAt])
  @@index([nextFollowUpAt])
  @@index([source])
  @@index([convertedAgencyId])
}

model ProspectContact {
  id           String  @id @default(cuid())
  prospectId   String
  name         String
  jobTitle     String?
  email        String?
  phone        String?
  linkedinUrl  String?
  isDecisionMaker Boolean @default(false)
  isPrimary       Boolean @default(false)
  preferredContact String?  // "email" | "phone" | "linkedin"
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  prospect Prospect @relation(fields: [prospectId], references: [id], onDelete: Cascade)

  @@index([prospectId])
  @@index([email])
}

// One row per meaningful interaction. Free-string `type` (no enum migration for
// new kinds), mirroring the FeatureEvent design. Doubles as the analytics source.
model ProspectActivity {
  id           String   @id @default(cuid())
  prospectId   String
  type         String   // "created" | "email_sent" | "call_logged" | "note" | "status_changed" | "follow_up_scheduled" | "follow_up_completed" | "contact_added" | "converted" | "lost" | ...
  occurredAt   DateTime @default(now())
  actorUserId  String?
  summary      String?  // one-line headline
  body         String?  // note text / call notes / email body snapshot
  metadata     Json?    // { fromStatus, toStatus, callOutcome, contactId, agentEmailLogId, ... }

  prospect Prospect @relation(fields: [prospectId], references: [id], onDelete: Cascade)

  @@index([prospectId, occurredAt])
  @@index([type, occurredAt])
}

enum ProspectStatus { new contacted replied interested trial active lost }
enum ProspectSource { cold google linkedin referral chain solicitor existing_contact inbound other }
enum ProspectLostReason { not_interested existing_solution price no_response timing corporate_decision doesnt_outsource other }
```

**Back-relations to add (existing models, additive):**
- `Agency`: `prospect Prospect?` (inverse of `convertedAgencyId`) — nullable, no data change to existing rows.
- `ChainLink`: `prospects Prospect[]` (inverse of `sourceChainLinkId`).

**Why this shape**
- Prospect is agency-level with `contacts[]` — matches "prospect = agency/branch, many people."
- `convertedAgencyId @unique` is the single durable attribution link. It is the *only* thing that must survive conversion; everything downstream (transactions, revenue) is derived by joining `Agency → PropertyTransaction` (agencyId), so we never duplicate agency/transaction data.
- Activity as a free-string model avoids touching `EventType` (which would force a migration for every new activity kind) and gives us the analytics event stream for free.
- Follow-ups are a **field on Prospect** (`nextFollowUpAt`), not a `ManualTask` row. `ManualTask` (`schema.prisma:1657-1690`) *could* be reused (it's nullable-agency/transaction, `isInternalSelfAssigned`), but a dedicated field is lower-friction and keeps the queue a simple query. (Decision D3.)

---

## D. API / backend changes

New `app/actions/prospects.ts` (every action `requireSuperAdmin()` first, all via `commandDb`, return `{ ok, data|error }`):

- `createProspectAction(input)` — create Prospect (+ optional first contact); writes a `created` activity.
- `updateProspectAction(id, patch)` — agency fields / notes; dirty-safe.
- `addProspectContactAction(prospectId, input)` / `updateProspectContactAction` / `setPrimaryContactAction`.
- `changeProspectStatusAction(id, toStatus, note?)` — writes `status_changed` activity; may set `interested`/`trial` timestamps.
- `logProspectCallAction(id, { outcome, notes, nextFollowUpAt?, newStatus? })` — writes `call_logged`, bumps `lastContactedAt`, optionally sets `nextFollowUpAt` + status. (The "few seconds" action.)
- `scheduleFollowUpAction(id, whenISO)` / `completeFollowUpAction(id)` — set/clear `nextFollowUpAt`, write activity.
- `addProspectNoteAction(id, body)` — `note` activity.
- `markProspectLostAction(id, reason, revisit?)` — set `lostAt`/`lostReason`/`revisitAt`, write `lost`.
- `convertProspectAction(id, agencyId)` — set `convertedAt`/`convertedAgencyId`, status `active`, write `converted`. (Conversion can also be auto-suggested — see I.)
- **Email:** `draftFollowUpAction(id, templateKey?)` → returns `{ to, subject, body }` from Claude (never sends); `sendProspectEmailAction(id, { to, subject, body })` → `sendEmail`/`sendChainEmail`, log to `AgentEmailLog` (kind `"prospect_outreach"`, `meta.prospectId`), write `email_sent` activity, bump `lastContactedAt` + `followUpCount`, suggest next follow-up.
- **Import:** `importProspectsAction(rows)` — validated server-side (see J). Preview is computed by a `previewProspectImportAction(rows)` that returns per-row status (new / duplicate / invalid) without writing.
- **Chain integration:** `addChainStubAsProspectAction(chainLinkId)` — creates a Prospect from a `ChainLink` stub, stamping `sourceChainLinkId` + `source = chain`.

Read helpers in `lib/command/prospects.ts`: `getProspects(filter)`, `getPipeline()`, `getFollowUpQueue(bucket)`, `getProspectDetail(id)` (prospect + contacts + activities), `getAcquisitionFunnel(range)`.

No new cron in Phases 1-4. A later optional cron can surface `revisitAt` due-dates and roll up acquisition metrics (Phase 5 / deferred).

---

## E. Frontend changes

- **Route:** `app/command/(protected)/prospects/page.tsx` (server) reading `getProspects`/`getPipeline`/`getFollowUpQueue` by `?view=` + filter params.
- **Nav:** one `NavItem` in `CommandSidebar` Growth section.
- **Components (new, command-themed):**
  - `ProspectsClient.tsx` — view tabs + filter chips + search (copy agencies-page + `OutboundFilters` patterns).
  - `ProspectTable.tsx` (All), `ProspectPipeline.tsx` (kanban lists), `FollowUpQueue.tsx`.
  - `ProspectDrawer.tsx` — mirror `ChaseHubTable` drawer chrome; sections + action bar; lazy-load detail via `getProspectDetailAction`.
  - `ProspectActivityTimeline.tsx` — mirror the activity-feed markup + a `PROSPECT_EVENT_BADGE` colour map.
  - `AddProspectForm.tsx` / `EditProspectFields.tsx` — mirror `NewExperimentForm` / `ProviderFirmEditor`.
  - `LogCallDialog.tsx` — outcome buttons + notes + follow-up date; if "No answer" show 2d/5d/1w/custom chips.
  - `FollowUpCompose.tsx` — the editable To/Subject/Body compose (restyle from `EmailPreviewModal` structure), with a "Generate follow-up" button (calls `draftFollowUpAction`) + template picker; Send calls `sendProspectEmailAction`.
  - `ProspectImportModal.tsx` — file input → parsed preview table → confirm.
- **Reuse imports:** `components/command/shared/InfoTip`, the `Stat` card markup, `AutoRefresh` (optional on the queue).
- **CSV parsing:** parse in the browser (small, superadmin-only) or server-side in the action. No `papaparse` dependency exists; a tiny hand-rolled CSV split is fine for a known column set, or add `papaparse` (Decision D5).

---

## F. Email / follow-up architecture

1. **Draft (never auto-send).** `draftFollowUpAction(id, templateKey?)` builds a context block from the prospect (agency name, primary contact name, status, `notes`, last N `ProspectActivity` summaries, `followUpCount`, days since `lastContactedAt`, chosen template intent) and calls `anthropic.messages.create` (pattern from `app/actions/command-centre.ts:239-243`). Returns strict `{ to, subject, body }`; on any failure returns a **template fallback** (see §9 templates) so the compose box is never empty. Model: Haiku for cost (Decision D4).
2. **Compose + edit.** `FollowUpCompose` opens pre-filled and fully editable (To defaults to the primary contact email). Nothing sends without an explicit Send click.
3. **Send.** `sendProspectEmailAction` → `sendEmail`/`sendChainEmail` (Decision D1 on sender identity), then in one transaction: insert `AgentEmailLog` (`kind:"prospect_outreach"`, `toEmail`, `subject`, `text`/`html`, `meta:{ prospectId, contactId }`), insert `ProspectActivity` (`email_sent`, `body` = snapshot), update `lastContactedAt = now`, `followUpCount += 1`, and (optionally) propose `nextFollowUpAt`.
4. **Deliverability/opens/replies (phased).** Sends log immediately. To get *opens*, either (a) send via a lightweight `OutboundEmailQueue`-style path with `trackOpens` + `customArgs.queueId` and a prospect-capable recipient, or (b) add `openedAt` + a webhook join to `AgentEmailLog`. Both need a migration → **Phase 5 / Decision D2**. Replies: manual "Log reply" button (writes `email_received` activity) in Phase 3; automated inbound matching deferred.
5. **Suppression.** Respect `Prospect.optedOutAt`/`bouncedAt`: disable Send + show a banner. Every outreach email includes an unsubscribe/opt-out line (B2B legitimate-interest basis; see K/§20).

---

## G. Activity timeline architecture

- **Storage:** one `ProspectActivity` row per interaction (types listed in C). Written by the relevant server action, never inferred.
- **Rendering:** reverse-chronological in the drawer, mirroring `activity/page.tsx:294-337` — a coloured badge per `type`, a one-line `summary`, optional `body`, actor name (resolve `actorUserId` → `User.name`), relative timestamp. `status_changed` renders "Contacted → Interested" from `metadata.fromStatus/toStatus`.
- **No duplication:** this replaces any need to push prospect events into the global `Event`/`Activity` stream. If we later want prospect actions in the platform-wide Activity page, we add a thin adapter — not now.

---

## H. Analytics / event tracking

Computed from `Prospect` (status + timestamps) and `ProspectActivity`. No `EventType`/`DailyMetric` migration in the core build. Event list (`type | trigger | actor | prospect | agency | metadata`):

```
prospect_created      | Add prospect / import / chain-add | superadmin | yes | -    | { source }
contact_added         | add contact                       | superadmin | yes | -    | { contactId, isDecisionMaker }
email_sent            | send follow-up                    | superadmin | yes | -    | { agentEmailLogId, followUpCount }
email_received        | log reply (manual)                | superadmin | yes | -    | { contactId }
call_logged           | log call                          | superadmin | yes | -    | { outcome }
note_added            | add note                          | superadmin | yes | -    | {}
status_changed        | change status                     | superadmin | yes | -    | { fromStatus, toStatus }
follow_up_scheduled   | schedule follow-up                | superadmin | yes | -    | { when }
follow_up_completed   | send/call clears due date         | superadmin | yes | -    | {}
converted             | convert to agency                 | superadmin | yes | yes  | { agencyId, source }
lost                  | mark lost                         | superadmin | yes | -    | { reason, revisitAt }
```

Funnel metrics (`getAcquisitionFunnel(range)`): prospects added, contacted (any `email_sent`/`call_logged`), replied, interested, trial/first-sale, active; reply-rate, interested-rate, first-sale conversion, avg time-to-first-sale (`convertedAt − createdAt`), avg contacts-before-first-sale (`followUpCount` at conversion), by-source and by-contact-method breakdowns, lost-reason distribution, time-in-stage (from `status_changed` timestamps). These render on the Prospects page (a "Acquisition" summary block) and can later surface a single insight tile in the CC overview/briefing (§18) — not a redesign.

---

## I. Conversion architecture (attribution that survives)

The rule: **the prospect keeps a hard link to the `Agency` it became**, and everything downstream is derived, never copied.

- `Prospect.convertedAgencyId → Agency.id` (`@unique`). Set once, on conversion.
- **Two conversion paths:**
  1. **Manual:** `convertProspectAction(prospectId, agencyId)` — pick the newly-created agency from a search. Simple, always works.
  2. **Auto-suggest (preferred, low-effort):** when a new agency + director is created via `createDirectorWithAgency` (`lib/auth/create-director-with-agency.ts:30-92`), match the director email / agency name / email-domain against open prospects and, on a confident match, stamp `convertedAgencyId` + `source` onto `Agency.signupSource` (currently unset there, :70-76). If unsure, surface a "Is this prospect X?" suggestion in the Prospects UI rather than guessing. (Decision D6 — how aggressive.)
- **Chain-sourced prospects** already have `sourceChainLinkId`; when that `ChainLink` is claimed (`claimedByUserId`/`claimedAt`), we can auto-convert the linked prospect to the claimer's agency.
- **Retention/revenue (derived):** for a converted prospect, join `Agency → PropertyTransaction` (by `agencyId`) to compute first/second/…/Nth transaction dates, transaction volume, and exchanged revenue (existing billing: `PropertyTransaction.billedAtExchange` / `lib/billing/*`). Milestones like "first→second→fifth→tenth" and time-between come from ordering that agency's transactions by `createdAt`/`exchangedAt`. Example surfaced in the drawer: *Cold outreach → Oakwood Estates → first sale 12 Aug → active → 47 transactions → £X exchanged.*

This means we store *only* the `convertedAgencyId` link; no agency/transaction data is duplicated into the prospect world.

---

## J. Import architecture (CSV)

No existing import UI — build new. Columns: Agency, Branch, Contact, Role, Email, Phone, Website, Location, Postcode, Source.

- **Parse:** upload → parse (browser or server; Decision D5 re `papaparse`) → normalise headers.
- **Validate per row:** required Agency; email format check; trim/normalise; unknown Source → `other`.
- **Preview before write:** a table marking each row **New / Duplicate / Invalid** with the reason. Duplicate detection per §15. Partial rows allowed (only Agency required); invalid rows skipped, not fatal.
- **Multiple contacts:** rows sharing the same agency (by dedupe key) collapse into one Prospect with several `ProspectContact`s; first becomes primary.
- **Confirm → `importProspectsAction`:** creates prospects/contacts in a transaction; writes `prospect_created` activities; returns a summary (created N, merged-contacts M, skipped-duplicate D, invalid I).
- No enrichment (company lookups etc.) in v1.

---

## K. Duplicate handling

Matching signals, strongest first: existing `Agency` (name / email-domain — means *already a customer*, not a prospect), existing `Prospect` (agencyName + postcode, or website/email domain), existing `ProspectContact` email, phone. Behaviour:
- **Already a TSP agency:** don't create a prospect; show "already active" and offer to open the `Agency`.
- **Prospect already exists:** offer to *merge the new contact into it* rather than create a second prospect.
- **Contact already exists:** skip the contact, keep the prospect.
- **Same agency, different branch:** allowed — distinct prospects keyed by branch/postcode (don't over-merge).

---

## L. Migration / backfill considerations

- Migrations (staging-first, `prisma migrate deploy`, per Law 3): create `Prospect`/`ProspectContact`/`ProspectActivity` + the three enums + two nullable back-relation columns (`Agency`, `ChainLink`). All additive; no existing-row rewrites.
- **Optional backfill:** seed prospects from current `ChainLink` stubs that were invited but never claimed (`inviteStatus in (SENT,BOUNCED)`, `claimedAt null`, `stubAgentEmail` present) — one-shot script, `source = chain`, `sourceChainLinkId` set. Registered per Law 15 with a deletion ticket.
- Phase 4 analytics may add `DailyMetric` prospect columns *only if* we want historical rollups; otherwise compute live. Prefer live first.

---

## M. Phased implementation

**Phase 1 — Core prospects + contacts.**
- Files: schema (3 models/enums), `app/actions/prospects.ts` (create/update/contacts), `lib/command/prospects.ts` (`getProspects`), `app/command/(protected)/prospects/page.tsx`, `ProspectsClient`/`ProspectTable`/`AddProspectForm`/`ProspectDrawer` (read + edit fields/status/notes), `CommandSidebar` nav.
- DB: create migration. Backend: CRUD actions. Frontend: All-prospects table + Add + drawer. Tracking: `prospect_created`, `status_changed`, `note_added`, `contact_added`.
- Tests: action-level (create/dupe-guard), superadmin gate, render smoke.
- Acceptance: can add a prospect with contacts, see it in the list, open the drawer, edit status/notes; non-superadmin is redirected.

**Phase 2 — Activity + follow-up queue.**
- Files: `ProspectActivityTimeline`, `LogCallDialog`, `FollowUpQueue`, `ProspectPipeline`, follow-up/call/schedule actions, `getFollowUpQueue`/`getPipeline`.
- DB: none (models exist). Tracking: `call_logged`, `follow_up_scheduled/completed`.
- Acceptance: log a call in seconds; set a follow-up date; it appears under Today/Overdue/Upcoming; timeline shows every action; pipeline view groups by status.

**Phase 3 — Email + instant follow-up.**
- Files: `FollowUpCompose`, `draftFollowUpAction`/`sendProspectEmailAction`, template set, "Log reply".
- DB: none (uses `AgentEmailLog`). Reuse `sendEmail`/`sendChainEmail` + `anthropic`.
- Tracking: `email_sent`, `email_received`.
- Acceptance: "Generate follow-up" produces an editable, on-brand draft grounded in the prospect's history; it never sends itself; Send logs the email, timelines it, bumps counts, suggests next follow-up; opted-out/bounced prospects can't be emailed.

**Phase 4 — Conversion + analytics + chain integration.**
- Files: `convertProspectAction` + auto-suggest hook in `create-director-with-agency.ts`, `getAcquisitionFunnel`, an "Acquisition" block on the Prospects page, `addChainStubAsProspectAction` + an "Add as prospect" control on `/command/chain-invites`, converted-agency revenue/transaction rollup in the drawer.
- DB: back-relations already added in Phase 1; conversion sets `convertedAgencyId`. Tracking: `converted`.
- Acceptance: converting links prospect↔agency; the drawer shows that agency's live transaction count + exchanged revenue; the funnel block shows added→contacted→replied→interested→first-sale→active with rates and by-source; a chain warm-lead can be added as a prospect in one click.

**Phase 5 — Import + refinements.**
- Files: `ProspectImportModal`, `importProspectsAction`/`previewProspectImportAction`, dedupe helpers; optional email open-tracking (migration) + `revisitAt` surfacing.
- Acceptance: CSV preview flags new/dup/invalid; import summary is accurate; multi-contact rows merge; revisit dates reappear in the queue.

---

## N. Risks / edge cases

- **PII / cold-outreach compliance.** Storing agents' names/emails for outreach: B2B legitimate-interest basis, but must support opt-out, honour bounces, and allow deletion/archive. Don't over-build compliance; don't design something obviously wrong (see §20).
- **No prospect open/reply signal out of the box** (`AgentEmailLog` gap). Sends are logged; opens/replies need Phase-5 work or manual logging. Set expectations.
- **Duplicate/merge correctness.** Over-merging branches, or failing to spot an existing agency, corrupts attribution. Keep dedupe conservative and always previewed.
- **Auto-conversion false positives.** Matching a new signup to the wrong prospect mis-attributes revenue. Prefer *suggest-and-confirm* over silent auto-link (Decision D6).
- **Sender reputation.** Cold email from `updates@thesalesprogressor.co.uk` risks spam classification and could dent transactional deliverability. Consider a separate sending identity/subdomain for outreach (Decision D1).
- **Scope creep into a CRM.** Guard the "not a bloated CRM" principle: no drag-kanban, no custom fields, no marketing automation in v1.
- **Two-tab / migration discipline.** New models = a migration; staging-first per Law 3.

---

## O. Final implementation checklist

**Phase 1**
- [ ] Add `Prospect`, `ProspectContact`, `ProspectActivity` + 3 enums + `Agency.prospect`/`ChainLink.prospects` back-relations to schema
- [ ] Create migration; apply to staging; verify green
- [ ] `app/actions/prospects.ts`: create/update prospect, add/update/primary contact, change status, add note (all `requireSuperAdmin` + `commandDb`)
- [ ] `lib/command/prospects.ts`: `getProspects(filter)`, `getProspectDetail(id)`
- [ ] `/command/prospects` route + `ProspectsClient` (search + status/source chips) + `ProspectTable`
- [ ] `AddProspectForm`, `ProspectDrawer` (view + edit fields/status/notes)
- [ ] `CommandSidebar` nav item; stat row (Total/Follow-ups due/Interested/Trials/Active)
- [ ] Tips (InfoTip) on stats + statuses; tsc clean; commit

**Phase 2**
- [ ] `ProspectActivityTimeline` + badge map; render in drawer
- [ ] `logProspectCallAction`, `scheduleFollowUpAction`, `completeFollowUpAction`, `addProspectNoteAction`
- [ ] `LogCallDialog` (outcome + notes + follow-up date; No-answer suggestions)
- [ ] `FollowUpQueue` (Today/Overdue/Upcoming/All) + `getFollowUpQueue`
- [ ] `ProspectPipeline` (status columns) + `getPipeline`

**Phase 3**
- [ ] `draftFollowUpAction` (Claude, context-grounded, template fallback)
- [ ] `FollowUpCompose` (editable To/Subject/Body, Generate button, template picker)
- [ ] `sendProspectEmailAction` → send + `AgentEmailLog` + `email_sent` activity + counts + next-follow-up suggestion
- [ ] Preset templates; opt-out/bounce guard; "Log reply"

**Phase 4**
- [ ] `convertProspectAction` + auto-suggest match in `create-director-with-agency.ts`
- [ ] Chain: `addChainStubAsProspectAction` + control on `/command/chain-invites`; auto-convert on claim
- [ ] `getAcquisitionFunnel` + Acquisition block on Prospects page
- [ ] Converted-agency transaction/revenue rollup in the drawer (join Agency→PropertyTransaction)

**Phase 5**
- [ ] `previewProspectImportAction` + `importProspectsAction` + `ProspectImportModal`
- [ ] Dedupe (agency/domain/email/postcode) + merge-contact flow + import summary
- [ ] Optional: `revisitAt` surfacing; email open-tracking (migration)
- [ ] Optional backfill script: chain stubs → prospects (SCRIPTS_REGISTRY + deletion ticket)

---

# Decisions (LOCKED 2026-08-29)

1. **Sender identity:** send from `ellis@thesalesprogressor.co.uk` (already verified/set up), with Ellis's signature image in the HTML footer. Not the transactional `updates@`.
2. **Tracking: maximum.** Build full outbound + reply tracking from the start (not deferred). New `ProspectEmail` model records `sentAt / deliveredAt / openedAt / clickedAt / bouncedAt / repliedAt` + `sgMessageId`. Opens/clicks/bounces via the SendGrid webhook (extend `app/api/webhooks/sendgrid-bounce` to stamp `ProspectEmail` by a `customArgs.prospectEmailId`, sends use `trackOpens: true` + click tracking). Replies via **SendGrid Inbound Parse** → a new `app/api/webhooks/sendgrid-inbound` route that matches the reply to a prospect (by Reply-To token / recipient) and stamps `repliedAt` + writes an `email_received` activity. Ellis will set up Inbound Parse (MX record + webhook URL) during Phase 3. Every signal also writes a `ProspectActivity` row.
3. **Conversion:** suggest-and-confirm; silent auto-link only for unambiguous chain claims.
4. **Follow-ups:** `nextFollowUpAt` field on `Prospect` (not `ManualTask`).
5. **AI model:** Haiku (`claude-haiku-4-5-20251001`) with a template fallback; AI in from Phase 3.
6. **CSV:** add `papaparse`.
7. **Pipeline:** read-only status columns (no drag-and-drop) in v1.

Impact on the plan: replace the `AgentEmailLog`-only logging in §F with the `ProspectEmail` model + webhook/inbound wiring (still additive; Phase 3). §C gains `ProspectEmail`. Sender default becomes `ellis@thesalesprogressor.co.uk` + signature asset (Phase 3). Everything else stands.

---

# Decisions Needed Before Build (original — now resolved above)

Only the calls that materially change implementation:

1. **Outreach sender identity.** Send prospect emails from the platform default `updates@thesalesprogressor.co.uk`, from *you* (Ellis) personally, or from a separate outreach subdomain/identity to protect transactional deliverability? (Affects `sendProspectEmailAction` + SendGrid config. Recommendation: a distinct outreach sender/subdomain.)
2. **Email open/reply tracking scope for v1.** Log sends only (simplest), or invest in open-tracking + reply capture now (needs a migration to give `AgentEmailLog` an `openedAt`/webhook join, plus inbound matching)? Recommendation: sends-only in Phase 3, open-tracking in Phase 5.
3. **Follow-ups: field vs task.** A `nextFollowUpAt` field on `Prospect` (simple, self-contained queue) vs reusing `ManualTask` so prospect follow-ups appear in the existing internal to-do list. Recommendation: field on Prospect (lighter); revisit if you want one unified task list.
4. **AI model + always-on?** Haiku (`claude-haiku-4-5-20251001`, cheap) vs Opus (`claude-opus-4-8`, better prose) for drafts; and is the "Generate follow-up" AI in from Phase 3, or do we ship templates-only first and add AI after? Recommendation: Haiku, AI from Phase 3 with a template fallback.
5. **CSV parsing dependency.** Add `papaparse` (robust, handles quoting/edge cases) or hand-roll a minimal parser for the known 10-column set? Recommendation: `papaparse` (import is common enough to warrant it).
6. **Auto-conversion aggressiveness.** On new-agency signup, silently auto-link a confidently-matched prospect, or always *suggest-and-confirm*? Recommendation: suggest-and-confirm (avoids mis-attributed revenue), with silent auto-link only for chain-sourced prospects where the `ChainLink` claim is unambiguous.
7. **Pipeline interaction.** Read-only status columns (status changes via the drawer/quick actions) vs drag-and-drop kanban. Recommendation: read-only in v1 (keeps it lightweight, avoids a DnD dependency).
