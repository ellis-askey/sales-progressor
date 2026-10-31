# Findings Register

Updated 2026-10-31. Ordered by severity. Statuses: Confirmed / Likely / Possible / Needs clarification / Not tested.

## Reconciliation note (2026-10-31)
Fix batches 1 and 2 are **no longer "staging, not pushed" — all seven commits are live in production** (staging == origin/master == `e686a350`, 30 Oct). They carry passing unit tests but have **not** been behaviourally run-through. So the fixed items below read "FIXED (live, not behaviour-tested)".

## Founder decisions — batch 1 of 10 (2026-10-31)
- **MILE-002 / BL-001** (correction email after undone exchange): **A — no correction email.** Cancelling unsent queued emails (already live) is enough; an exchange has never been cancelled in practice. CONFIRMED RULE.
- **MILE-003 / BL-006** (skipped contract-pack recovery): **Leave — working as intended.** Pack step cannot be skipped in practice; dependency is correct conveyancing. Re-verify in Journey B (imported file). CLOSED.
- **AUTO-004** (silent digest failures): **Fix approved** — make per-agency failures visible (log + Sentry). Not yet built.
- **SEC-001** (dev pages outside login wall + portal-link page): **Leave — not fixing.** Founder decision; live-reachability check declined. Residual risk stands only if those `/dev` pages are reachable with real data on prod (evidence says the listed links are staging test tokens).
- **SEC-002** (unauthenticated AI-image endpoint): **Leave for now** — inert while the image provider is off. Audit to re-raise before the provider is ever enabled.
- Findings 1–6 of the batch (the already-fixed items: PROC-001, MILE-001, ENQ-001, DATA-003, DATA-004, MILE-002-cancel) — founder confirmation of the *behaviour* still pending.
## Founder decisions — batch 2 of 10 (2026-10-31)
- **AUTO-001 (solicitor chase double-send):** confirmed working-as-intended fix. CLOSED.
- **AUTO-002 (exchange-day email repeat):** confirmed. CLOSED.
- **AUTO-003 (fail-open cron auth):** fix approved. **DONE (committed `d0d56a6c`, staging, NOT pushed; tsc clean).** Implemented as a single fail-closed guard in the middleware `authorized` callback for `/api/cron/*` (covers all 49 routes; per-route checks kept as defence-in-depth) rather than a 49-file sweep. MANUAL: confirm CRON_SECRET is set in prod + that crons still fire after deploy.
- **BILL-001 / BL-002 (service-type switch changes fee):** **Decision A** — snapshot the service type at exchange. **BUILT (committed `8462d185`, staging, NOT pushed; prisma generate + tsc clean; 5 billing suites/28 tests green).** New `PropertyTransaction.serviceTypeAtExchange`, stamped at both agency exchange points, read by accrual + running-total with live-type fallback. **DB MIGRATION `20261031130000` NOT APPLIED** — must go staging→verify→prod (migrate deploy) before this code is deployed. Functional check pending on staging (switch an exchanged file's type; confirm fee holds).
- **MILE-004 (referral earned never un-earned):** **YES (2026-10-31)** — revert "earned" → "pending" on undo. **DONE (committed `f38b8ff7`, staging, NOT pushed; tsc clean; 12 suites/134 tests green).** Never reverts a "received" fee; broker reverts active round only.
- **MILE-007 (second undo route — reinstate-a-not-required-step — leaves stale chase timer):** fix approved, match the main Undo path. **DONE (committed `765ccc5c`, staging, NOT pushed; tsc clean; 29 suites/500 tests green).** Note: the second path (reverseMilestoneWithCascade) still does not manage enquiry trackers at all — separate pre-existing gap, out of scope for ENQ-003.
- **SEC-003 (staging can mint a portal link):** **WON'T FIX** — founder does not care about staging exposure. CLOSED (accepted risk).
- **MAIL-001 (old buyer's late solicitor reply files into new buyer after relist):** fix approved — rotate the file reply-address on relist. **DONE (committed `eeb9ad61`, staging, NOT pushed; tsc clean; 37 suites/307 tests green).** Relist clears replyToken; next send mints fresh. Trade-off noted: pre-relist-email replies (incl. seller) no longer auto-captured.
- **ENQ-003 (undo "enquiries raised" leaves file un-chased):** fix approved — reopen the pre-enquiry raise chase on that undo. **DONE (committed `765ccc5c`, staging, NOT pushed; same verification as MILE-007).** Guarded so a cascade that also reverses PM8 leaves the raise chase closed.
- **DATA-005 (chain % not relist-aware; other agencies see inflated %):** fix approved — round-scope the chain progress figure. **DONE (committed `201a4b81`, staging, NOT pushed; tsc clean; new 2-case test green).** All 3 compute sites now round-scoped. Pre-existing unrelated failures in __tests__/relist/* (stale clientMoveInfo mock) noted in commit.
- **AUTO-004 (silent digest failures)** from batch 1: fix approved earlier — log + Sentry per-agency. **DONE (committed `d93f2bb4`, staging, NOT pushed; tsc clean).**

## Founder decisions — batch 1 of 10 (2026-10-31)
- **DATA-004 / activity-clock scope: CONFIRMED by design (2026-10-31).** Founder is happy with the four distinct "activity" meanings living in separate mechanisms: Focus = *our outward contact* (from sent comms, manual vs automated separated); shared activity clock = *did anyone do anything* → hub quiet-files + risk + health dot + file-page "Last activity" row (the only mechanism the fix touched); work queue = *last step ticked*; silent-agency = *agency-level event silence*. No surface is a mislabelled "outward contact" readout. Only loose end noted: a stale "mock" comment on the sidebar prop (cosmetic, no action agreed).

**Fix batch 2 (staging, NOT pushed):** `45607921` pack hold pauses chasing (ENQ-001 fixed), `297efa75` nightly prediction refresh (DATA-003 fixed, BL-008 decided: drift intended everywhere), `a521a7bc` activity clock (DATA-004 fixed per confirmed rule: human/response events count, automated sends never do; gaps closed: enquiry movements, portal uploads, give-authority). DATA-002 closed as working-as-intended (BL-009: overall on Overview, per-side on Progress tab — founder decision).

**Fix batch 1 (staging, NOT pushed):** `94ea9f21` stale-test repairs, `b5431d4c` CI workflow (PROC-001 — takes effect on push), `126b7d60` exchange-undo unwind (MILE-001 + MILE-002), `c79a16d3` claim-before-send (AUTO-001 + AUTO-002). All verified: tsc clean, 122 suites / 1303 tests green. Functional staging verification still pending.

**New finding from fix work — MILE-007 (P2, Confirmed):** `reverseMilestoneWithCascade` cancels reminder logs and chase tasks but, unlike `executeUndoMilestone`, does not cancel active `ClientChaseState` rows for the reversed codes — the same stale-chase-date bug fixed on the primary path on 2026-10-19 survives on the secondary path. Not fixed in batch 1 (separate concern).

Severity: **P0** critical (exposure/corruption/wrong charges), **P1** high (wrong info, broken core workflow, wrong-recipient comms), **P2** medium (functional bugs, inconsistency), **P3** low.

---

## Phase 2 findings (added 2026-10-20, second investigation round)

### P1 — High

**ENQ-001 — "Waiting on management pack" hold is screen-only; the chaser ignores it.** Confirmed.
Agents can park an enquiry as waiting on the management pack. The screen shows it held (no next chase, out of "needs you"), but the chase cron never reads `awaitingPackAt`: solicitor chase emails keep sending and the file still escalates as "no movement in 3 weeks". The screen and the automation directly contradict each other, and solicitors get chased for a known freeholder delay.
Evidence: `lib/enquiries/tracker.ts:30-32,61-62,108-110` (UI treats it as a hold) vs `lib/enquiries/chase.ts:40-77,114-145` (decision + query never read it).
Fix: honour `awaitingPackAt` in the cron's tracker query and in `enquiryChaseDecision` (chase AND escalate).

**DATA-002 — The client portal contradicts itself on progress %.** Confirmed.
Portal Overview hero shows the overall pooled % (`app/portal/[token]/page.tsx:164`); the Progress tab shows the viewer's side-only % (`progress/page.tsx:74`). Vendor side 80 / buyer side 40 → Overview says ~60%, Progress tab says ~80% to the same seller. Needs a business decision (BL-009): which figure should clients see?

**DATA-003 — Two different predicted exchange dates, one of them drifting daily.** Confirmed.
The agent file-page sidebar recomputes the prediction live (`now + remaining days`), so it slides forward a day per quiet day. The files list, overview timeline strip, hub filters and client portal read the stored `expectedExchangeDate`, which only updates when a milestone completes. After 10 quiet days the same file shows two dates ~10 days apart, on the same page. Needs a business decision (BL-008): should the prediction drift daily or stay anchored between milestone events? (An override date already makes all surfaces agree.)
Evidence: `lib/services/fees.ts:412`, `components/transaction/AgentFileSidebar.tsx:476-490` vs `ExchangeTargetCell.tsx:25`, `lib/services/hub.ts:276-277`, `app/portal/[token]/page.tsx:565-571`.

### P2 — Medium

**ENQ-002 — Relist/undo reopens the enquiry loop with stale timers.** Confirmed. Reopen clears most fields but not `lastTouchAt` / `partialRepliesAt` / `awaitingPackAt` (undo path also keeps `currentlyWith`) — a reopened loop can be chased on day one instead of after the 6-working-day grace, and shows stale badges. `lib/services/milestones.ts:338-352, 2760-2766`.

**ENQ-003 — Undoing "enquiries raised" (PM14) drops the file out of all enquiry automation.** Confirmed. The tracker closes but the pre-loop raise-chase is never reopened (it only reopens on PM8 completion), so nothing chases until PM14 is re-confirmed manually. `lib/services/milestones.ts:2776-2782` + `:381-403`.

**MAIL-001 — After a relist, a late reply from the OLD buyer's solicitor files into the NEW buyer's timeline.** Confirmed-by-code. The per-file reply token is never rotated on relist and inbound rows carry no round stamp. `lib/email/reply-capture.ts:45-63`, `lib/integrations/mail/ingest.ts:135-179`, `lib/services/comms.ts:170-175`.

**DATA-004 — Three different "last activity" answers.** Confirmed. Files-list chip is event-derived (post-4071b778); hub quiet-files KPI, risk score and health pill read the stale cached column; work queue uses milestone completions only. Same file can show "active today" on the list and "18 days quiet / at risk" on the hub. `lib/services/transactions.ts:254-259,377` vs `hub.ts:892,922,2358`, `risk-input.ts:90`, `health.ts:26`, `work-queue.ts:212`.

**DATA-005 — Chain progress % is not relist-aware.** Confirmed. `computeWeightedProgress` (`lib/services/chains.ts:393-401,430`) counts the dead buyer round's completed steps, so other agencies, the solicitor portal and the public claim page see a higher % than the owner's own (round-scoped) figure on relisted files. Fix mirrors the round filter already used in `exchange-prediction.ts:76-81`.

### P3 — Low

- **ENQ-004** — the reply-loop cron sends one final chase on the same run it escalates; the raise chase explicitly prevents this. Make them consistent. `lib/enquiries/chase.ts:57-75` vs `raise-chase-decision.ts:57-59`.
- **MAIL-002** — all captured inbound emails (and manual internal notes) are stored with `purpose="chase"` by schema default; harmless today, a trap for any future purpose-filtered query. Root cause supersedes the earlier DATA-001 note (the comms.ts block is a read, not the writer). `prisma/schema.prisma:2387-2388`, `ingest.ts:135-179`.
- **MAIL-003** — inbound dedup edges: no-Message-ID retries after 60s duplicate; two same-subject emails within 60s collapse to one.
- **MAIL-004** — AI interpretation only runs on Outlook-sourced mail despite the cron comment claiming all providers; IMAP + reply-capture inbound never produce proposals. Confirm intent. `lib/.../email-interpret.ts:17-22`.
- **FE-001** — known U1 rapid-milestone double pop-ups: per-row lock only, no panel-level lock. Cosmetic; server dedupes. `components/milestones/MilestoneRow.tsx:282,329`.
- **FE-002** — three forms rely on button-disabled alone for double-submit (new sale `NewSaleFlow.tsx:990`, log update `LogUpdateModal.tsx:151`, detail-change second await `HeroSaleFields.tsx:372-375`).
- **FE-003** — exchange UNDO is hidden behind the completed-row chevron; for the most consequential action, reversal is hard to find. UX decision.
- **DATA-006** — "exchanged" is derived three ways (exchangedAt / VM19-PM26 state / phase detect); only desyncs in failure windows. Possible.
- **SEC-002 scope closed** — full per-file sweep confirms the AI-image route is the ONLY unauthenticated Command Centre endpoint; all 22 others + admin pages gated.

### Verified-safe highlights (Phase 2)
- Portal vs agent milestone step lists use the same round-scoped source — no divergence.
- Dashboard counts consistently exclude demo/draft; "exchanged" counting canonicalised on `exchangedAt`.
- All five audited agent mutation flows surface errors (nothing swallowed), revalidate after success, and the exchange confirm has proper friction (date + drawer + confirm).
- Inbound email file-matching is well-guarded (folder authoritative, named-party corroboration, own-sender exclusion); AI email reading is suggest-only.

---

## P1 — High

### PROC-001 — Nothing checks the code before it goes live
**Status:** Confirmed. **Where:** development process (root cause, not a single screen).
**The problem:** TSP has ~100 automated test files, including strong ones that prove one agency can't see another's data — but no machinery runs them. There is no CI service (no `.github/workflows`, nothing on Vercel), so code can be deployed without a single test running. The pre-commit check that exists runs in "warn but allow" mode and is skippable.
**Why it matters:** This is the most likely root cause of the pattern of small bugs being found by users. The project's own rulebook (CLAUDE.md Laws 2, 18) claims CI gates that do not exist.
**Evidence:** no `.github`/`.husky` dirs; `package.json` test scripts manual-only; `.git/hooks/pre-commit` defaults `PHASE5_ENFORCE=0`; `playwright` has no npm script.
**Recommended action:** stand up a minimal CI (typecheck + jest incl. the access-scope coverage test + the isolation e2e) as the first approved fix of this audit.

### SEC-001 — The developer page area is outside the login gate, and one page lists working portal links
**Status:** Confirmed in code; production reachability **Not tested**.
**Where:** `/dev/*` (49 pages).
**The problem:** The security middleware deliberately excludes the whole `/dev` area from login checks (`middleware.ts:254`), and there is no shared gate file; only ~25 of 49 pages have any protection of their own. One page, `/dev/broker-states`, is explicitly "Public, no auth" and contains seven hard-coded buyer-portal tokens (`app/dev/broker-states/page.tsx:8-16`) — each link opens a client portal.
**Mitigating facts:** the tokens belong to *staging seed data* (`scripts/seed-broker-demo.ts`), not real customers; on production they likely resolve to nothing. The structural hole (ungated /dev on all deployments) is the real issue.
**Recommended action:** add a single founder-gated `app/dev/layout.tsx` mirroring `app/test/layout.tsx`; delete `/dev/broker-states` (it's marked disposable). Verify prod reachability first (safe GET).

### SEC-002 — One Command Centre endpoint has no permission check and spends real money
**Status:** Confirmed (full file read). Currently inert because the image provider token is not yet configured.
**Where:** `app/api/command/content/images/ai/route.ts` (whole file, lines 15–103: no session/role check).
**The problem:** The Command Centre's page gate only covers `/command` URLs, not `/api/command` URLs (`middleware.ts:41-112` matches `pathname.startsWith("/command")`). Behind-the-scenes endpoints each do their own superadmin check — except this one. Any logged-in user (e.g. a negotiator at a customer agency) could generate AI images, each costing money and consuming the monthly budget, and write rows into the Command Centre database.
**Recommended action:** add the `hasSuperAdminPowers` check; sweep the other `api/command/content/*` siblings per-file (spot-checks passed, full sweep pending); consider extending the middleware gate to `/api/command`.

### AUTO-001 — Automated solicitor chases can be sent twice
**Status:** Likely (confirmed code pattern; duplicate not reproduced).
**Where:** solicitor chase cron (`lib/solicitor-confirm/chase.ts:503-517`).
**The problem:** The email is sent first and only afterwards is "I sent this" recorded. If the recording step fails, or the process dies between the two, the next weekday run sends the identical chase again. The main email queue does this correctly (records a claim *before* sending); this path bypasses the queue.
**Real-world example:** a solicitor receives the same "please confirm the contract pack was issued" nudge two days running — makes the agency look disorganised.
**Recommended action:** route solicitor chases through the outbound queue, or move the state write before the send.

### AUTO-002 — Exchange-day emails can repeat every 15 minutes for up to 2 hours
**Status:** Likely (confirmed code pattern; not reproduced).
**Where:** exchange-day cron (`lib/exchange-day/send.ts:119-135`).
**The problem:** Both solicitors are emailed, then a "done" stamp is written to the sale. The stamp write is not failure-guarded; if it throws, the slot stays unstamped and the 15-minute cron re-sends to both solicitors on each tick within the 2-hour staleness window.
**Recommended action:** stamp (or claim) before sending; wrap per-file.

### AUTO-003 — If one server setting ever goes missing, the scheduled-job door opens
**Status:** Confirmed code pattern; production env state **Not tested**.
**Where:** every `app/api/cron/*` route (e.g. `client-chase/route.ts:25`).
**The problem:** Jobs check `authorization !== "Bearer " + CRON_SECRET`. If `CRON_SECRET` were ever unset, a request sending the literal string `Bearer undefined` would be accepted — anyone could trigger chase sends, billing accrual, etc. Only `api/reminders/run/route.ts:7-11` fails closed.
**Recommended action:** one shared fail-closed helper used by all cron routes; verify the secret is set in prod.

### MILE-001 — Undoing an exchange does not always undo the bill
**Status:** Confirmed asymmetry in code; reachability from the UI for exchange steps **Needs verification**.
**Where:** milestone undo paths (`lib/services/milestones.ts`).
**The problem:** The full undo path (`executeUndoMilestone`, :2583-2903) reverses billing (`handleExchangeReversal` at :2883 — clears the exchange/billing stamps or writes a credit note). The second path (`reverseMilestoneWithCascade`, :2907-3024, reached via `reverseMilestoneAction`) reopens the sale but **never touches billing**: the sale stays stamped exchanged/billed while active again.
**Real-world example:** an exchange marked by mistake is undone; the agency is still charged for it at month end.
**Recommended action:** verify which UI surfaces call which path for exchange codes; make billing reversal fire from both, or block path 2 for exchange codes.

### MILE-002 — Undoing an exchange does not stop the congratulation emails already queued
**Status:** Confirmed.
**Where:** both undo paths; email queues (`OutboundEmailQueue`, `ChainNotificationQueue`, `ChainNeighbourUpdate` untouched by either undo path; only queue reference in `milestones.ts` is a comment at :1845).
**The problem:** Exchange/completion/celebration/chain emails are queued and sent a little later (quiet-hours batching). Undoing the milestone in that window does not remove the queued emails — the seller, buyer and chain contacts still receive "Contracts exchanged — your sale is legally committed" for an exchange that was rolled back.
**Why it matters:** a legally-meaningful message sent wrongly is the single worst category of automated email. Related business decision: BL-001.
**Recommended action:** cancel matching queued rows inside both undo paths.

### BILL-001 — Switching a sale between self-managed and outsourced after exchange can quietly change the bill
**Status:** Likely (traced; needs a reproducing test). Business rule unclear — see BL-002.
**Where:** `app/actions/transactions.ts:1712-1716` (switch allowed while status "active"), `lib/billing/accrual.ts:139-157` (fee recomputed from *current* service type on still-building invoices).
**The problem:** A file that has exchanged but not completed is still "active", so its service type can be switched. The month's draft invoice recomputes from the current type: outsourced→self-managed zeroes a £250–£350 fee; the reverse could add one the agency never agreed to.

### AUTO-004 — Three digest emails fail invisibly
**Status:** Confirmed.
**Where:** `cron/morning-digest/route.ts:41-45`, `cron/agent-weekly-brief/route.ts:19`, `cron/client-weekly-update/route.ts:19`.
**The problem:** Each loops over agencies with `.catch(() => 0)` — a failing agency is skipped with no log, no Sentry, no job-run note. If one agency's weekly client update started failing, clients would silently stop hearing from TSP and nobody would know.
**Recommended action:** log + Sentry per-agency failures (pattern already exists in client-chase/solicitor-chase).

### SEC-003 — On staging, anyone can mint a working client portal link
**Status:** Confirmed.
**Where:** `app/api/test-fixtures/portal-token/route.ts:7-20` (and `api/dev/sold-for`): 404 in production, open to the world on any non-production deployment.
**The problem:** Staging contains realistic test data and the endpoint returns a live portal token with no auth. Staging URLs leak (referrers, link sharing).
**Recommended action:** require the founder gate (or a secret) even outside production.

---

## P2 — Medium

### MILE-003 — The "stranded buyer steps" bug has no automatic cure as planned
**Status:** Confirmed. Known issue, but the planned fix won't work as assumed.
**Where:** `lib/milestone-prerequisites.ts:34,39`; reconcile job `lib/services/milestones.ts:611-689`.
**The problem:** Nearly the whole buyer side depends on the contract-pack step (VM7/PM7). If it's skipped, every later buyer step stays locked with no UI path forward. The nightly reconcile job only unlocks steps whose prerequisites are already complete — it can never fill in the skipped step, so the queued "reconcile-job" remedy cannot fix this. Needs a different mechanism (see BL-006) or a manual confirm.

### MILE-004 — Referral credits are never un-earned
**Status:** Confirmed. `flipReferralEarnedForMilestone` fires on completion (`milestones.ts:1908`); no undo path reverses it. Undoing the triggering milestone leaves the referral "earned" — potential over-counting of referral money. See BL-003 adjacent decisions.

### MILE-005 — Anyone with file access can undo a "not required" marking; spec says only directors/progressors should
**Status:** Needs clarification (BL-004). Spec `docs/MILESTONES_SPEC_v1.md:161-163` restricts NR-undo to Directors/Progressors; `reverseMilestoneAction` checks only file access, no role check visible. The UI may hide the button; the server does not enforce it.

### MILE-006 — The rules for marking "searches" and "deposit" as not-required disagree between spec and code
**Status:** Needs clarification (BL-005). Code allows NR for PM9, PM24 always + PM8 cash-only (`milestones.ts:2420-2435`, with an in-code comment admitting the spec and seed disagree on PM8/PM24).

### CHAIN-001 — The same property can appear twice in one chain
**Status:** Confirmed possible. Nothing blocks two unclaimed placeholder links for the same address in one chain; duplicate detection (`lib/chain/duplicate-detection.ts`) is only a suggestion at claim time. Both stubs can be invited; one claimed while the stale twin lingers. See BL-007.

### CHAIN-002 — Deleting a chain may leave sales still pointing at it
**Status:** Possible, unverified. `deleteChain` (`lib/command/.../chains.ts:1832-1834`) relies on cascade delete and does not null `PropertyTransaction.chainLinkId`. Needs a targeted check of FK behaviour.

### BILL-002 — The "first outsourced sale free" flag isn't cleaned up if the exchange is undone
**Status:** Likely. Reversal clears the billing stamps but not `firstOutsourcedFree`/`freeReason` (`lib/services/billing-reversal.ts:86-93`). Behaviour on re-exchange (same or different sale) unverified. Business rule: BL-003.

### BILL-003 — Two sales exchanging at the same moment could both get the free offer
**Status:** Confirmed by design (acknowledged in-code as deferred, `billing-trigger.ts:117-120`). Low likelihood at current scale.

### BILL-004 — Two different VAT assumptions in the code
**Status:** Confirmed, latent. Invoicing uses the agency's configurable VAT rate (`lib/billing/fee.ts:137-138`); the fees display card hardcodes 20% (`lib/services/fees.ts:13`). They agree only while every agency is at 20%.

### SEC-004 — Email replies into TSP are authenticated only by an unguessable address
**Status:** Possible, low-moderate. `api/webhooks/sendgrid-inbound` has no signature; auth is the 122–128-bit reply token in the address. Tokens travel in email headers, so a forwarded email leaks the ability to post a spoofed "reply" note onto a file or opt a prospect out. Standard mitigation for SendGrid Inbound Parse; consider a secret path segment.

### SEC-005 — Two webhooks accept anything if their secret isn't configured
**Status:** Possible — prod env **Not tested**. `sendgrid-bounce` (`route.ts:48-49`) and `vercel-deploy` (`route.ts:30`) skip verification when the env var is unset. Bounce side-effects include globally suppressing an email address. Verify both secrets are set in prod.

### AUTO-005 — The WhatsApp watchdog can't report its own failure
**Status:** Confirmed. `cron/whatsapp-cloud-health` is the only cron not wrapped in `runJob` — no job-run record, no Sentry. If the watchdog breaks, the breakage is invisible.

### AUTO-006 — Retention emails have a small double-send window
**Status:** Confirmed, tolerated in-code (`lib/services/retention.ts:257-260`): dedup is look-then-write with no unique index. Only risky if the sweep ever runs concurrently (manual + cron).

### DATA-001 — Manually logged inbound communications get wrong labels
**Status:** Confirmed (already on the project's own books, POST_LAUNCH_FIXES). `lib/services/comms.ts:140-194` — inbound entries inherit outbound defaults for channel/purpose/status; existing rows mislabeled. Matters because "last contact" style reporting reads these.

### SEC-006 — Six endpoints use the old-style agency check instead of the canonical one
**Status:** Confirmed, currently safe. All six (`api/agent/flag:29`, `api/claim:355`, `actions/manual-tasks:114`, `actions/transactions:1534,2630,2784`, `actions/tasks:533`) are role-gated first so they don't leak today, but they're latent regressions if the surrounding gate is ever refactored. Convert to `scopeOwnershipWhere` when touched.

---

## P3 — Low

- **BILL-005** — Bank-holiday list ends 26 Dec 2028 (`lib/services/fees.ts:367`); after that, predicted dates silently stop avoiding bank holidays. Add a test that fails within N months of list expiry.
- **SEC-007** — `/admin/migrate` and `/admin/sentry-test` internal role gates unverified; confirm they require admin.
- **SEC-008** — No rate limiting on portal token lookup (tokens are 122-bit, so brute force is infeasible; defence-in-depth only).
- **DOC-001** — Stale docs that could mislead future work: `docs/audits/chain-system-gaps.md` lists as missing two things that have since shipped (withdrawal cascade, invite expiry); `billing-trigger.ts:109-127` comment describes a credit-note mechanism the code doesn't use; `intro_credit` invoice-line kind appears to have no writer.
- **AUTO-007** — Four content crons exist on disk but are not scheduled in `vercel.json` (`content-batch`, `content-inbox`, `content-topics`, `content-schedule-reminder`) — confirm intentional.
- **PRIV-001** — Client chase emails embed an open-tracking pixel (noted in-code as deliberate); flag for the privacy policy work already on the books (FileTimeSession GDPR item).

---

## Verified-safe highlights (things that held up under inspection)
- No confirmed cross-agency data leak: access-scope helper used pervasively; global + agent search scoped (prior leaks fixed); document downloads ownership-checked; upload paths prevent cross-file overwrites.
- Portal tokens are strictly bound to their own transaction; superseded-buyer tokens are inert; agent preview sessions can't write.
- Stripe and WhatsApp webhooks signature-verified; public unsubscribe/pause links correctly defer changes to a confirmed POST (prefetch-safe).
- Main outbound email queue is double-send-safe (atomic claim before send, per-row isolation, 24h retry age-out, dead-lettering).
- Chase exclusion guards comprehensive (status, demo, exchange-day, agency/business/file/contact/step pauses, snooze, caps, relist round-scoping) and re-checked at send time.
- Double-charge protections on agency billing are strong (null-guarded stamps, price snapshot at exchange, Stripe idempotency keys, credit-note dedup + unique index).
- Concurrent milestone confirms: first-writer-wins, side effects fire once.
- Chain cross-agency stripping confirmed server-side.
