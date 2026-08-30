# Partners rebuild — scope

**Status:** spec / not started
**Opened:** 2026-08-30
**Owner:** Ellis
**Law 1 note:** No prior spec existed for the Partners page. This doc is the source of truth for the rebuild. Surface any contradiction with the codebase rather than reconciling silently.

---

## Why

The Partners page (`/agent/partners`) is the least-finished surface in the app.

- **For agents** it is solicitor-only and mostly read-only: a flat list of solicitor firm cards plus two director-only settings cards (preferred broker, recommended solicitors). Brokers never appear in the directory. No search, no sort, no performance, no referral income, no firm history, no click-through.
- **For internal staff** (`sales_progressor` / `admin` / `superadmin`) it is a structural dead end. The nav item is ungated so they reach the page, but `resolveAgentVisibility` returns `seeAll: false` for them (agencyId = null, not a director), the directory query filters on `agentUserId = <their id>` which matches zero files, and they get the "No solicitor firms yet" empty state every time.

Most of the intelligence this page should show already exists — it is just siloed in Analytics and never routed here.

## Current-state map (verified 2026-08-30)

Page: `app/agent/partners/page.tsx`
- Directory service: `getSolicitorDirectoryForAgent(vis)` — `lib/services/solicitors.ts:22`
- Visibility: `resolveAgentVisibility` — `lib/services/agent.ts:24` (no `internalMode`; the internal-aware `resolveInternalVisibility` at `agent.ts:42` is NOT called here)
- Nav item ungated: `components/layout/AgentShell.tsx:71`
- `/agent/solicitors` is a redirect stub to `/agent/partners`.

Already-computed intelligence, currently Analytics-only:
- `getSolicitorExchangeStats(vis)` — avg days to exchange + exchange count per firm — `lib/services/analytics.ts:346`
- `getReferralStats(agencyId)` — solicitor referral income earned/pending per firm — `analytics.ts:213`
- `getBrokerReferralStats(agencyId)` — broker referral income per firm — `analytics.ts:255`
- Visual reference for firm rows / income sections: `components/agent/AnalyticsClientShell.tsx`

Data model (schema `prisma/schema.prisma`):
- `SolicitorFirm` (882) global/shared, unique name; `SolicitorContact` (913) many per firm, has `secondaryEmail` + `image`.
- `BrokerFirm` (936) per-agency, has `website`; `BrokerContact` (948) many per firm.
- `AgencyRecommendedSolicitor` (898) + `AgencyPreferredBroker` (961, one per agency) hold default referral fees.
- Transaction fields: `referredFirmId`, `referralFee`, `referralFeeReceived`, vendor/purchaser solicitor firm+contact slots, `brokerFirmId`/`brokerContactId`/`brokerReferralFee`/`brokerReferralFeeReceived` (tx model 286; fields ~350-361).

CRUD already live (reuse, do not rebuild — Law 4):
- `app/actions/solicitors.ts`, `app/actions/brokers.ts`, `app/actions/transactions.ts` (`saveReferralAction`/`saveBrokerReferralAction`)
- `app/api/solicitor-firms/**`, `app/api/broker-firms/**`, `app/api/solicitor-handlers/[id]/route.ts`

## Locked decisions (2026-08-30)

1. **Brokers in the directory — YES.** Brokers become full partner cards alongside solicitors (handlers, active files, referral income). The page becomes a true "all partners" view.
2. **Firm detail surface — YES.** A firm is clickable through to a detail view: every file (active + completed), full contact roster, exchange + referral history.
3. **Internal scope — follow access-scope (Law 7).** `admin`/`superadmin` see all firms platform-wide (cross-agency aggregate); `sales_progressor` sees firms on assigned files only. Internal view must route through `lib/security/access-scope.ts`, NOT the current `agentUserId` filter.
4. **Commercial-data policy.** Referral £ (income earned/pending per firm) is hidden from `sales_progressor` — **except** the `ellis@thesalesprogressor.co.uk` account, which sees it. `admin`/`superadmin` always see it. Directors see their own agency's figures as today.

## Out of scope (for now)

- Firm-level messaging / bulk email to partners.
- Per-handler (contact-level) income breakdown — firm-level only, matching existing analytics.
- Any change to the referral-fee editing model on files.
- Deleting firms (only add / recommend / attach exists today; keep it that way).

## Phasing (one concern per PR — Law 5)

- **PR0 — this spec.** No code. ✅ shipped (17f88c95).
- **PR1 — agent directory: brokers + intelligence on cards.** Bring brokers into the directory as a section; surface avg-days-to-exchange, active file count, and (director-only) referral income on each firm card by routing the existing analytics services here. No new computation. ✅ shipped (129a0947).
- **PR2 — search / sort / filter + firm detail surface.** Name search, sort (most-active / fastest-exchange), and the click-through firm detail view. ✅ shipped (47e91a9a + voice fix 9dd0f232).
- **PR3 — internal cross-agency view.** Access-scope-aware directory + intelligence for internal staff; commercial-data policy from decision 4. ✅ shipped (d02db234). Added `getSolicitorDirectoryForScope` / `getBrokerDirectoryForScope` / `*FirmDetailForScope` and `getSolicitorExchangeStatsForScope` / `getReferralStatsForScope` / `getBrokerReferralStatsForScope` (where-parameterised cores; agent callers delegate). Referral income gated on `hasAdminPowers`.
- **PR4 — motion / voice / polish pass.** Staggered entrance, loading/empty/first-time states, voice pass (Law 21), migrate ad-hoc inline styles toward canonical primitives where safe (grandfather anything risky — Law 19). Not started.

## Verification debt (open)

Visual verification is outstanding for PR1–PR3: the dev server on :3001 went down mid-arc and there are no test credentials on this machine, so nothing has been rendered live. tsc is clean throughout. Needs a browser pass as (a) director, (b) admin/superadmin, (c) plain sales_progressor, plus an out-of-scope deep-link 404 check.

## Open risks

- The current directory service is agent-scoped by `agentUserId`; the internal view needs a parallel access-scope-aware path. Do not overload the existing function — add a sibling.
- Referral £ is commercial-sensitive; the Ellis-email override must be enforced server-side, not just hidden in the UI.
- Firm detail pulls completed files too — watch query cost on firms with long histories (scope / paginate if needed).
