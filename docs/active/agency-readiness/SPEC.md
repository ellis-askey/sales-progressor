# Agency Email Readiness — spec

Status: planned (2026-08-31). Scope locked with founder.
Owner: Command Centre + agent onboarding.

## Why

Agencies aren't reliably getting their email set up (sender address + domain
authentication). Until they do, mail either sends from the shared Sales
Progressor fallback or risks poor deliverability, and the founder has to chase
each agency manually. There is no single place to **see** which agencies are
set up, and no in-app nudge to get agencies to **do** it themselves.

This adds (1) a per-agency email-readiness view in the Command Centre so the
founder can see and chase gaps, and (2) a step in the existing agent onboarding
checklist so agencies complete it themselves.

## Scope (locked)

- **Tracked items:** email sender set + sending domain authenticated (DNS /
  DKIM / SPF). Outbound only.
- **CC home:** the existing `/command/agencies` hub (not a parallel page).
- **Goal:** both visibility (CC) and completion (agent self-serve nudge).

Explicitly **out of scope** for now (can be added later):
- Email **ingestion** readiness (replies landing on files). Ingestion is
  per-user Outlook / WhatsApp and has **no agent-facing connect UI** today
  (only `/command/settings/connections`, superadmin). Adding it would be a
  larger Phase 3 that first needs an agent-facing connect flow.
- First-sale / team-invited / branding / automations / fee-tier rows.

## What already exists (reuse, do not rebuild)

- **`Agency.quoteSenderEmail`** — sender set signal. Resolved via
  `lib/email/agency-sender.ts`.
- **`VerifiedDomain`** (`prisma/schema.prisma` ~line 2060) — per-agency domain
  auth: `status` (pending | verified | failed | removed), `dkimValid`,
  `spfValid`, `lastCheckedAt`, `verifiedAt`. Verdict comes from SendGrid via
  `lib/services/sendgrid.ts`; re-validated nightly by
  `app/api/cron/check-domains/route.ts`.
- **`components/command/email-senders/AgencyDomainAuth.tsx`** — a working
  per-agency domain-auth cell (status pill, DKIM/SPF ticks, CNAME setup modal).
  The CC checklist's domain row DELEGATES to this; no reimplementation.
- **`/command/agencies`** (`app/command/(protected)/agencies/page.tsx`) — the
  agency hub with a per-agency usage table + `StatusPill`. New readiness pill
  sits beside the usage one.
- **`components/command/ui/primitives.tsx`** — canonical CC kit (Section,
  KpiCard, TableShell, InsightCard, TrackingDisabled). Build the surface from
  this. There is no shared status-pill primitive yet — add one here.
- **Agent self-serve already exists:** `app/(account)/agent/account/profile`
  → `components/verified-emails/SendingAddressesSection.tsx` (domain auth + DNS
  + sender) and `app/api/agent/verified-emails/domain/[id]/check/route.ts`.
- **Agent onboarding checklist:** `components/agent/OnboardingChecklist.tsx`
  (+ `OnboardingChecklistView.tsx`, `/api/agent/onboarding-progress`). Reuse
  its `progressKey` pattern; adding a step is cheap (it already polls, event-
  buses, and fires PostHog).

No schema change is required — every signal is already stored.

## Phase 1 — Command Centre: per-agency email readiness

1. **Service** `lib/command/agency-readiness.ts` → `getAgencyEmailReadiness()`.
   Returns, per agency:
   - `senderSet: boolean` (`quoteSenderEmail != null`)
   - `domain: { domain, status, dkimValid, spfValid, lastCheckedAt } | null`
     (latest `VerifiedDomain` for the agency)
   - `level: "ready" | "setting_up" | "not_started" | "broken"`
     - ready = sender set AND a verified domain
     - setting_up = a pending domain, or sender set but domain not yet verified
     - broken = latest domain status is failed
     - not_started = neither
2. **Aggregate KpiCard** at the top of the agency hub: "N of M agencies
   email-ready" (from the service).
3. **Readiness pill column** on the "By agency" table, beside the usage
   `StatusPill`. States → Ready (good) / Setting up (watch) / Not set
   (neutral) / Broken (bad). Add a shared `StatusPill` to `primitives.tsx`.
4. **Expandable per-agency panel** (row expander): a two-row checklist in the
   CC visual system, reusing `OnboardingChecklistView`'s shape:
   - Row "Sender email" — done when `quoteSenderEmail` set; shows the address.
   - Row "Domain authentication" — renders the existing `AgencyDomainAuth`
     cell (setup modal, DKIM/SPF, CNAME copy, last checked).
   Each unfinished row states who is blocked (agency must add DNS records / you
   must verify) with the direct action.

All read-only against existing data; no migration.

## Phase 2 — Agent app: drive agencies to complete it

The self-serve UI already exists; the gap is agencies aren't sent to it.

1. **New checklist step** in `OnboardingChecklist` / `OnboardingChecklistView`:
   "Set your email to send from your agency" → deep-links to
   `account/profile` sender section. New `progressKey: "hasVerifiedSender"`,
   computed in `/api/agent/onboarding-progress` from `quoteSenderEmail` +
   whether the agency has a `verified` `VerifiedDomain`. Lives in the "Finish
   setup" group.
2. **(Optional) director hub prompt** — a dismissible `InsightCard` on the
   agent hub when the agency has no authenticated sending domain, linking to
   the setup. Reuses the existing card + dismissal patterns.

## Definition of done

- CC: readiness pill + aggregate + expandable checklist on `/command/agencies`,
  reading real state; domain row is the existing `AgencyDomainAuth`.
- Agent: the new checklist step appears, completes correctly against live data,
  and deep-links to the working self-serve surface.
- `tsc` clean; no em-dashes in strings; CC visual system respected; multi-tenant
  reads go through `commandDb` (CC) / scoped queries (agent). No schema change.

## Open question for founder

- Do you also want the checklist to reflect **inbound ingestion** (replies
  landing on files)? If yes, that's Phase 3 and needs an agent-facing
  mailbox-connect flow first (today only the Command Centre can connect one).
