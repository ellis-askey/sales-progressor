# SP Permissions + Admin Mixed-Files Audit

**Date:** 2026-05-18  
**Status:** Audit only — no implementation. Ellis reviews and decides which items proceed.

---

## SECTION 1 — SP OVER-RESTRICTIONS

Directive: SP is the operational owner of their assigned files. Long leash. The bar for restricting SP is high — must have a clear justification (commercial relationship with agency, brand/compliance risk, or technical gap). "We haven't thought about it" is not a justification.

---

### SP-01 — SP can't send chase communications

**Page:** Work queue (`/agent/work-queue`)  
**Component:** `AgentRemindersList.tsx` → `SideColumn`

**What this means in practice:** When SP has a reminder due — say, "Chase the buyer's solicitor for their mortgage offer" — they can mark it done, snooze it, or escalate it, but they cannot actually send a chase email or generate a chase message. The "Chase" button is completely hidden. If SP needs to chase, they have to do it outside the system (a manual email from their own inbox, not logged) or ask admin to send it.

**Why it's currently restricted:** The Chase API routes (`/api/chase/send-email`, `/api/ai/generate-chase`) fail for SP because they use raw `agencyId` equality checks — this is a backend bug logged as FU-17. The Chase button was hidden as an interim fix rather than shipping a broken button.

**Judgement:** Overly cautious, but not fixable without a backend fix first. The interim hide is the right call for now. But fixing FU-17 and un-hiding Chase for SP should be the very next SP permissions item after WS3 ships. SP managing outsourced files and not being able to send chase communications is a significant operational gap — that's a core part of the job.

**Question for Ellis:** When FU-17 is fixed, should SP see the full Chase drawer (generate AI chase + send email) the same as an agent would? Or should SP's chases go through a different path (e.g., internal chase note rather than client-facing email)?

---

### SP-02 — SP can't edit sale details (too broad a restriction)

**Page:** Transaction detail (`/agent/transactions/[id]`)  
**Component:** `TransactionSidebar.tsx`, gated by `canEditSaleDetails={!isProgressor}` from page.tsx

**What this means in practice:** SP cannot change anything in the "Edit details" drawer on a file they're managing. This includes:
- The property address (if it was typed wrong by the agent)
- The purchase type (leasehold / freehold — matters for milestone routing)
- The tenure
- The predicted exchange date and predicted completion date (key planning fields)
- The offer accepted date and memo of sale date

If a property address was entered incorrectly, SP has to flag it to admin to fix. If the predicted exchange date shifts (the most common thing that happens on a progressing file), SP can't update it themselves.

**Why it's currently restricted:** FU-11 — the `EditSaleDetailsDrawer` also contains the agent fee field, referral fee, and other commercial fields that are the agency's financial arrangement, not SP's concern. Rather than hide individual fields, the whole drawer was hidden for SP.

**Judgement:** Too broad. The fee fields are legitimately restricted. Everything else (address, tenure, purchase type, key dates) is operational data that SP needs to keep accurate. The drawer should be visible for SP but with the commercial fields (agent fee, referral fee, price agreed) hidden or read-only within it. This is achievable by passing `hideCommercialFields={isProgressor}` into the drawer.

**Question for Ellis:** Should SP be able to edit the purchase price (the agreed sale price)? Price changes happen (renegotiated after survey). SP would know about them from client communication. Feels like yes, but flagging as a question.

---

### SP-03 — SP can't compose emails on a file

**Page:** Transaction detail (`/agent/transactions/[id]`)  
**Component:** `ActivityTimeline.tsx` / ComposeEmail section, gated by `{!isInternal && <ComposeEmail ... />}`

**What this means in practice:** On the "Activity" tab of a file, agents can compose and send emails to contacts on the file (via SendGrid, tracked in the timeline). SP can't access this compose UI at all. If SP needs to send a formal communication to a buyer or seller, they have to do it from their own email client, outside the platform, untracked.

**Why it's currently restricted:** FU-12 — SP accounts don't have a verified SendGrid sender identity set up. The compose UI would render but email sends would fail at the API level. Hidden as an interim measure, same logic as Chase.

**Judgement:** Correct to hide while sender isn't configured. But like Chase, this is an ops/config gap rather than a principled restriction. SP should be able to compose and send emails on their assigned files. Add to the "fix after WS3" list alongside FU-17.

**Question for Ellis:** When SP's SendGrid sender is configured, what should the "from" address be? `updates@thesalesprogressor.co.uk`? Or something SP-specific? This is an ops setup question, not a code question.

---

### SP-04 — SP can't see the service type badge on the file header

**Page:** Transaction detail (`/agent/transactions/[id]`)  
**Component:** `PropertyHero.tsx`, gated by `hideServiceTypeBadge={isProgressor}`

**What this means in practice:** When SP opens a transaction, they don't see the badge that says "Outsourced" or "Self-managed" on the file header. The badge was hidden on the assumption that SP only works on outsourced files — so the badge is redundant.

**Judgement:** Technically correct logic, but mildly odd. In practice, SP may navigate to a file via a direct link or search and briefly wonder which type it is. The badge costs nothing to show. Probably fine to un-hide it — "Outsourced to us" is confirmation, not noise. Low-stakes either way.

---

### SP-05 — SP can't change the file's status (on hold / withdrawn)

**Page:** Transaction detail (`/agent/transactions/[id]`)  
**What this means in practice:** If a buyer goes quiet for three weeks, SP (who is talking to the parties every day) cannot mark the file as "on hold" themselves. They'd need to ask admin. Similarly, if a sale falls through, SP can't mark it withdrawn — admin has to do it.

**Uncertainty:** The agents didn't find a specific status control gate for SP. It's unclear whether status changes are currently available to SP or not. This needs a direct code check.

**Question for Ellis:** Should SP be able to change file status (active → on hold, active → withdrawn)? Given the "long leash" directive, the answer feels like yes. SP is the one with eyes on the file.

---

### SP-06 — SP can't manage the buyer/seller portal

**Page:** Transaction detail (`/agent/transactions/[id]`)  
**What this means in practice:** The portal tab lets agents share access to the portal with buyers and sellers, revoke access, send portal invite links, etc. It's unclear whether SP can do any of this on their assigned files.

**Uncertainty:** Not confirmed by the audit agents. Needs a direct check of `PortalManagement` or equivalent component and whether it's gated for SP.

**Question for Ellis:** Should SP be able to invite buyers and sellers to the portal and manage their access on assigned files? Given that SP is the day-to-day manager of the file, this feels like yes.

---

### SP-07 — SP can't upload documents to a file

**Page:** Transaction detail (`/agent/transactions/[id]`)  
**What this means in practice:** If SP receives a signed document (mortgage offer, searches, survey report) that they need to log against the file, it's unclear whether they can upload it. Document upload is a core part of managing a progressing file.

**Uncertainty:** Not specifically audited. Needs a check of the documents tab component and whether upload actions are gated.

**Question for Ellis:** Should SP be able to upload documents to their assigned files?

---

### SP-08 — SP can't add manual communication notes

**Page:** Transaction detail (`/agent/transactions/[id]`) — Activity tab  
**What this means in practice:** When SP has a phone call with a solicitor, they should be able to log it against the file — "Spoke with Smith Jones re: enquiries, chasing response by Friday." The "Log activity" / manual comm note button may be available to agents but potentially hidden for SP.

**Uncertainty:** Depends on whether `ActivityTimeline`'s manual comm entry is gated by `isInternal`. Needs a direct check.

**Question for Ellis:** SP logging manual call notes is a core operational workflow. Should be allowed.

---

### SP-09 — SP can't escalate within the Chase path (minor, linked to SP-01)

**Page:** Work queue  
**What this means in practice:** The Escalate action marks a chase task as "escalated" and changes its urgency display. SP can escalate (Package D scoping confirmed — backend allows it). But since the Chase CTA is hidden, SP can't advance a chase task through the normal chase-then-complete path. They can only mark done or snooze.

**Judgement:** This is a side-effect of SP-01 (Chase hidden). Fix SP-01 and this resolves. Not a separate restriction.

---

### Summary: SP restrictions assessment

| # | Restriction | Verdict | Priority |
|---|---|---|---|
| SP-01 | No Chase comms (work queue) | Fix after FU-17 backend | High — but blocked on API fix |
| SP-02 | No Edit sale details (too broad) | Fix: allow op fields, hide fee fields | High — SP needs to update dates/address |
| SP-03 | No ComposeEmail (no verified sender) | Fix after sender configured | Medium — ops dependency |
| SP-04 | Service type badge hidden | Low-stakes, probably un-hide | Low |
| SP-05 | Can't change file status | Needs confirmation + fix | High if confirmed blocked |
| SP-06 | Can't manage portal access | Needs confirmation + fix if blocked | Medium |
| SP-07 | Can't upload documents | Needs confirmation + fix if blocked | Medium |
| SP-08 | Can't log manual comm notes | Needs confirmation + fix if blocked | High |

Items SP-05, SP-06, SP-07, SP-08 need a direct code audit of the transaction detail components before a verdict can be given.

---

## SECTION 2 — ADMIN MIXED-FILES PROBLEM

Background: Admin's daily work is **outsourced** files — the files our internal team (SP) actively progresses on behalf of agencies. **Self-managed** files are ones the agency runs themselves without our involvement. Admin knows self-managed files exist, but doesn't action them. The `txWhere(vis)` helper for `admin_all` currently returns `{}` — no serviceType filter anywhere. This means self-managed files appear in every admin view by default.

---

### AM-01 — Hub: all stats include both file types

**Page:** Hub (`/agent/hub`)  
**Service:** `getHubPipelineStats()`, `getHubMomentum()`, `getHubWeeklyForecast()` in `lib/services/hub.ts`

**What this means in practice:** The hub is the first thing admin sees every day. The "active files" count, pipeline value, momentum ring (exchanges this month vs last), exchange forecast, and "needs your attention" section all include self-managed files. If an agency has 80 self-managed files and we're progressing 20 outsourced ones, admin's hub says "100 active files" and the pipeline value is 5× what's actually relevant to admin's team. The "needs your attention" section may include reminders and escalations on files admin has nothing to do with.

**Proposal:** **(1) Filter to outsourced by default.** Add `serviceType: "outsourced"` to the `admin_all` branch in hub's `getHubAttentionItems`, `getHubPipelineStats`, `getHubMomentum`, and `getHubWeeklyForecast`. The service split card can remain (it exists specifically to show the outsourced/self-managed ratio) — but the operational stats should reflect admin's actual workload. A toggle or link to the full platform view can be added later if needed.

**Severity:** High. The hub is the daily starting point. If it shows inflated numbers, admin gets a skewed picture of their team's workload every day.

---

### AM-02 — Work queue: reminders from self-managed files mixed in

**Page:** Work queue (`/agent/work-queue`)  
**Service:** `getAgentReminderLogs(vis)` in `lib/services/reminders.ts`

**What this means in practice:** The reminders page shows chase tasks. Self-managed files generate their own reminders — but those are the agency's responsibility, not ours. Admin doesn't chase self-managed files. If those reminders show up in admin's work queue (overdue, due today, coming up counts), admin is looking at a list of things that aren't their problem. Note: the work queue is already removed from admin's nav (our WS3 change), but it's accessible by URL. If admin navigates there, the view is polluted.

**Context:** SP's version correctly filters to `serviceType: "outsourced"` in the `assigned` branch. Admin's `admin_all` branch has no equivalent filter. Inconsistency.

**Proposal:** **(1) Filter to outsourced by default.** Add `serviceType: "outsourced"` to the `admin_all` branch in `getAgentReminderLogs`. If admin ever needs to see all platform reminders, that's a separate admin-specific report view, not the work queue.

**Severity:** Medium. Work queue is hidden from admin nav, so this is a URL-only issue for now.

---

### AM-03 — Transaction list: all file types mixed by default

**Page:** Transaction list (`/agent/transactions`)  
**Service:** `listTransactions`, `countTransactionsByStatus` in `lib/services/transactions.ts`

**What this means in practice:** When admin lands on the "All Files" page, they see every active transaction across every agency — both outsourced and self-managed, mixed together in one list. There's a "Service type" filter chip available (our WS3 addition), so admin can filter to just outsourced. But they have to remember to do it every visit. The tab counts (active: 234, on_hold: 12, etc.) are also inflated.

**Proposal:** **(2) Show both but separate — or accept as-is with the existing filter chip.**  
The filter chip we added in WS3 already solves the navigation problem — admin can filter to "Outsourced to us" on their first visit and the URL persists. Defaulting to outsourced requires adding `serviceType: "outsourced"` to the default filter state, which is a small change. The question is whether we want to "remember" the filter or make outsourced the hard default.

Alternative framing: change the admin's default filter from "all" to "outsourced" by adding `serviceType: "outsourced"` to the initial filter state in the component (or via a URL default redirect). Then "show all" becomes the explicit action rather than "show outsourced."

**Severity:** Medium. Filter exists; it's a default UX question, not a broken query.

---

### AM-04 — Exchange forecast: includes self-managed file exchange dates

**Page:** Transaction list (`/agent/transactions`) — ForecastStrip  
**Service:** `getExchangeForecast` in `lib/services/transactions.ts`

**What this means in practice:** The forecast strip at the top of the transaction list shows how many files are expected to exchange each month (e.g., "Jan: 4, Feb: 7, Mar: 2"). For admin, this strip is supposed to help plan workload. But the month counts include self-managed files — so "7 exchanging in Feb" might mean 5 outsourced (SP needs to action) and 2 self-managed (agents will handle themselves). Admin uses this for capacity planning, so the distortion matters.

**Proposal:** **(1) Filter to outsourced by default.** Admin's forecast should reflect the outsourced pipeline — the volume SP needs to drive to exchange. `getExchangeForecast` should add `serviceType: "outsourced"` to the admin_all where clause.

**Severity:** Medium. Planning tool distorted by including files admin doesn't progress.

---

### AM-05 — Completions: self-managed completed files mixed in

**Page:** Completions (`/agent/completions`)  
**Service:** `getAgentCompletions(vis)` in `lib/services/agent.ts`

**What this means in practice:** The completions page shows all exchanged files heading toward completion. For admin, this includes files the agencies managed themselves. Those files complete without any SP involvement — admin has nothing to do on them. If a large agency has 40 self-managed files and 10 outsourced ones, admin's completions list is 80% noise. The "Set date" button on self-managed completions is an affordance admin probably shouldn't be exercising (the agent should set their own completion dates).

**Proposal:** **(1) Filter to outsourced by default.** Add `serviceType: "outsourced"` to the `admin_all` branch in `getAgentCompletions`. Admin sees the completions they're managing. Self-managed completions aren't admin's scheduling responsibility.

**Severity:** Medium-high. Admin setting completion dates on self-managed files is confusion-inducing. The primary signal (our outsourced pipeline completing) is diluted.

---

### AM-06 — Comms/Updates: milestone feed includes self-managed activity

**Page:** Updates (`/agent/comms`)  
**Service:** `getAgentMilestoneActivity(vis)` in `lib/services/agent.ts`

**What this means in practice:** The Updates feed shows milestone completions ("Vendor side: Exchange completed", "Purchaser side: Survey received") across all files. For admin, this includes milestones on self-managed files that agents are confirming themselves. Admin sees a stream of updates from files they had no involvement in. The feed becomes a digest of the whole platform rather than the outsourced business admin is running.

**Proposal:** **(1) Filter to outsourced by default.** Add `serviceType: "outsourced"` to the `admin_all` branch in `getAgentMilestoneActivity`. Admin's activity feed should show what their team (SP) is progressing. Note: this is a judgment call — admin might want to see all platform activity as a senior oversight role. Flag as a question.

**Question for Ellis:** Does admin want a curated feed of outsourced file activity (the team's work), or a full platform digest (all milestone activity everywhere)? These are genuinely different oversight models.

**Severity:** Medium. Feed usability degrades with volume; today with few files it may be fine.

---

### AM-07 — Analytics: all metrics include both file types

**Page:** Analytics (`/agent/analytics`)  
**Service:** `getAgentTransactions`, `getMonthlyActivity`, `getKpiTrendsForAgency`, `getSolicitorExchangeStats`, `getFilesAtRisk` in `lib/services/analytics.ts`

**What this means in practice:** Every analytics metric — pipeline value, conversion rate, time-to-exchange, monthly volume, files at risk — includes both outsourced and self-managed files. Admin looking at their team's performance sees a number that includes the agencies' self-service work. Practical example: if 60% of active files are self-managed, admin's "time to exchange" average is dominated by files SP has nothing to do with.

**Proposal:** **(1) Filter to outsourced by default** for admin's analytics. Admin's analytics should answer "how is our outsourced business performing?" not "how is the whole platform performing?" The latter is a command-centre question, not an agent-app question. `buildTxWhere(vis)` in analytics.ts should add `serviceType: "outsourced"` for the `admin_all` branch.

**Severity:** High. Analytics is used to evaluate performance and make decisions. Polluted metrics lead to wrong conclusions about the outsourced business.

---

### Root cause and a single-line fix option

All seven admin mixed-files problems share the same root cause: `txWhere(vis)` and `buildTxWhere(vis)` return `{}` for `admin_all` — no serviceType clause. The minimal fix for all of them is adding `serviceType: "outsourced"` to the `admin_all` branch in both helpers. That single change would propagate to every query across every page.

**Risk of the single-line fix:** Admin can no longer easily see self-managed files in their default views. Self-managed files become a filter-away rather than visible by default. Whether that's the right model depends on Ellis's answer to the oversight question (AM-06).

**Alternative:** Instead of modifying `txWhere`, add a `serviceTypeFilter?: "outsourced" | "self_managed"` parameter to each service function and call with `"outsourced"` for admin views explicitly. More surgical, more code.

**Question for Ellis:** Is the single-line fix (default admin to outsourced everywhere) the right call, or does admin need to see self-managed files in some views and only outsourced in others?

---

### Admin mixed-files summary

| # | Page/view | What's diluted | Severity | Proposal |
|---|---|---|---|---|
| AM-01 | Hub (all stats) | Pipeline count, value, momentum, forecast | High | Filter outsourced by default |
| AM-02 | Work queue (reminders) | Chase task list and overdue counts | Medium | Filter outsourced by default |
| AM-03 | Transaction list (default) | File list and tab counts | Medium | Change default filter, or accept with existing chip |
| AM-04 | Transaction list (forecast) | Monthly exchange forecast for planning | Medium | Filter outsourced by default |
| AM-05 | Completions | Completion tracking list | Medium-high | Filter outsourced by default |
| AM-06 | Comms/Updates | Milestone activity feed | Medium | Question: curated vs digest |
| AM-07 | Analytics (all metrics) | Every performance metric | High | Filter outsourced by default |

---

## Items that need a direct code check before verdict

The following SP items couldn't be confirmed as restricted or permitted from the available audit — they need reading specific components:

1. **SP-05 — File status changes:** Is there a status control (active/on hold/withdrawn) on the transaction detail page, and is it gated for SP?
2. **SP-06 — Portal management:** Is the portal tab/section gated for SP?
3. **SP-07 — Document uploads:** Is document upload gated for SP?
4. **SP-08 — Manual comm notes:** Is "Log activity" / manual note entry gated for SP?

These four require reading the relevant components in `app/agent/transactions/[id]/` and `components/transaction/`.

---

## Total findings

- **SP restrictions:** 8 items (4 confirmed, 4 pending code check)
- **Admin mixed-files:** 7 items across 6 pages
- **Root cause for admin:** Single `{}` in `txWhere` for `admin_all` — seven problems, potentially one fix
- **Biggest open question:** Should admin's default everywhere be outsourced-only, or do they need both in some views?
