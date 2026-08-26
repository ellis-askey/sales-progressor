# Free self-managed launch — remediation spec

**Status:** planning (no build started). Source: opportunity/improvement audit, 2026-08-26 (four parallel audits of the `/agent/*` self-managed surface).
**Goal:** make the self-managed tier (roles `director` / `negotiator`, `agencyId` set) safe and coherent to hand to any agency **for free**, so we can drive name recognition and let outsourced revenue follow later.
**Core problem the audit found:** the product is well-built for us running files in-house, but it assumes "you" = the Sales Progressor team, not an independent agency. That assumption leaks into email identity, billing, automations, and language.

This doc is the build plan. Each phase is independently shippable, ordered by launch-criticality. We work through them one at a time; each closes specific audit findings and has acceptance criteria. Per Law 5, each sub-item is its own PR where practical.

---

## Guiding principles
- Nothing external-facing ships until **Phase 0** (safety + free) passes. Those are hard gates.
- A free self-managed agency must never: see another agency's data, be shown a price/charge, or send client email branded as Sales Progressor.
- Prefer real, self-explanatory controls over hidden behaviour (Law 13). Every client-facing automation should be previewable and stoppable by the agent whose clients receive it.

---

## Phase 0 — Safety & "free" foundation (LAUNCH GATE)
*Why first: cannot let external agencies in until data is provably isolated and the app isn't trying to bill them.*

**STATUS (2026-08-26): built.** 0.1 shipped (`c4c30fde`), 0.2 shipped (`d29d4ea6`, migration `20260826120000_client_type_free`). 0.3 needs no code — throttles are wired but off; Ellis provisions Upstash (steps in `docs/active/ELLIS_MANUAL_TODO.md`).

### 0.1 Multi-tenant data isolation — verification + fixes
**Verdict (2026-08-26 deep-dive): substantially clean.** No path found where one agency can read another agency's transactions, contacts, milestones, tasks, or comms. Verified scoped: list (`lib/services/transactions.ts:26-37,337-344`), detail (`app/agent/transactions/[id]/page.tsx:122-139`), both search endpoints (`app/api/search/route.ts:36-67`, `app/api/agent/search/route.ts:53-83`), contacts write (`app/actions/contacts.ts:40-141`), milestones write (`app/api/milestones/route.ts:30-34`), AI chase (`app/api/ai/generate-chase/route.ts:123-158`), manual-task edit/delete (`lib/services/manual-tasks.ts:162,189`).

Two **low-severity** residual leaks to fix before launch (neither exposes file content):
- **0.1a** `app/api/manual-tasks/route.ts:76-85` (legacy POST) stores a client-supplied `transactionId` **without checking it belongs to the caller's agency**. A crafted request referencing another agency's tx id (a guessed cuid) would render that tx's **property address** in the attacker's own to-do list. Add an ownership check (`scopeOwnershipWhere`).
- **0.1b** solicitor-firm search returns a `fileCount` counted **across all agencies** (`app/api/search/route.ts:81-94`, `app/api/agent/search/route.ts:97-104`). Aggregate-only leak (how many files a firm handles platform-wide); scope the count to the agency.
- Add an automated test asserting agent list/detail/write paths scope via the access-scope helper.
- **Acceptance:** 0.1a + 0.1b fixed and covered; test in place.

### 0.2 A real "free agency" flag
Today "free" only exists as the 14-day trial (`freeOnExchange`, `lib/services/trial.ts`). There is no permanent free concept, so a free agency still sees a £59 charge.
- Add an agency-level free flag (decision needed: boolean on `Agency` vs a plan/tier field — see Open Decisions).
- When set, for that agency's files:
  - Force `freeOnExchange` true at create (`lib/services/trial.ts:44,71-80`).
  - Hide the "Progressor fee £59" row and stop deducting it from "Net income" (`components/transaction/AgentFileSidebar.tsx:196-217, 507-514`; gate at `SidebarPanel.tsx:348`).
  - Suppress the day-21 card-capture nag (`components/billing/PaymentMethodNudge.tsx`).
  - Skip the exchange billing stamp (`lib/services/billing-trigger.ts:59-74`).
  - Replace/suppress "Your fee is crystallised" (`components/milestones/ExchangeCelebration.tsx:116`).
- **Acceptance:** a free agency sees no price anywhere, no card nag, no charge recorded at exchange; net-income shows only their own commission.

### 0.3 Rate limiting / abuse controls (pre-flood gate)
The rate-limit layer is fully written but **switched off** — `lib/ratelimit.ts:18-23` no-ops every limiter because `RATE_LIMIT_ENABLED` and Upstash creds are absent. With free signups this leaves several surfaces unmetered:
- AI chase generation → unbounded Anthropic token cost (`app/api/ai/generate-chase/route.ts:61`).
- Email/invite/portal volume → unbounded SendGrid spend (`checkEmailLimit`/`checkInviteLimit`/`checkPortalLimit`).
- Auth/signup → login brute-force + account farming (`checkAuthLimit`/`checkSignupLimit`).
- **Action:** provision Upstash + set `RATE_LIMIT_ENABLED=true` (the metering logic is per-user and already correct). Image gen is separately gated behind a pending Replicate token (lower risk).
- **Acceptance:** limiters active; a scripted burst on AI/email/auth is throttled. Add env-var + provisioning steps to `docs/active/ELLIS_MANUAL_TODO.md`.

**Closes audit points 6–9, 32; adds cost/abuse hardening.**

---

## Phase 1 — Email sender identity (TRUST BLOCKER)
*Why: an agency's clients currently receive automated email branded "Sales Progressor", and replies route to us.*

**Reframe (verified in code):** the send resolver already sends from the agency when `Agency.quoteSenderEmail` is set, and SendGrid domain-auth already exists (founder + self-serve). The gap was (a) nothing set `quoteSenderEmail` on verify, and (b) the pre-setup fallback showed plain "Sales Progressor". So Phase 1 = wiring + Option C, not a build.

**Approach — Option C (founder decision):** a client email ALWAYS shows the agency as sender ("{agent first name} at {Agency}") with the agent's own email as reply-to, even before any DNS setup. Only the actual address stays `updates@thesalesprogressor.co.uk` until they verify a domain, then it swaps automatically. DNS setup is a recommended upgrade (own address + isolated sending reputation), **not a gate** — this replaces the earlier hold-vs-send decision.

**STATUS (2026-08-26): shipped.**
- **1a** ✅ (`e36d17e5`) Option C branding + agent reply-to in `resolveAgencySenderForTransaction`; once on their verified domain, a neg/director whose own email is on it sends from their personal address (SP model).
- **1b** ✅ (`e36d17e5`) `adoptVerifiedDomainAsAgencySender` sets `updates@<domain>` when a domain verifies — called from all three verify paths (founder, self-serve, nightly cron). Fills a blank only.
- **1c** ✅ (`4fcbe4bc`) honest success copy on the sending-address screen.
- **1d** ✅ (`4fcbe4bc` + `780d9832`) routed all client-facing leaks through the agency sender: portal-message reply, survey-quote link, "visible update", and the completion "what happens next" pack (both the send-now and scheduled/enqueued paths — the queue drain forwards payload.from/replyTo). Also fixed the shared `portalEmailHtml` footer ("contact your sales progressor" → "just reply to this email"). Command Centre sender reference updated.
- **Remaining/optional:** agency logo in client emails (stretch). The portal-message→agent notice is agent-facing, left as SP.
- **Acceptance:** a client email always shows the agency as sender with replies to the agent; on domain verify it swaps to their address automatically. ✅ met for the wired paths.

**Closes audit points 1–5.**

---

## Phase 2 — Automation transparency & control
*Why: powerful client-facing automations fire with no preview and, in two cases, no off-switch for the agent whose clients get them.*

- **2.1 Exchange-day preview:** before "Start exchange day", show what will send, to whom, and at what times (up to ~10 emails on a two-sided file; clients get an action button). `components/transaction/ExchangeDayControl.tsx`, `lib/exchange-day/*`.
- **2.2 Milestone-confirm cue + control:** warn "this will email your buyer and seller" before confirming, and expose the confirmation-email off-switch to self-managed agents (currently internal-only, `components/transaction/EmailSettingsDrawer.tsx:235`; fan-out at `app/actions/milestones.ts:312`).
- **2.3 Weekly "all on track" email:** make it respect unsubscribe / hold flags and add an agency-level opt-out (`lib/services/client-weekly-update.ts:37`). **Compliance item** — it currently emails people who unsubscribed.
- **2.4 Chase visibility:** give self-managed agents a client-safe view of what's being chased (un-gate the chase timeline from founder-only, `app/agent/transactions/[id]/page.tsx:544`, and/or surface chase sends on the file — they're currently absent from the activity feed, `lib/services/comms.ts`).
- **Acceptance:** agent can preview exchange-day sends; confirming a step warns and is toggleable; the weekly email honours opt-outs; the agent can see who's been chased and how often.

**Closes audit points 10–14, 13.**

---

## Phase 3 — Remove the "our team / progressor / outsourced" scaffolding for self-managed agencies
*Why: these imply a support team stands behind the agency; for a self-managed agency they dead-end or read as broken.*

- **3.1** Hide or re-point "Send a note to our team" (`app/agent/transactions/page.tsx:169`, `legacy-hub.tsx:183`, `app/api/agent/flag/route.ts`).
- **3.2** To-Do page: remove the "your progressor" section, CTA, and "with progressor" stat for self-managed (`app/agent/to-do/page.tsx`, `components/agent/AgentTodoList.tsx:198,277,542`).
- **3.3** New-sale: hide the "Send to us — our team takes it from here" option for agencies with no outsourcing (`components/transactions-v2/form/Stage1Fields.tsx:143`).
- **3.4** Hub service-split donut (`legacy-hub.tsx:783`, `ServiceSplitDonut.tsx`), "With progressor" hero pill + redundant "Self-managed" badge (`components/transaction/PropertyHero.tsx:273`), and the "Our team is handling" list filter (`TransactionListWithSearch.tsx:254`).
- **Acceptance:** a self-managed agency sees no reference to a progressor, "our team", or outsourcing anywhere in its normal flow.

**Closes audit points 15–18.**

---

## Phase 4 — Voice & jargon polish
*Why: reads as unfinished; quick wins.*

- "N/R" button label (`MilestoneRow.tsx:675`), "reconciliation" (`ReconcileLaterBanner.tsx`), "crystallised" (`ExchangeCelebration.tsx:116`), "Delete"→"Remove" (`ContactsSection.tsx:343`), stray em-dashes (`StatusControl.tsx:376`, `ReconcileLaterBanner.tsx:242`), and milestone-vs-"Steps" noun consistency. Voice gate per `docs/reference/VOICE.md`.
- Gate the dev/QA routes under `/agent/*` (anim-preview, polish, audit/overlays) to internal roles so external agents can't reach raw-code pages.
- **Acceptance:** VOICE.md passes on agent-facing strings; no dev routes reachable by an agency.

**Closes audit points 19–22.**

---

## Phase 5 — Onboarding reinforcement (polish, optional)
*Onboarding is already good (points 23–25); this is reinforcement only.*
- Kinetic-hub empty-welcome state (only needed if the kinetic hub is rolled to agencies).
- Re-entry path for the portal-invite prompt (currently one-shot).
- Agency logo/branding in client-facing surfaces.
- Light "what this does" guidance on the powerful controls.

---

## Out of scope (for this arc)
- WhatsApp capture (internal-team feature; parked separately — see `docs/audits/WHATSAPP_CAPTURE_AUDIT_2026-08-25.md`).
- Any paid-plan / upgrade / conversion flow (free launch first; monetisation later).
- Marketing site / signup funnel changes.

---

## Open decisions (need founder call before the relevant phase)
1. **Free modelling (0.2):** a simple `Agency.freeTier` boolean, or a proper plan/tier field that anticipates future paid conversion? Boolean is faster now; a tier field is cleaner long-term.
2. **Sender fallback (1.5):** before an agency verifies its own address, do we (a) block automated client sends until they set it up, or (b) send but clearly label it's on our infrastructure? (a) is safer for trust; (b) keeps the file moving.
3. **Outsourced option for external agencies (3.3):** hide the "send to us" path entirely, or keep it as a future opt-in upsell? Recommend hide entirely for now.
4. **Weekly email opt-out default (2.3):** on or off by default for a new free agency?
5. **Chase visibility (2.4):** un-gate the existing chase timeline as-is, or build a simpler client-safe summary for agents?

---

## Traceability — audit points → phase
| Audit points (plain-English list) | Phase |
|---|---|
| 1–5 (email sender identity) | 1 |
| 6–9 (free isn't free) | 0.2 |
| 10–14 (hidden automations) | 2 |
| 15–18 (our-team / progressor scaffolding) | 3 |
| 19–22 (jargon / voice) | 4 |
| 23–25 (onboarding — already good) | 5 (reinforce only) |
| 32 (tenant isolation) | 0.1 |

---

## Manual / founder steps this arc will create
- Per-agency DNS/domain authentication will still need the agency's cooperation (adding DNS records). Phase 1 should make this as self-serve as possible; anything that remains manual goes in `docs/active/ELLIS_MANUAL_TODO.md`.
- Any new env vars or third-party config surfaced during build → `docs/active/ELLIS_MANUAL_TODO.md`.
