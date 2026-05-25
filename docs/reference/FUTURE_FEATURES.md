# Future Features & Strategic Vision

> **⚠️ CC SESSIONS: DO NOT USE THIS FILE AS A REFERENCE.**
> Nothing in this document is built. It is aspirational only.
> It should not be cited in commit messages, used to infer architecture,
> or treated as a source of truth for anything in the current codebase.
> For what is actually built, see CLAUDE.md and the code itself.

---

*Written: 2026-05-07. Based on full codebase audit at commit 6b56d92.*

---

## What I noticed (strongest impressions from the audit)

**1. The chain is the most important feature in the codebase and it has no product built on top of it.**
Twelve commits built `PropertyChain`, `ChainLink`, stub link fields, invite flows, claim flows. But there is no chain health view, no chain risk dashboard, no cross-chain milestone visibility, nothing. The pipes for the single most valuable insight in residential property — is the chain moving? — are built. The product is not.

**2. The portal is passive. It should be the most active part of the product.**
Clients can see their milestones and confirm a few of them. What they cannot do is the thing that would actually speed up their transaction: upload a document, confirm a date, acknowledge their mortgage offer. The portal treats clients as observers. The most important behavioral change Sales Progressor could drive — clients doing their part without being chased — is not implemented.

**3. The reminder engine fires blind.**
It has no feedback loop. It fires chases on the same schedule regardless of whether Jones & Co always respond within 24 hours or have never responded to anything. The response data is all there in `OutboundMessage` and `MilestoneCompletion`; nothing reads it back.

**4. A cross-agency solicitor intelligence network exists but isn't a network yet.**
Solicitor firms are global (since commit `08f5dc7`). Performance data accumulates per firm across every agency on the platform. It's surfaced only within each agency, as if the other agencies don't exist. Aggregate it and you have the most accurate solicitor performance database in UK residential property. Nobody else has this. It compounds with every transaction.

**5. The AI integration plays checkers when it should be playing chess.**
Chase drafting and problem flagging are thoughtful. But every AI invocation is about one agent, one transaction, one moment. There is no multi-transaction, cross-agency AI layer. The platform sees patterns that no individual agent can — and never tells anyone.

---

## Ranked improvements (highest ROI first)

---

### 1. "This deal is dying" — cross-transaction AI silence detector
**The insight.** The problem detection cron already runs 7 rule-based checks. But rules only catch the thing you thought to write down. The real risk is the file that looks fine on paper — no overdue tasks, milestones ticking along — but where the silence pattern matches the 15% of files that historically aborted. The system has the data: `OutboundMessage` timestamps, `MilestoneCompletion` velocity, `confirmedByPortal`, `lastActivityAt`, portal message frequency, chase response gap. Nobody's reading it together.

**What it looks like built.** A nightly job reads the full history of the last 30 days on every active transaction, against a learned model of what "going cold" looks like across all completed and withdrawn transactions. It surfaces a one-line verdict per flagged file on the agent's hub: *"This file has been silent for 11 days since the survey. Vendor solicitor hasn't responded to 2 chases. At this pace, exchange slips 3 weeks."* Not a rule — a synthesis. Director sees it at 9am; they pick up the phone before the client does.

**Why it's high ROI.** Every prevented fallthrough is the difference between £59 and £0, plus the agency relationship. The data to train on exists today in `fallThroughReason`, milestone velocity, and communication history. The AI infrastructure already exists (problem detection, daily brief). This is a prompt redesign and better signal aggregation, not a new system.

**Effort.** Small–Medium.

**Dependencies.** The `fallThroughReason` field needs to be more consistently populated. Worth adding 5 standard options as a dropdown when marking withdrawn.

---

### 2. Chain health as a product — the visibility nobody in the market has
**The insight.** The chain feature has 12 commits of schema, invite flow, and claim mechanics. But there is no chain dashboard. `PropertyChain` and `ChainLink` hold exactly what you need: which transactions are linked, which links have been claimed, which are stubs, which are unclaimed invites. A residential chain is where transactions die — often because a link two transactions down the chain falls through. This is the one piece of intelligence that neither the agent, the solicitor, nor the conveyancer has in real time.

**What it looks like built.** A chain view on the transaction detail page: a horizontal chain diagram showing each link (property address, side, agency if claimed, stub if not). Each link has a health indicator: green (on track), amber (stalled), red (at risk), grey (unclaimed). If two agencies are both on Sales Progressor, their data joins — the director at Agency A can see that the link below them in the chain hasn't moved a milestone in 21 days. An alert fires when any link goes red or unclaimed after 7 days.

**Why it's high ROI.** No tool in the category does cross-chain visibility. This feature justifies the subscription renewal on its own. It also creates viral adoption: Agency A invites Agency B into the platform because they need chain visibility; Agency B signs up.

**Effort.** Medium. Schema is built. Work is: (a) chain health calculation per link, (b) chain diagram UI component, (c) cross-agency data sharing permission model.

**Dependencies.** Chain invite adoption needs to be driven actively — the feature is only useful once multiple agencies are using it.

---

### 3. Make the portal active — give clients a job and they stop needing to be chased
**The insight.** The portal currently surfaces information to clients. It doesn't ask them to do anything. But many milestones that delay transactions are client-side actions: providing identification, confirming a survey date, acknowledging a mortgage offer, uploading proof of funds. The `PortalNextActionCard` exists but only triggers for milestones the client can confirm. The deeper pattern — proactive document requests, date confirmations, structured responses — isn't there.

**What it looks like built.** The portal's "Next action" card becomes genuinely actionable: "Your solicitor needs your ID documents — upload them here" (file upload, stored in `TransactionDocument`). "Your survey is scheduled for [date] — confirm this is correct" (one tap, completes the milestone). Each action auto-completes a milestone on the agent side and suppresses the corresponding chase. The agent's work queue shrinks without the agent doing anything.

**Why it's high ROI.** A single upload to this portal compresses 4 steps across 3 parties into 1. The progressor never had to be involved.

**Effort.** Small–Medium. `TransactionDocument` model exists. Push notifications exist.

**Dependencies.** None. Most self-contained high-value improvement on this list.

---

### 4. Solicitor intelligence as a shared network — the compounding moat
**The insight.** `SolicitorFirm` is global. Performance data accumulates per firm across every agency. Right now it's shown per-agency as if the rest of the platform doesn't exist. The firm that looks "average" to Agency A because they've used it on 2 files looks "slow" when aggregated across 20 agencies. This is a literal network effect, sitting unused.

**What it looks like built.** The solicitor detail card shows: "Jones & Co — Slow (avg 16.2 weeks across 47 files, 5 agencies)". The agent directory shows cross-platform performance, labelled with sample size. A monthly "Solicitor league table" goes to all directors. Over time this becomes the industry reference point for solicitor performance in residential property.

**Why it's high ROI.** Zero-cost to build — the data collection is already happening. Creates a reason to stay on the platform even if a competitor appears. Data becomes a marketing asset.

**Effort.** Small. Aggregation query + UI change. Needs minimum sample sizes before a rating is shown (5+ completed files).

**Dependencies.** None.

---

### 5. Adaptive reminder scheduling — the engine that learns from what it knows
**The insight.** Every time a solicitor responds to a chase within 24 hours, the engine ignores that and fires the next chase on the same schedule. The `OutboundMessage` and `MilestoneCompletion` tables hold the data to calculate per-firm response times. Nobody reads it.

**What it looks like built.** Per-firm grace period adjustments: if a firm's observed response time is 2 days, the engine adds 2 days before the first chase. If a firm never responds until a milestone gets confirmed weeks later, the engine escalates faster. Progressors can see and override the inferred profile per firm.

**Why it's high ROI.** Fewer unnecessary chases = better solicitor relationships = faster confirmations. The product looks intelligent rather than automated.

**Effort.** Medium.

**Dependencies.** Feeds from #7 (chase response tracking) for future data. Can backfill from existing `OutboundMessage` → `MilestoneCompletion` deltas.

---

### 6. Revenue pipeline dashboard — fees that exist but are invisible
**The insight.** `agentFeeAmount`, `agentFeePercent`, `expectedExchangeDate`, `completionDate`, `purchasePrice` are all stored per transaction. None of it is surfaced in a revenue view. A director running 30 active files has no idea if they're looking at £15k in exchange fees this month or £3k.

**What it looks like built.** A "Pipeline" tab on the agent hub: "Closing this month: £18,500 (6 files)". "At risk: £9,200 (3 files in red/amber)". "YTD closed: £52,400". A sortable list of active transactions by predicted exchange date, colour-coded by health. One page, no charts needed, pure information.

**Why it's high ROI.** Directors need this to manage their business. Once they can see "£9,200 at risk," the platform has a concrete financial argument for chasing harder. Every director who uses this feature has a daily reason to log in.

**Effort.** Small. Data exists. It's a query and a UI.

**Dependencies.** Fee fields need consistent population at transaction creation.

---

### 7. Chase response tracking — turn the send log into a conversation health monitor
**The insight.** Every chase shows "Sent." There is no record of whether it was answered. The actual conversation health is invisible.

**What it looks like built.** A "Mark as responded" button on each chase task. When tapped: records timestamp, calculates response time, increments a response-time counter on the solicitor firm. Over 10+ interactions: "Jones & Co — typically responds within 2–3 days" appears on the solicitor card. AI summary on overdue chases: "3 chases sent to vendor solicitor over 14 days with no response — recommend direct call."

**Why it's high ROI.** Near-zero implementation cost, high data value. Even 60% agent compliance gives enough signal to make solicitor intelligence meaningful. Feeds #4 and #5.

**Effort.** Small.

**Dependencies.** None.

---

### 8. "What's happening on this file" — weekly AI narrative per transaction
**The insight.** An agent with 15 active files can't hold the state of each one in their head. They have to reconstruct it by reading the activity log, chase queue, and milestone list. That's 3 minutes per file. The data to generate a paragraph-length briefing already exists.

**What it looks like built.** Every Monday, each active transaction gets a 2–3 sentence AI briefing: "This file last moved 11 days ago when the vendor solicitor confirmed receipt of contract. Two chases to the purchaser solicitor regarding the mortgage application have gone unanswered. Predicted exchange has slipped from 14 June to 28 June based on current velocity." Agent reads it in 10 seconds.

**Why it's high ROI.** Forces agents to confront files they've mentally deprioritised. Turns the platform from a record-keeper into a briefing tool. AI infrastructure already exists.

**Effort.** Small. One weekly cron, one prompt per transaction, one UI card.

**Dependencies.** None.

---

### 9. "Quick start" transaction — from offer accepted to live file in 90 seconds
**The insight.** Creating a transaction requires filling in tenure, purchase type, price, names, solicitors, dates, fees. Most of this isn't available at offer acceptance. Agents delay creating the file because it feels like admin. Every day's delay is a day the system isn't chasing on their behalf.

**What it looks like built.** A "We got an offer" button on the hub. Three fields: property address, purchase price, client first name. Transaction goes live immediately with sane defaults. Portals generated but not yet sent. Chase rules activate. Agent fills in the rest over 48 hours.

**Why it's high ROI.** Every week the system is active on a file is a week of tracking and chasing that wouldn't otherwise happen.

**Effort.** Small. Relax required field validation at creation, add quick-start entry point.

**Dependencies.** None.

---

### 10. Email auto-parse with explicit consent — auto-complete milestones from evidence
**The insight.** Email parser is disabled pending privacy review. The most common reason agents manually confirm milestones is: they received an email confirming something and had to go find the milestone and tick it. That's 3–4 minutes of work per event, across 47 milestones.

**What it looks like built.** Per-transaction opt-in. Agent forwards an email to a dedicated address (e.g. `progress+[txid]@thesalesprogressor.co.uk`); Claude extracts the milestone event, shows the agent: "This email appears to confirm PM10 (Searches Received) — confirm?" Agent taps once.

**Why it's high ROI.** Removes the single biggest friction point in day-to-day progression. At 47 milestones per transaction, potentially 2+ hours returned per file.

**Effort.** Medium. Requires explicit opt-in consent, GDPR review.

**Dependencies.** Consent UI + legal review before shipping.

---

### 11. Predictive exchange date — replace linear extrapolation with a real model
**The insight.** Current prediction: `(weeksElapsed / percent) * 100`. No awareness of solicitor firm history, purchase type, chain depth, or time of year. Produces confident-looking numbers that can be 4 weeks off.

**What it looks like built.** A model trained on completed transactions: features are solicitor firm, purchase type, chain depth, tenure, week of year, milestone velocity shape. Output: predicted exchange date with a confidence interval. "Predicted: 14 June (likely range: 7–28 June)." When the range widens — the file is in trouble before the deadline passes.

**Why it's high ROI.** Accurate forecasting is the core promise. A prediction that's right 70% of the time is vastly more valuable than one that looks precise but isn't.

**Effort.** Medium. Needs a corpus of completed transactions (50+).

**Dependencies.** Time. Train once enough completed transactions exist.

---

### 12. Solicitor login — the "deal room" that triggers network adoption
**The insight.** Solicitors are the most important third party in every transaction and the platform treats them as records in a database. A solicitor who can log in to confirm their own milestones eliminates the need for the chase email. A solicitor who does this across 5 transactions at 3 agencies has a reason to use the platform as a central workspace.

**What it looks like built.** A limited portal for `SolicitorContact`. They log in with email, see only transactions where their firm is listed, confirm milestones relevant to their side, send one-line updates. Confirmation records `confirmedByPortal: true` (already in schema).

**Why it's high ROI.** Every solicitor firm that adopts this is a distribution channel. This is the transition from "tool for agents" to "platform for the transaction."

**Effort.** Large. New auth flow for a third-party type, access control model, limited UI, onboarding.

**Dependencies.** Needs #4 (solicitor network intelligence) compelling enough that solicitors care about their profile.

---

### 13. Fallthrough analytics — the data that makes slow solicitors costly
**The insight.** `PropertyTransaction.fallThroughReason` exists and is barely populated. The platform knows which transactions were withdrawn. Joining that with solicitor firm, purchase type, and milestone completion patterns gives you the fallthrough rate by solicitor firm across all agencies.

**What it looks like built.** A "Risk profile" section in the solicitor detail view: fallthrough rate (platform-wide), completion rate, and the average milestone where files with that solicitor stalled. An annual "Fallthrough report" — anonymised, sent to all directors, ranking firm risk profiles.

**Why it's high ROI.** Zero engineering cost for data collection (already happening). The report becomes press.

**Effort.** Small for basic analytics.

**Dependencies.** Needs consistent fallthrough reason logging — add a required reason dropdown when marking withdrawn.

---

### 14. Benchmark data as industry currency — publish what you know
**The insight.** The platform knows average time from offer accepted to exchange, by region, purchase type, and price band. No public source has this with this resolution.

**What it looks like built.** A quarterly "UK Exchange Benchmark" report — average weeks to exchange by region, purchase type, price band. Published publicly. Free. Builds the category, drives inbound from solicitors and industry press.

**Why it's high ROI.** Zero marginal cost once there are enough completed transactions. Creates a press hook.

**Effort.** Small once 100+ completed transactions exist.

**Dependencies.** Sample size.

---

### 15. The pricing page is selling something that doesn't exist — fix the positioning
**The insight.** The outsourced tier (£250+ per file) is advertised. The internal staff workflow doesn't work end-to-end. A potential customer who tries the outsourced tier and finds it doesn't work will not become a self-managed customer either.

**Two options:**
- (a) Pull the outsourced tier from the public pricing page until it works. Position the product as B2B-only (£59/file, agents do the work).
- (b) Build Package D properly and make outsourced a real beta. 3–5 days of engineering, unlocks 4x unit economics.

**Why it's high ROI.** The difference between £59 and £250 is 4x revenue per file.

**Effort.** Small–Medium (Package D).

---

### 16. Rethink the escalation model — "escalated" doesn't mean the right thing
**The insight.** The current priority model is binary: `normal` → `escalated`. Escalation is triggered by time overdue, not by the severity of what's being chased. If everything escalates mechanically after N days, priority loses meaning.

**What it looks like built.** A third tier: `urgent` (exchange-blocking milestones with target exchange within 14 days). Work queue separates: "Urgent — exchange at risk" (red), "Overdue — needs attention" (amber), "Coming up" (white). Exchange-blocking milestones auto-escalate to urgent when exchange target is within 2 weeks and milestone is incomplete.

**Effort.** Small. Schema change, service update, UI update.

**Dependencies.** None.

---

### 17. RLS hardening — the security prerequisite for Series A
**The insight.** 18 tables are unprotected at DB level. Multi-tenancy is application-side only. One missed `agencyId` filter in a refactor exposes all of Agency A's data to Agency B.

**What it looks like built.** Strict RLS on all tables via `SET app.current_agency_id` Prisma extension middleware. Even if the application layer has a bug, the database rejects the query.

**Why it's high ROI.** Any agency doing due diligence will ask. Any investor at Series A will ask. 2–3 days now vs. reputational damage later.

**Effort.** Medium.

**Dependencies.** None.

---

### 18. WhatsApp chase via Twilio
**The insight.** The schema has `whatsapp` as a valid `CommMethod`. No integration exists. UK solicitors prefer WhatsApp for quick confirmations. Materially higher open and response rate than email in this industry.

**What it looks like built.** Twilio WhatsApp Business integration. AI-generated chase draft routed to WhatsApp instead of email. Delivery and read receipts logged in `OutboundMessage`. Response via Twilio webhook appears in the thread.

**Effort.** Medium. Requires Twilio + WhatsApp Business API approval (1–2 weeks of Meta review).

**Dependencies.** Start Meta review process early — it's the longest lead time item.

---

### 19. Direct listing links on PropertyIntelCard
**The insight.** Today the Zoopla and Rightmove buttons on `PropertyIntelCard` land on postcode-level sold-prices pages, not the property's actual listing with photos. Agents and clients alike expect the button to open the listing.

**What it looks like built.** A direct listing URL cannot be derived from address data alone — both platforms key their URLs by internal listing IDs that aren't returned by Land Registry, EPC, or any other free source. The only legitimate path is a paid third-party data API (PropertyData, Patma, or equivalent) that resolves an address to a current listing URL, and ideally also reports "not currently listed" so the button can gracefully fall back to sold prices.

**Effort.** Small once an API is chosen. Cost is per-lookup or monthly subscription.

**Dependencies.** Worth integrating once paying customer volume justifies the spend. Scraping is ruled out (ToS + robots.txt on both platforms). A manual `rightmoveListingUrl` / `zooplaListingUrl` field on the transaction was considered and rejected — agents would not reliably populate it, so the button would mostly behave as it does today.

---

## Things deliberately not suggested

- **Add a CRM.** Agencies use Reapit/Alto/Jupix. Integrate; don't duplicate.
- **Native mobile app.** Build the PWA portal to be excellent on mobile first.
- **Rightmove transaction import.** Useful shortcut; not differentiated.
- **Referral/affiliate program.** Premature without a density of happy customers.
- **Open API for third-party developers.** Too early; creates support burden without the user base.
- **Standalone solicitor rating product.** Dilutes focus; keep it inside the platform as a moat.
- **Blockchain for property records.** No.
- **P2P agent-to-agent messaging for chains.** The portal is the right abstraction.
- **A marketplace for agents to find solicitors.** Build the intelligence; agents will draw their own conclusions.
