# TSP Production Engineering Audit

**Date:** 2026-09-12
**Scope:** Full application — read-only, evidence-based. No code, schema, config, or data was changed in producing this report. This document is the only file created.
**Method:** Direct tracing of the real implementation (services, API routes, crons, webhooks, Prisma schema, migrations) plus the existing test suite. Seven parallel deep traces, cross-checked against each other and spot-verified by hand on the highest-stakes findings.

**Codebase shape (facts):** Next.js 16 (App Router) · TypeScript strict · Prisma 5.22 over Supabase Postgres · NextAuth (Credentials + Google/Azure, JWT) · SendGrid · Stripe · Upstash rate-limit (installed) · Sentry (configured) · PostHog. **120 Prisma models · 199 API routes · 41 cron jobs · 4 inbound webhooks (Stripe, SendGrid inbound, SendGrid event/bounce, Vercel deploy) · ~90 service modules · 22 Jest tests + 32 Playwright specs.**

---

## Executive summary — "Is TSP engineered like a real production application?"

**Yes, substantially — with one serious client-facing data bug to fix now, and a cluster of duplicate-email hazards to fix before volume grows.**

This is not AI-generated spaghetti dressed up to look finished. The hardest correctness problems a transaction/billing/email SaaS faces have been identified and solved *on the real production paths*, not just in helpers: milestone completion is race-safe (atomic `updateMany` state-guard + DB partial-unique indexes), exchange billing stamps exactly once (NULL-guarded `updateMany`), invoice issuance is idempotent with deterministic Stripe keys, the Stripe webhook verifies signatures and is state-idempotent, multi-tenant isolation is enforced through a single access-scope helper **and** guarded by a CI regression test, and there is genuine audit-trail infrastructure (JobRun, AgentEmailLog, AdminAuditLog). The billing charge path is additionally behind an off-by-default kill-switch. These are the decisions of someone who has thought about concurrency and money.

The gaps are real but bounded. **One is a genuine correctness/privacy bug shippable today:** on a relisted file, the fallen-through (old) buyer still receives live milestone-progress emails, because the dead-round guard that protects the queued email paths is missing on the one path that still sends synchronously. **A second cluster is latent and scale-dependent:** several email-drain crons use check-then-send (no atomic claim), so a Vercel cron double-fire or a crash mid-send can send a client email twice, and a transient SendGrid error marks an email permanently errored with no retry and no alert. **A third is purely operational:** there is no CI — the well-built test suite never runs automatically before a production deploy, so any behaviour-breaking-but-compiling change ships.

At today's scale (~5 test users, no paying customers, billing kill-switch off) none of the latent issues are firing. But the duplicate-send and no-retry behaviours become real the moment email volume rises, and the billing latent bugs become real the moment the kill-switch flips on. None of these require enterprise architecture to fix — they are targeted patches to existing, mostly-good code.

---

## 1. Overall verdict

**Production-grade core, with a short and specific fix-list.** The engineering judgement on display (idempotency keys, atomic claims where they were added, NULL-guarded stamps, a central tenant-scope helper with a test, a billing kill-switch) is better than typical for a rapidly AI-built product. The weak spots are (a) one client-facing disclosure bug, (b) inconsistent application of the atomic-claim pattern across the email drains, (c) no automated test gate before deploy, and (d) a handful of scale-dependent index/retention gaps that are correctly deferred rather than over-engineered. Fix (a) now; fix (b) before email volume grows; address (c) as a standing investment; (d) is genuinely "later."

---

## 2. What TSP already does well (verified GOOD)

- **Milestone completion is concurrency-safe.** `lib/services/milestones.ts:1108-1202` completes via `milestoneCompletion.updateMany({ where: { id, state: { not: "complete" } } })`, sets `wonRace = count > 0`, catches P2002 on create, and `if (!wonRace) return` *before* any side effect (unlock, reminders, billing stamp, chain notify, events). Backed by DB **partial unique indexes** (`migrations/20260604000000_buyer_round_milestone_uniqueness`). Double-click / dual-agent / portal double-tap all resolve first-writer-wins. **(FACT, CONFIRMED.)**
- **Exchange billing stamps exactly once.** `lib/services/billing-trigger.ts:53-141` writes `exchangedAt`/`billedAtExchange`/`priceAtExchange` only via `updateMany({ where: { id, exchangedAt: null } })`. The bilateral VM19+PM26 double-fire and any concurrent fire match zero rows on the second pass. Price is snapshotted so later edits don't change the bill. **(FACT, CONFIRMED.)**
- **Invoice issuance is idempotent.** `lib/billing/issuance.ts:46-68` uses deterministic Stripe idempotency keys (`issue:{agency}:{month}:item:{i}` / `:invoice`), skips already-issued invoices, and wraps each invoice in its own try/catch so one agency's failure leaves it `building` for retry without aborting the loop. Proven against the *real* issuer by `__tests__/billing/issuance-idempotency.test.ts`. **(FACT, CONFIRMED.)**
- **Billing charge path is kill-switched off.** The only code that charges a card is reachable solely through `issue-invoices`, which returns early unless `BILLING_AUTO_ISSUE_ENABLED === "true"` (`app/api/cron/issue-invoices/route.ts:26`). A global grep finds **no other** `invoices.create`/`paymentIntents`/`charges.create` anywhere. **(FACT, CONFIRMED.)**
- **Stripe webhook is signature-verified and state-idempotent.** Raw-body `constructEvent` (`app/api/webhooks/stripe/route.ts:32-41`); `marked_paid`/`marked_failed` both guarded by status `updateMany`; `paymentFailedAt` set only when null. Redelivery converges to the same state. **(FACT, CONFIRMED.)**
- **Reversal double-credit is guarded at app AND DB layer.** `lib/services/billing-reversal.ts:86-103` + partial unique index `CreditNote_unapplied_per_transaction_unique`. **(FACT, CONFIRMED.)**
- **Multi-tenant isolation is solid and test-backed.** Every sampled session route resolves client-supplied IDs through `getAccessScope` + `scopeOwnershipWhere`/`scopeChaseTaskWhere`/etc. *before* acting; a mismatched ID returns 404, not the row. The `findFirst({ where: { id } })`-without-scope anti-pattern was **not found** in any sampled session route. `__tests__/multi-tenant/access-scope-coverage.test.ts` fails the suite if a multi-tenant query drops its scope helper. **(FACT, CONFIRMED across ~20 sampled routes + static test.)**
- **Portal tokens are CSPRNG and role/round-scoped.** `randomUUID()` (122-bit) tokens; portal-confirm side-scopes by `roleType`, blocks agent-only bilateral codes, honours terminal-status write blocks, and guards dead rounds on reads/writes/uploads (`__tests__/relist/old-buyer-write-guard.test.ts`). **(FACT, CONFIRMED.)** *(Note: the outbound email path is the exception — see Finding 1.)*
- **Milestone-digest drain uses a correct atomic claim.** `lib/email/milestone-digest-drain.ts:227-231` claims rows via `updateMany({ where: { id: {in}, sentAt: null, errorAt: null }, data: { sentAt: now } })` then `if (claim.count === 0) continue` *before* sending; releases the claim on failure. Proven by `__tests__/email/milestone-double-send-drain.test.ts`. This is the pattern the other drains lack. **(FACT, CONFIRMED.)**
- **Sender identity is bulletproof.** `lib/email/agency-sender.ts` never emits an unverified From; reserved/test domains are dropped pre-SendGrid. **(FACT, CONFIRMED.)**
- **Auth hardening.** bcrypt, IP rate-limit before credential check, server-side TOTP + single-use backup codes, `sessionVersion` global sign-out, AES-256-GCM encryption of integration refresh tokens, middleware blocks viewer mutations and confines role path prefixes. No hardcoded secrets; no credentials in logs; no open redirects. **(FACT, CONFIRMED.)**
- **Observability foundation exists.** Sentry configured for all three runtimes (DSN-gated); `JobRun` records every wrapped cron run + error; `AgentEmailLog`/`OutboundEmailQueue` log email sends; `AdminAuditLog` + `[AUDIT]` login lines. **(FACT, CONFIRMED — see Finding 9 for the gaps.)**

---

## 3. What genuinely worries me

1. **🔴 Fallen-through buyers receive live milestone emails (Finding 1).** A real wrong-recipient disclosure on a primary product flow (portal self-confirm on a relisted file). Fix before relying on this in production.
2. **🟠 Duplicate client emails from check-then-send drains (Finding 2).** `drain-outbound-email` (hourly, carries CLIENT_CHASE/EXCHANGE/COMPLETION) and `drain-chain-neighbour-updates` have no atomic claim; a cron double-fire or crash-after-send re-sends. The fix pattern already exists in the codebase (the milestone drain) — it just wasn't applied here.
3. **🟠 Transient SendGrid failure = permanent, silent email loss (Finding 3).** An errored row is never retried or requeued, and nothing alerts. A brief SendGrid hiccup during a busy exchange window can silently drop time-critical client comms.
4. **🟠 No CI / no automated test gate before prod (Finding 4).** The genuinely valuable test suite (billing idempotency, tenant isolation, email dedup, relist guards) never runs automatically. Any change that compiles but breaks behaviour — including a dropped tenant filter or a broken billing branch — deploys to production.
5. **🟡 Billing latent bugs that bite when the kill-switch flips on (Finding 5).** The first-outsourced-free reversal credits a full band fee that was never charged; a crash after Stripe-create but before DB-persist can orphan a charge (money in, recorded unpaid) or, after 24h, double-charge. Dormant today; must be fixed before `BILLING_AUTO_ISSUE_ENABLED=true`.

---

## 4. What is imperfect but acceptable today

- **No event-ID ledger on webhooks.** Stripe/SendGrid dedupe relies on idempotent state writes, which is correct *for the currently-handled event types*. A trap only if a future non-idempotent handler is added. (LOW today.)
- **No optimistic concurrency on whole-file edits.** Two users editing the same transaction's plain fields is last-writer-wins. Milestone state changes are individually safe; only free-field edits race. (LOW.)
- **Cron auth is copy-pasted inline and fails open if `CRON_SECRET` is unset** (only `reminders/run` fails closed). The secret is almost certainly set in prod; the risk is env-var drift to a new environment. (MEDIUM, contingent.)
- **Command-Centre API routes self-gate per file** rather than via middleware/shared wrapper; a future route that forgets the `hasSuperAdminPowers` check would be reachable by any authenticated user. No current hole found. (MEDIUM, structural.)
- **Manual validation, no zod on most routes.** No mass-assignment vector was found (routes destructure named fields). Acceptable. (GOOD/LOW.)
- **A fragile-but-signature-gated raw-SQL `IN` clause** in the SendGrid bounce webhook (escaped, ECDSA-gated). (LOW.)
- **Self-XSS surface** on the agent's own email-signature preview (sanitizer exists on save). (LOW.)
- **Append-log tables grow unbounded with no retention** (`Event`, `FeatureEvent`, `ReminderLog`, `OutboundMessage`, risk/prediction history). Fine for years; needs a retention policy before 1M+ rows. (LOW/MEDIUM at scale.)
- **Self-caught cron 500s bypass Sentry** (they don't throw), though `JobRun` records them. (MEDIUM for dashboard completeness.)

---

## 5. What TSP does NOT need yet (⚪ NOT-NEEDED)

- **MCP server/client.** Absent, and correctly so — there is no external LLM-agent consumer of TSP's data. Adding it would be speculative surface area. **(CONFIRMED absent.)**
- **Distributed locking / queue infrastructure (SQS, BullMQ, Kafka).** The atomic-claim-in-Postgres pattern is the right weight for this workload. A dedicated queue is unjustified until email volume is far higher.
- **Read replicas / sharding / CQRS.** Not remotely close to the scale that warrants these.
- **Architecture for 1M transactions.** The correct response to the 1M scenario is a handful of indexes and a retention job, not re-architecture.
- **Tunnelled Sentry, PostHog reverse-proxy, aggressive caching layers.** No current driver.

---

## 6. Production engineering scorecard

Confidence: **High** = verified in code by hand / corroborated by ≥2 independent traces; **Medium** = traced but sampled; **Env** = depends on Vercel/Stripe/SendGrid config not in the repo.

| Area | Status | Confidence | Practical risk today | Evidence |
|---|---|---|---|---|
| Race conditions | 🟢 Good (hot paths) / 🟡 (drains) | High | Low now | `milestones.ts:1108`; `billing-trigger.ts:53`; drains §Finding 2 |
| Idempotency | 🟢 Good | High | Low | `issuance.ts:46`; `outboundQueue.ts:144`; unique indexes |
| Webhooks | 🟢 Stripe / 🟡 SendGrid event | High | Low–Med | `webhooks/stripe`; `sendgrid-webhook.ts` |
| Rate limiting | 🟡 Built but no-op (flag off) | High/Env | Low now, High at free-signup | `lib/ratelimit.ts:18` |
| Caching | 🟢 Good, tenant-safe | High | None | `cached-fetchers.ts`; `property-intel.ts:76` |
| MCP | ⚪ Not needed | High | None | absent (grep) |
| CI/CD | 🟠 No test gate | High | Med (every deploy) | no `.github`; `package.json:7` |
| DB indexes | 🟡 Gap on `PropertyTransaction` | High | Low now, High at 100k | `schema.prisma:655` |
| DB integrity | 🟢 Good | High | Low | FKs, unique/partial-unique constraints |
| Background jobs | 🟡 Inconsistent claims | High | Med before growth | drains §Finding 2 |
| Retry behaviour | 🟠 No email retry | High | Med | `outboundQueue.ts`; no retry wrapper |
| Failure recovery | 🟠 Silent email loss | High | Med | §Finding 3 |
| Authentication | 🟢 Good | High | Low | `lib/auth.ts` |
| Authorisation | 🟢 Good / 🟡 command API | High/Med | Low | access-scope helper; `middleware.ts:41` |
| Tenant isolation | 🟢 Good, test-backed | High | Low | access-scope + CI test |
| Input validation | 🟢 Adequate | Medium | Low | manual checks; no mass-assign |
| Email safety | 🔴 Relist leak / 🟢 sender | High | **High (relist files)** | `portal.ts:1311,1508` |
| Billing safety | 🟢 Today / 🟡 when ON | High | Low now | kill-switch + §Finding 5 |
| Testing | 🟡 Right invariants, not run | High | Med | `__tests__/*`; no CI |
| Logging | 🟢 Audit trail / 🟡 Sentry gaps | High/Env | Low–Med | JobRun, AgentEmailLog |
| Monitoring | 🟠 No alerting | High | Med | `/command/health` only |
| Security basics | 🟢 Good | High | Low | no secrets/redirects; sanitizer |
| External deps | 🟡 SendGrid no timeout/retry | High | Med | `sendgrid.ts`; `anthropic.ts` |
| Scalability | 🟢 Fine now | High | Low now | §9 |

---

## 7. Detailed findings

### 🔴 Finding 1 — Fallen-through (old) buyer receives live milestone emails on the portal-confirm path

- **Finding:** On a relisted file, the superseded buyer's `Contact` is deliberately left intact (email, `portalToken`, `portalEligible=true` by default, old `buyerRoundId`). The **synchronous** portal-confirm fan-out fetches contacts with no round/eligibility filter and the send loop skips only on missing email/token or per-contact pause — so when the *live* buyer or the seller self-confirms a milestone, the old buyer is emailed the progress.
- **Evidence (hand-verified):**
  - Relist leaves the old contact intact: `app/actions/transactions.ts:2644-2656` ("STEP 4 — old purchaser tokens are LEFT INTACT", `void oldPurchaserContacts;`) — no change to email/token/`portalEligible`. `portalEligible` default `true` (`prisma/schema.prisma:855`). The old contact stays attached to the same `transactionId` with its old `buyerRoundId`.
  - Contact fetch has no `where`: `lib/services/portal.ts:1311-1313` selects all contacts on the tx.
  - Send loop guards only email/token/pause: `lib/services/portal.ts:1508-1528` — `if (!c.email || !c.portalToken) continue; if (c.stepConfirmPausedAt) continue;` then `trySendClientEmail(...)`. **No `buyerRoundId` (active-round) check and no `portalEligible` check.** The generic fallback branch (`:1595-1597`) does check `portalEligible` but still has no round filter.
  - The guard exists everywhere else: both queue drains gate dead rounds — `milestone-digest-drain.ts:182-202,363-374` and `outboundQueue.ts:247-263` (`recipient_round_archived`). The agent-confirm path enqueues (protected); only the client portal-confirm path sends synchronously and is unprotected.
- **FACT. CONFIRMED** (code path verified by hand, premise verified in the relist action).
- **Real-world TSP scenario:** Buyer A falls through; the file is relisted to Buyer B. Buyer B (or the seller) taps "Confirm" on a milestone → Buyer A receives, e.g., "Your survey is arranged" / "Contract pack received" about a property they no longer have any interest in. The content disclosed is the milestone progress + property address (not Buyer B's name or price), but it is continued processing and disclosure of the sale's status to a party with no lawful basis — a UK GDPR wrong-recipient disclosure and a trust/reputational problem. Existing relist tests cover *read* scoping and *write* guards on the old buyer, but **not** this outbound fan-out.
- **Current protection:** None on this path. (Master `suppressPortalConfirmEmails` and per-contact pause exist but are not the relist guard; the dead-round guard that would catch this is only on the queued paths.)
- **Severity:** 🔴 **CRITICAL** (wrong-client disclosure on a primary flow). Blast radius is limited to relisted files, which is why it hasn't surfaced at 5 test users.
- **When it matters:** **Now**, for any relisted file where the live party uses portal self-confirmation.

### 🟠 Finding 2 — Check-then-send email drains can duplicate client emails

- **Finding:** `drain-outbound-email` (hourly) and `drain-chain-neighbour-updates` (every 10 min) read `sentAt: null` rows, send, then stamp `sentAt` — with no atomic claim before the send. Two overlapping runs, or a crash after SendGrid accepts but before the stamp, re-send.
- **Evidence:** `lib/email/outboundQueue.ts:158-169` (`findMany … take:50`), send at `:277`, stamp at `:303-306` — no pre-send `updateMany` claim. `lib/services/chain-neighbour-updates.ts:145-174` same shape. Contrast the correct `milestone-digest-drain.ts:227-231`. The outbound lane carries `CLIENT_CHASE`, `EXCHANGE`, `COMPLETION`, `CELEBRATION`, and the outsource-intro email; `CLIENT_CHASE` also increments `chaseCount` (`client-chase-digest.ts:664-669`), so a duplicate also inflates "Chased N times". `runJob` provides logging, not mutual exclusion (`lib/cron/run-job.ts`). Solicitor-chase and chain-withdrawal sends have the same check-then-act shape (`lib/solicitor-confirm/chase.ts:457-493`; `lib/email/chainNotifications.ts:233-318`), though their escalation/celebration sub-paths *do* use correct atomic flips.
- **FACT. CONFIRMED** (independently found by two traces).
- **Real-world TSP scenario:** Vercel double-fires the hourly cron (cron delivery is at-least-once), or a slow SendGrid batch causes the function to be killed after some sends. The client receives the same chase/exchange email twice, and the portal shows an inflated chase count.
- **Current protection:** Enqueue-time unique constraints prevent duplicate *rows*, but not duplicate *sends* of the same row. The milestone drain is protected; these are not.
- **Severity:** 🟠 **HIGH** (duplicate irreversible client comms).
- **When it matters:** Before growth — any double-fire or crash window; more likely as volume rises (the 50-row cap means busy periods keep the window open across runs).

### 🟠 Finding 3 — Transient SendGrid failure marks an email permanently errored (no retry, no alert)

- **Finding:** Any send throw stamps `errorAt`; both drains exclude `errorAt != null`; nothing ever clears `errorAt` or requeues, and there's no retry wrapper or explicit timeout on the SendGrid call.
- **Evidence:** `lib/email/outboundQueue.ts:160,411-414`; `milestone-digest-drain.ts:140,296-299`. `lib/services/sendgrid.ts` / `lib/email.ts` call `sgMail.send` with no retry and no explicit timeout (relies on SDK defaults). The only failure signal is a red row on `/command/health`.
- **FACT. CONFIRMED.**
- **Real-world TSP scenario:** A transient SendGrid 429/5xx or a network blip throws once → that client's milestone confirmation / chase / exchange email is marked errored and **never sent again**, silently. A rate-limit burst during a busy exchange window could drop a batch of time-critical emails with no alert.
- **Current protection:** None (no dead-letter requeue, no alert). `JobRun` records the run outcome but not per-email loss.
- **Severity:** 🟠 **HIGH** (silent permanent loss of client comms on transient infra errors).
- **When it matters:** Any SendGrid hiccup — more likely as volume rises.

### 🟠 Finding 4 — No CI: the test suite never gates a production deploy

- **Finding:** There is no `.github/workflows` and no husky. The build script is `node scripts/vercel-db-deploy.mjs && prisma generate && next build` — Jest/Playwright are never invoked. Local git hooks exist but `tsc` runs **warn-only** by default (`PHASE5_ENFORCE` unset) and they don't run the suite; hooks are local-only and bypassable. `next build` *does* typecheck (`next.config.ts` sets neither `ignoreBuildErrors` nor `ignoreDuringBuilds`), so type errors block — but behaviour errors don't.
- **Evidence:** `package.json:7,22`; `.git/hooks/pre-commit` (warn-only, lines 33,124); absence of `.github` (confirmed); `next.config.ts` (verified by hand — no ignore flags). Prod migrations auto-apply through the Vercel build (`scripts/vercel-db-deploy.mjs` runs `prisma migrate deploy` on `VERCEL_ENV==="production"`).
- **FACT. CONFIRMED.**
- **Real-world TSP scenario:** "Could code that builds but breaks important behaviour deploy automatically? **Yes.**" A dropped `agencyId` filter that still type-checks, a broken billing branch, a wrong milestone gate — all ship on push-to-master. The tenant-isolation test (a real safety asset) never runs. A bad migration committed to master auto-applies to the prod DB on deploy.
- **Current protection:** `next build`/tsc catches type errors only.
- **Severity:** 🟠 **HIGH** (deployment safety; the gap between "has good tests" and "runs them").
- **When it matters:** Every deploy; acute for billing/tenant/migration changes.

### 🟡 Finding 5 — Billing latent bugs (dormant today; must fix before the kill-switch flips on)

- **5a — First-outsourced-free reversal over-credits.** Forward path bills a first-free file at £0 (`accrual.ts:138-150`), but `billing-reversal.ts:120-128` computes the credit as the full band fee via `computeFee(...)` and never checks `firstOutsourcedFree` → a CreditNote for £250–£350 against a sale invoiced at £0 (silent money out). **FACT.** Dormant now because nothing leaves `building` while the kill-switch is off. **Severity: MEDIUM (when ON).**
- **5b — Crash window: orphaned/double charge.** `realStripeIssuer` creates the auto-charging Stripe invoice (`issuance.ts:63`) then the caller persists `stripeInvoiceId` (`:151`). A crash between → Stripe idempotency keys live only 24h, but the monthly cron only touches `priorMonthStart`, so the stuck month is never auto-retried. A manual re-run after 24h charges a second time; even without a re-run, the `payment_succeeded` webhook can't match (`noop_invoice_not_found`) → money in, recorded unpaid. **INFERENCE from control-flow; code paths CONFIRMED.** **Severity: MEDIUM–HIGH (when ON).**
- **5c — Reversal recomputes fee from current VAT/tier**, not the frozen invoiced amount (`billing-reversal.ts:114-120`) → credit ≠ charge if VAT registration flips between charge and reversal. **Severity: LOW (when ON).**
- **5d — First-free eligibility is a count-then-act with no lock** (`billing-trigger.ts:102-112`, self-documented) → two simultaneous outsourced exchanges for one agency could both be granted free. **Severity: LOW; NOT-NEEDED pre-volume.**
- **Direct answer — "Under what realistic circumstances could TSP charge incorrectly TODAY?"** Essentially none via automation: the only charge path is behind `BILLING_AUTO_ISSUE_ENABLED` (off), and every draft artifact reconciles to source-of-truth with proper unique constraints. The only "today" risk is a human misreading an accurate draft in the Stripe dashboard. **The risk profile changes when the flag turns on** — fix 5a and 5b first.
- **When it matters:** Only once `BILLING_AUTO_ISSUE_ENABLED=true`.

### 🟡 Finding 6 — `PropertyTransaction` index gap + admin full-list (first real scale bottleneck)

- **Finding:** `PropertyTransaction` (the central model) declares only `@@index([serviceType, createdAt])`. There is **no index on `agencyId`, `status`, `assignedUserId`, `updatedAt`, `exchangedAt`**. Every per-agency list/count/hub query seq-scans the whole table. Separately, the admin/superadmin `{kind:"all"}` list path (`transactions.ts:39`) loads **every** non-draft transaction platform-wide with heavy includes and no pagination; `client-chase-cron` loads the entire active book into memory. `Contact.propertyTransactionId` is also unindexed.
- **Evidence:** `schema.prisma:655`; `lib/services/transactions.ts:39,57`; `lib/services/hub.ts`; `lib/services/client-chase-cron.ts:188`; `Contact` index at `schema.prisma:944`. *(Seq-scan is INFERENCE from Postgres index semantics — FK/scalar columns aren't auto-indexed; declarations + queries are FACT. No live `EXPLAIN` was run.)*
- **Real-world TSP scenario:** Fine at hundreds of rows. The admin full-list is the first to hurt (~5–20k platform-wide); per-agency reads seq-scanning the whole table bite at ~100k total transactions.
- **Severity:** 🟡 **MEDIUM now, HIGH at 100k.** Single highest-value change: `@@index([agencyId, status])` + `@@index([agencyId, createdAt])` on `PropertyTransaction`, `@@index([propertyTransactionId])` on `Contact`, and pagination on the admin list. **Not premature** — these back essentially every agency-scoped read.
- **When it matters:** Admin list ~5–20k; per-agency ~100k.

### 🟡 Finding 7 — Cron auth fails open if `CRON_SECRET` is unset; no shared helper

- **Finding:** 40 of 41 cron routes compare inline to `` `Bearer ${process.env.CRON_SECRET}` ``. If the env var is ever unset, the target becomes `"Bearer undefined"` and any caller sending that is accepted. Only `reminders/run` fails closed (`route.ts:7-11`).
- **Evidence:** e.g. `app/api/cron/issue-invoices/route.ts:16`, `drain-outbound-email/route.ts:9`, `client-chase/route.ts:26`. Already noted in `docs/audits/PRE_LAUNCH_FINAL_SIGNOFF.md:209`.
- **FACT. CONFIRMED** (behaviour); **Env** (actual prod value not in repo).
- **Real-world TSP scenario:** A new preview environment or an env reshuffle drops the secret → money/comms crons become publicly triggerable by `Bearer undefined`.
- **Severity:** 🟡 **MEDIUM** (contingent on misconfig). Fix: one shared `requireCron()` helper that returns false when the secret is unset.
- **When it matters:** Env-var drift across environments.

### 🟡 Finding 8 — Rate limiting is fully built but a no-op (flag off)

- **Finding:** A complete limiter layer exists and is correctly wired at auth/signup/AI/email/portal call sites, but every limiter returns PASS unless `RATE_LIMIT_ENABLED==="true"` **and** Upstash creds are set.
- **Evidence:** `lib/ratelimit.ts:18-23` and every `check*Limit` opening with `if (!isEnabled()) return PASS`. Call sites: `lib/auth.ts:71`, `app/api/register/route.ts`, AI and email/invite routes. Two auth limiters fail-open on Redis error (acceptable).
- **FACT. CONFIRMED** (code); **Env** (prod flag value).
- **Real-world TSP scenario:** Paid-only with ~5 users → low risk. The documented free-agency public-signup launch turns unmetered `authorize()` (credential stuffing), `/api/register` (account farming), AI endpoints (unbounded Anthropic spend) and email endpoints (SendGrid amplification/reputation) into real exposure.
- **Severity:** 🟡 **MEDIUM now → HIGH at public signup.** It's a config flip, not a build.
- **When it matters:** The moment public/free signup opens.

### 🟡 Finding 9 — Monitoring has no alerting; self-caught cron 500s bypass Sentry

- **Finding:** `JobRun` records cron outcomes but is consumed only by the `/command/health` dashboard — there is no push/email/Slack/paging on failure. Crons that catch their own error and return a 500 JSON never throw, so Sentry's auto-instrumentation doesn't see them (only `JobRun` does). Manual `captureException` appears only in a test button.
- **Evidence:** `lib/cron/run-job.ts`; `app/command/(protected)/health/page.tsx:120-165`; `app/api/reminders/run/route.ts:34-37` (catches → 500). Sentry configured but DSN-gated (`sentry.server.config.ts`; prod DSN value — **Env, cannot be confirmed from repo**).
- **FACT. CONFIRMED** (code); PARTIAL on prod Sentry DSN.
- **Real-world scenario — "Agent says TSP did something wrong yesterday at 14:32, can we reconstruct it?"** **Mostly yes:** emails to agency/agent (`AgentEmailLog`), emails to clients (`OutboundEmailQueue` + activity), cron outcomes (`JobRun` with error text), login events (`[AUDIT]` console, but ephemeral/not queryable). **Partial:** a unified "internal user X clicked Y at 14:32" trail (reconstructable via milestone/risk history, not a single audit log). **Only if Sentry DSN is live:** an unhandled exception — and self-caught cron 500s escape it.
- **Severity:** 🟡 **MEDIUM–HIGH** (no proactive alerting on money/comms job failure; combined with Finding 3, a SendGrid outage could drop a day of comms before anyone notices).
- **When it matters:** Any incident not caught by someone glancing at `/command/health`.

### 🟡 Finding 10 — SendGrid out-of-order event can re-block a paid agency

- **Finding:** After `payment_succeeded` clears `agency.paymentFailedAt`, a later-arriving stale `invoice.payment_failed` hits `updateMany({ where: { paymentFailedAt: null } })` and re-sets it (invoice stays `paid`, but the agency is flagged failed and a downstream cron could set `newFileCreationBlockedAt`).
- **Evidence:** `lib/billing/stripe-webhook.ts:77-78,106-108`.
- **INFERENCE; code paths CONFIRMED.**
- **Severity:** 🟡 **MEDIUM** (Stripe rarely emits failed-after-succeeded, but redelivery/out-of-order is possible). An event-ID ledger with ordering, or checking invoice status before flagging the agency, closes it.

### 🟡 Finding 11 — SendGrid event/bounce webhook: no dedupe, always-200, no replay-freshness

- **Finding:** Duplicate `deferred` double-counts (`deferredCount + 1` per delivery), duplicate bounce/blocked creates duplicate broker-callback notifications, per-event failures are swallowed and the route always returns 200 (so SendGrid never retries → a lost hard-bounce means `suppressUserByEmail` never runs and TSP keeps emailing a dead address). Signature verified but bypassed if the public key is unset; signed timestamp not checked for freshness.
- **Evidence:** `lib/email/sendgrid-webhook.ts:108-112,169-174,255-287`; `app/api/webhooks/sendgrid-bounce/route.ts:71,139`.
- **FACT. CONFIRMED.**
- **Severity:** 🟡 **MEDIUM** (suppression-list integrity + duplicate bells).

### 🔵 Lower-severity findings (LOW)

- **No optimistic concurrency on whole-file edits** — last-writer-wins on plain `PropertyTransaction` field updates (`milestones/route.ts:109`; `portal.ts:1031`). Milestone state is individually safe. (Race Finding 13.)
- **`bulkCompleteMilestones` uses `Promise.all` inside `$transaction`** (`milestones.ts:1533-1572`) — the exact pattern the team deliberately serialised in `bulkMarkNotRequired` for PgBouncer safety; an uncaught P2002 could abort a batch. (Race Finding 12.)
- **No `maxDuration` on several money/comms crons** (`drain-outbound-email`, `send-milestone-digests`, `client-chase`, `issue-invoices`, …) → platform default timeout; interacts with Findings 2/3. Silent row caps (50/200) defer overflow with no surfaced "N deferred" signal. (Cron Finding 7.)
- **Command-Centre API self-gates per file** (`middleware.ts:41` covers `/command` not `/api/command`); no hole found in ~15 sampled routes, but no central enforcement. (Auth Finding 4.)
- **`$executeRawUnsafe` with an escaped, interpolated `IN` list** in the bounce webhook — signature-gated, escaped; switch to `Prisma.join`. (Auth Finding 9.)
- **`dangerouslySetInnerHTML` on the agent's own signature preview** — self-XSS at worst; sanitizer (`xss` lib) applied on save. (Auth Finding 10.)
- **`InvoiceLine` has no `(invoiceId, transactionId)` unique** — concurrent accrual could double-line; near-impossible at daily cadence. (Race Finding 11.)
- **"One active BuyerRound per transaction" is app-enforced, not a DB constraint** — flag before relist status goes live. (DB Finding B4.)
- **Append-log tables have no FK and no retention** — intentional, but unbounded growth. (DB Finding B2.)

---

## 8. Failure-mode walkthroughs (what TSP actually does today)

1. **User double-clicks an important action (milestone confirm).** ✅ Safe. `updateMany` state-guard + partial unique index → one write wins, side effects fire once (`milestones.ts:1108-1202`). Portal double-tap also early-returns on `state === "complete"` and the email queue dedupes by unique constraint.
2. **Cron executes twice simultaneously.** ⚠️ Mixed. Milestone-digest drain and escalation/celebration flips are safe (atomic claim). `drain-outbound-email` and `drain-chain-neighbour-updates` are **not** — both runs read the same `sentAt:null` rows and both send (Finding 2). Billing issuance is safe via Stripe idempotency keys.
3. **Email provider accepts the email but TSP times out.** ⚠️ The row stays `sentAt:null` → re-sent next run = **duplicate** (Finding 2/3). The milestone drain instead claims before send, trading the duplicate for a rare lost-on-kill (Finding 3 residual).
4. **Webhook arrives twice.** ✅ Stripe: state-guarded `updateMany` no-ops the second (`stripe-webhook.ts`). ⚠️ SendGrid event: `deferredCount` double-increments and duplicate bounce notifications fire (Finding 11).
5. **Webhook arrives late / out of order.** ⚠️ Stripe: a stale `payment_failed` after success re-flags a paid agency (Finding 10). SendGrid: near-idempotent except counters.
6. **Two users edit the same transaction simultaneously.** ⚠️ Milestone state is safe; plain field edits are last-writer-wins, no conflict warning (Finding, LOW).
7. **External API unavailable.** ⚠️ SendGrid: no explicit timeout/retry → throw → permanent `errorAt`, no alert (Finding 3). Anthropic: non-critical, SDK default retries. PostHog detectors: correct `AbortSignal.timeout`. Billing/Stripe: per-invoice try/catch isolates failures.
8. **DB op fails halfway through a workflow.** ✅ Milestone completion + billing stamp run in `$transaction` and roll back atomically; `wonRace=false` skips side effects. ⚠️ The email drains aren't transactional with the send (they can't be — the send is external), which is the root of Findings 2/3.
9. **Billing process invoked twice.** ✅ Deterministic Stripe idempotency keys + already-issued skip + `@@unique([agencyId, monthStart])` (`issuance.ts`). Charge path also kill-switched off.
10. **Authenticated user accesses another org's transaction.** ✅ Blocked. Resource resolved through `scopeOwnershipWhere` before acting → 404 on mismatch; CI test enforces the pattern. No IDOR found in ~20 sampled routes.

---

## 9. Scale assessment (what breaks first, roughly when)

| Rank | First to break | Trigger | Fix |
|---|---|---|---|
| 1 | Admin `{kind:"all"}` full list (no pagination, heavy includes) | ~5–20k platform-wide txns | Paginate + scope |
| 2 | Per-agency list/hub/count seq-scanning whole `PropertyTransaction`; `Contact` by-tx scans | ~100k total txns | `@@index([agencyId,status])`, `([agencyId,createdAt])`, `Contact([propertyTransactionId])` |
| 3 | `client-chase-cron` loading whole active book into memory | ~10k active files | Batch/paginate the scan |
| 4 | Duplicate-send exposure widens as email volume rises | Email growth | Atomic claim on drains (Finding 2) |
| 5 | Append-log tables unbounded (`Event`, `ReminderLog`, `OutboundMessage`, history) | 1M+ rows | Retention/archival job |
| 6 | Nightly rollup full-scans on non-leading date columns | 1M+ txns | Dedicated index or materialised rollup |

**Fine for years:** per-file detail reads (well-indexed), notification bell, the paginated comms list (cursor pagination, `automated-emails-list.ts:457`), billing idempotency, cron drain selection indexes. **No premature optimisation warranted** beyond rank 1–2, which are cheap and load-bearing.

---

## 10. Senior engineer's priority list

### FIX BEFORE RELYING ON THIS IN PRODUCTION
1. **🔴 Finding 1 — relist email leak.** Add the dead-round + `portalEligible` guard to the synchronous portal-confirm fan-out (`portal.ts:1311` fetch / `:1508` loop), matching the guard the queue drains already have. This is a live wrong-recipient disclosure.
2. **🟠 Finding 2 — atomic claim on `drain-outbound-email` and `drain-chain-neighbour-updates`** (and the solicitor/chain send passes). Reuse the milestone-drain pattern. Prevents duplicate client/solicitor emails on cron double-fire.
3. **🟠 Finding 3 — email retry + failure alerting.** Requeue transient `errorAt` rows (bounded retries, then dead-letter) and alert on the dead-letter / on `JobRun` failure. Today a SendGrid hiccup silently drops client comms.
4. **Before flipping `BILLING_AUTO_ISSUE_ENABLED=true`: Findings 5a + 5b** (first-free reversal over-credit; crash-window orphan/double-charge + webhook reconciliation). These are the two I would not ship billing-on without fixing.

### IMPROVE AS TSP GROWS
- **🟠 Finding 4 — stand up CI** that runs the existing Jest suite (billing idempotency, tenant isolation, email dedup, relist guards) and blocks merge to master. This is the highest-leverage durable investment; the tests already exist.
- **🟡 Finding 6 — the `PropertyTransaction`/`Contact` indexes + admin-list pagination** (before ~100k / the admin path sooner).
- **🟡 Finding 7 — a shared `requireCron()` helper** that fails closed when the secret is unset.
- **🟡 Finding 8 — flip rate limiting on before public/free signup.**
- **🟡 Finding 9 — alerting on cron/job failure; throw (or `captureException`) from crons so Sentry sees them.**
- **🟡 Findings 10/11 — a Stripe/SendGrid event-ID ledger** once new event types are added, and fix the SendGrid double-count/always-200 suppression gap.
- **Append-log retention policy** before 1M rows.

### LEAVE ALONE (adequate, or would be unnecessary complexity)
- ⚪ **MCP** — correctly absent.
- ⚪ **Distributed locks / dedicated queue / read replicas / sharding** — the Postgres atomic-claim pattern is the right weight.
- 🟢 **The milestone engine, exchange-billing stamp, invoice idempotency, Stripe-webhook idempotency, tenant-scope helper, caching (tenant-safe), sender-identity resolver, auth hardening** — these are done well; don't refactor them.
- **Manual input validation** — adequate; no mass-assignment vector. Adding zod everywhere is optional polish.
- **Optimistic concurrency on whole-file edits** — low real-world impact at current collaboration patterns; revisit only if edit-collision complaints appear.

---

### Evidence standard & limits
Findings marked **FACT** are verified against the named file/line. **INFERENCE** is flagged where a conclusion rests on control-flow reasoning or Postgres semantics rather than an executed test (notably the seq-scan scale claims — no live `EXPLAIN` was run — and the billing crash-window). Items dependent on Vercel/Stripe/SendGrid/Supabase configuration (the prod Sentry DSN, the real values of `CRON_SECRET` / `RATE_LIMIT_ENABLED` / `BILLING_AUTO_ISSUE_ENABLED`, SendGrid webhook key) are marked **Env — cannot be confirmed from repository**; each notes what to check. Route coverage for tenant isolation was a ~20-of-199 sample backed by the static CI test; the Command-Centre API was ~15-of-40. No mutating operation was performed.
