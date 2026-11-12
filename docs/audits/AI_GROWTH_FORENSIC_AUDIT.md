# AI Growth Forensic Audit — Sales Progressor

**Prepared:** 2026-08-29
**Method:** Read-only forensic investigation of the codebase (`prisma/schema.prisma` ~90 models, ~130 API routes, 33 scheduled crons, ~70 services, Command Centre, marketing-audit doc) plus the strategy docs. No production code, data, or migrations were changed. No personal/customer records were inspected — only structures, relationships and derivable capabilities.
**Audience:** This report is written to be handed to a second AI for strategic analysis. It separates evidence from assumption throughout.

### Label key
- **VERIFIED** — I (or an investigation pass) read the code and confirmed the capability exists as described.
- **INFERRED** — deduced from surrounding evidence / consistent patterns, not read line-by-line at source.
- **PROPOSED** — does not exist yet; would require new work. The data or seam usually already exists.
- **[COMPUTED]** — a live code path already produces this today.
- **[LATENT]** — the data sits in tables, but nothing reads it this way yet.

> A note on scepticism (the founder asked for this): several capabilities that feel "shipped" are gated dormant on a missing API key, an unpaired mailbox, or an unscheduled cron. Those are flagged explicitly. Do not count them as live reach.

---

## 1. Executive Snapshot

**What TSP actually is today.** On the tin it is a UK estate-agency sales-progression workflow tool: structured milestones (48 seeded steps, VM1–21 vendor / PM1–27 purchaser), automated reminders/chases, and a token-authenticated buyer/seller portal, sold in two tiers (self-managed £59, outsourced £250+). Pre-launch, ~5 test users, no paying customers, and — critically — **every current user is an outsourced file run by TSP's own team; no self-managed customer agency exists yet** (`docs/active/opportunity-sweep-backlog.md`).

**What the code actually is.** A **transaction-intelligence platform that sits on both sides of every deal and across every agency**. It captures solicitor/agent email automatically (Outlook), drafts the chases with AI in six tones across two channels, predicts the exchange date with a self-adjusting model, detects drifting files nightly, scores conveyancers on speed and fall-through across the whole network, coordinates multi-agency chains, and runs a surveyor/broker referral marketplace — across **three** portals (client, solicitor, and the chain-claim landing). Roughly 80% of these differentiators are invisible outside the product.

**The seven most important discoveries:**

1. **There is exactly one real viral loop, and it is excellent** — the chain agent-to-agent invite → `/claim` → new-agency signup. It is fully built and the *only* end-to-end instrumented conversion funnel in the product (`ChainLink` DB stamps + `lib/analytics/events.ts`). A competitor agency becomes a free-trial TSP tenant in ~30 seconds, and each joined agent becomes a new originator. **VERIFIED.** Everything strategic should orbit this.

2. **The people who receive the most value see the least TSP.** Every client email and the entire buyer/seller portal and the entire solicitor portal are white-labelled to the customer agency with **zero TSP branding and no call-to-action**. Thousands of high-trust sessions terminate in a dead end. **VERIFIED.**

3. **A cross-agency conveyancer league table already exists and already runs** — `lib/services/solicitor-intel.ts` computes per-firm median weeks-to-exchange, search turnaround, and fall-through rate over *every agency's* transactions with no agency filter, served over an authenticated API. This is a genuine data network effect that sharpens as volume grows, and it is currently used only as an in-app hint. **VERIFIED [COMPUTED].**

4. **An AI "read the solicitor's email → draft the milestone confirmation → one-click approve" engine (Tier 3 proposals) is fully built** and dormant only because no mailbox has been paired. It is the operational crown jewel and the closest thing to autonomous progression the company has. **VERIFIED, gated.**

5. **Two AI business-intelligence products already generate every day** (daily brief on Haiku, weekly strategic review on Opus) — but only to the founder's inbox. Re-pointed per-agency, they are a ready-made "your pipeline this week" retention/insight product. **VERIFIED.**

6. **The pre-signup funnel is entirely unmeasurable** because it lives in PostHog and **PostHog has no API key** (dormant). Meanwhile three rich first-party datasets — `WeeklyCohort` (retention curves recomputed nightly), portal/file engagement intervals, and `Event.metadata` — are collected at cost and **read by nothing**. **VERIFIED.**

7. **Marketing is behind the product, in places actively hiding real capabilities.** The one "smart" claim the marketing audit told the site to *remove* as vapour — the exchange forecast — is now a real self-adjusting model. The ProofStrip uses fabricated stats the platform is built to compute for real. **VERIFIED.**

**One-sentence thesis for the strategist:** TSP has quietly built a network-effect data business and a genuine viral acquisition loop, then wrapped them in white-label so thoroughly that neither its distribution surface nor its data asset is being converted — the growth is already in the product; almost none of it is switched on.

---

## 2. Product Capability Map

Organised by subsystem. Each capability: what it does · primary user · live/dormant.

### 2.1 Core progression engine (LIVE)
- **Milestone state machine** — 48 seeded `MilestoneDefinition` steps with `weight`, `predecessorCode`, `blocksExchange`, `eventDateRequired`; bilateral vendor/purchaser sides; exchange-gating. Agent + internal. VERIFIED (`prisma/schema.prisma:1169`, `lib/services/milestones.ts`).
- **Reminders / chase engine** — `ReminderRule`/`ReminderLog`/`ChaseTask`, quiet-hours `OutboundEmailQueue` with SendGrid delivery/bounce/open webhooks. Agent + external recipients. VERIFIED.
- **Buyer rounds / relist recovery** — `BuyerRound` retains per-attempt `vendorMilestoneSnapshot` + `chainSnapshot`; full fall-through-and-recover history. VERIFIED (`schema.prisma:562`).
- **Hold periods** — `TransactionHoldPeriod` + `hold-duration.ts` subtract paused time so timing signals are clean. VERIFIED.

### 2.2 AI layer (mostly LIVE; one gated)
| Capability | Model | Consumes | Produces | Surface | Status |
|---|---|---|---|---|---|
| Memo-of-sale parse | claude-sonnet-4-6 (vision/PDF) | uploaded memo | address/price/tenure/parties/both solicitors | Agent, new-sale | VERIFIED LIVE (`app/api/agent/memo-parse/route.ts:75`) |
| Chase generation | claude-haiku-4-5 | chase task, glossary, count, days-silent, role (heavy PII minimisation) | email 80–150w / WhatsApp 50–80w, 6 tone bands | Agent → external | VERIFIED LIVE (`app/api/ai/generate-chase/route.ts`) |
| Draft-for-everyone | Haiku | one fact + address + first name | `{internalNote, clientMessage}` | Agent → client | VERIFIED LIVE (`app/api/ai/draft-update/route.ts`) |
| Email interpret → proposal | Haiku | inbound Outlook email + open steps | `MilestoneProposal {actionType, code, confidence}` | Internal review | VERIFIED LIVE, gated on mailbox (`lib/services/email-interpret.ts`) |
| Problem-detection reasons | Haiku | 8 detector flags | ≤12-word plain-English reason | Agent | VERIFIED LIVE (`lib/services/problem-detection.ts:192`) |
| Daily brief | claude-haiku-4-5 | DailyMetric wk/wk + signals | founder BI email | Internal only | VERIFIED LIVE (`lib/services/insight/daily-brief.ts`) |
| Weekly review | claude-opus-4-8 | context + experiments | strategic review | Internal only | VERIFIED LIVE (`lib/services/insight/weekly-review.ts`) |
| Explain-my-email | Claude | a solicitor email | plain-English summary | **Client portal** | VERIFIED LIVE (`components/portal/ExplainEmailCard.tsx`) |
| Content drafting | Haiku + FLUX images | founder voice corpus | 2 social variants + images | Internal (founder) | VERIFIED, crons unscheduled |

### 2.3 Intelligence / analytics (LIVE, internal)
- **Exchange prediction** — `calculatePhaseAwarePrediction` walks the remaining critical path and shrinks the predicted date as milestones complete; persisted; respects manual override; freezes at real exchange. Agent **and client portal** see the date. VERIFIED (`lib/services/exchange-prediction.ts`, `lib/services/fees.ts`).
- **Risk scoring** — transparent 0–100 fall-through score. Agent only. VERIFIED (`lib/services/risk.ts`).
- **Problem detection** — 8 rule detectors + AI reason, nightly, writes `TransactionFlag`. Agent. VERIFIED.
- **Solicitor intel** — cross-agency firm league table (see §6, §11). VERIFIED [COMPUTED].
- **Property intel** — live Land Registry price-paid (SPARQL) + EPC per property. Agent only; not persisted. VERIFIED (`lib/services/property-intel.ts`).
- **Signals engine** — 17 detectors, living-signal lifecycle, severity-tiered. Internal. VERIFIED (`lib/services/signals/index.ts`). (3 PostHog-dependent detectors are dead — see §7.)
- **Metrics rollup** — `DailyMetric` (global/serviceType/modeProfile/agency) + `WeeklyCohort`. Internal. VERIFIED.
- **Experiment lab** — real baseline/result snapshots, guardrail metrics. Internal. VERIFIED (`lib/services/experiments/`).

### 2.4 Communication & capture (LIVE + gated)
- **Client email stream** — portal-invite, milestone updates, weekly "on track", exchange-day; agency-branded. VERIFIED (invite) / INFERRED (others, same pattern).
- **Solicitor chase + portal** — weekday chases with QR to `/s/[token]`; full token web app to confirm steps. Master switch **OFF by default** per agency. VERIFIED (`lib/solicitor-confirm/`, `lib/services/solicitor-updates.ts`).
- **Outlook capture** — OAuth mailbox read, matches messages to files, logs inbound. Agent. LIVE, unpaired (`lib/integrations/outlook/sync.ts`).
- **WhatsApp capture** — passive inbound ingest via Baileys bridge. LIVE, undeployed (`app/api/integrations/whatsapp/ingest`).

### 2.5 Marketplace & referral (LIVE, thin)
- **Provider directory + quotes** — `ProviderFirm` (surveyor / structural_engineer / mortgage_broker), postcode `ProviderCoverage`, RICS/chartered trust signals, `QuoteRequest` lifecycle with **10% referral fee** capture. Client requests via portal/`/quote/[token]`; admin works a CC inbox. VERIFIED (`schema.prisma:976-1120`, `lib/services/survey-booking.ts`, `lib/services/broker-card.ts`).

### 2.6 Chain coordination (LIVE — the viral engine)
- **Chain model** — `PropertyChain`/`ChainLink` span agencies; stub links capture non-customer agents' contact details; withdrawal cascade (`ChainNotificationQueue`); neighbour updates drip (`ChainNeighbourUpdate`); private negotiating intel (`breakChainStance`). VERIFIED (`schema.prisma:1763-1942`, `lib/chain/*`).

### 2.7 Onward / related-sale trackers (LIVE)
- **Shadow trackers** — a seller's onward *purchase* and a buyer's related *sale* reported on their own file; availability computed from the real prerequisite chain. Feeds chain-neighbour drip. VERIFIED (`lib/services/onward.ts`, `OnwardTracker`).

### 2.8 Command Centre (superadmin) — see §8 for the full page inventory.

### 2.9 Billing (LIVE, Stripe)
- Exchange-triggered, snapshot-based; 14-day free trial window stamped once on first file; `free`/`legacy`/`standard` tiers; VAT scaffolding dormant; reversal via `CreditNote`. VERIFIED (`lib/billing/fee.ts`, `lib/services/trial.ts`, `billing-trigger.ts`, `billing-reversal.ts`).

---

## 3. User & Participant Map

Everyone who touches the ecosystem, whether or not they pay.

| Participant | Pays? | Account? | How they touch TSP | TSP branding they see | Treated as a prospect? |
|---|---|---|---|---|---|
| **Director / negotiator** (customer agency) | Yes (on exchange) | Yes | The whole agent app | Full | They ARE the customer |
| **TSP internal team** (`sales_progressor`/`admin`/`superadmin`) | n/a | Yes | Dashboard / Command Centre | Full | n/a |
| **Buyer / seller** | No | No (token) | Client portal + every client email | **None** | **No** — dead end |
| **Solicitor / conveyancer** | No | No (token) | Solicitor portal `/s/[token]` + chase emails | **None** | **No** — dead end (but silently scored) |
| **Other agent in a chain** | No → becomes Yes | Becomes one | Chain invite email → `/claim` | Full (only here) | **Yes** — the one real loop |
| **Mortgage broker** | No | No | Referral email (outsourced files only) | Yes (broker-facing) | Partly (as a lead) |
| **Surveyor / structural engineer** | No | No | Quote request email | Some | Thinly (CC inbox) |
| **Non-customer agency (chain stub)** | No | No | Named in a chain, may be invited | Only if invited | Latent — data captured, not worked |

**Key asymmetry (VERIFIED):** the three highest-volume, highest-trust participants — buyers, sellers, solicitors — see *no* TSP identity and have *no* path to become or refer a user. The one participant TSP actively converts (another agent) is also the rarest per transaction.

---

## 4. Distribution Surface

Every mechanism in the product that puts TSP in front of someone outside the paying agency. Full touchpoint detail with file:line is in §14.

### The map, discovered from the code

```
                         AGENCY (pays)
                            │ creates transaction
        ┌───────────────────┼─────────────────────────────┐
        ▼                   ▼                              ▼
   BUYER / SELLER      SOLICITOR(S)                  CHAIN NEIGHBOUR
   • portal (token)    • chase email + QR            (another agency's agent)
   • client emails     • /s/[token] portal           • chain invite email  ◄── ONLY
   • explain-my-email  • confirms milestones            │  VIRAL LOOP
   • calendar/vcf      • edits shared contact           ▼
   • follow-up mailto  • (silently scored across      /claim  (TSP-branded)
   • broker card ──► broker lead   all agencies)         │
        │                                                ▼
        ▼                                        NEW AGENCY signs up
   surveyor quote ──► QuoteRequest (CC inbox)     → becomes an originator
        │                                            (loop closes)
        ▼
   [DEAD END: no branding, no CTA, no referral, no re-engagement]
```

### Branding presence map (who ever sees "Sales Progressor")
- **TSP-branded to an outsider:** only (a) the `/claim` and `/claim/decline` chain pages, (b) chain-neighbour + bounce email footers ("Powered by Sales Progressor"), (c) the TSP-default-broker referral email (broker-facing). VERIFIED.
- **Agency white-labelled (no TSP):** every client email; the entire buyer/seller portal chrome; the entire solicitor portal + chase emails; even the chain *invite* email is sent as the agency. VERIFIED.

### Conversion instrumentation
- **Chain loop is the only end-to-end funnel:** `CHAIN_INVITE_SENT → VIEWED → NUDGED → CLAIM_STARTED → CLAIM_COMPLETED`, with declined/bounce drop-offs, mirrored on `ChainLink` stamps and a Command Centre dashboard. VERIFIED (`lib/chain/funnel.ts`, `app/command/(protected)/chain-invites`).
- **Portal:** `PORTAL_LINK_SENT`, `PORTAL_VISITED` + engaged-time only.
- **Solicitor:** `ChaseSend` open/responded.
- **Providers:** `QuoteRequest` rows.
- **Gap:** chain-neighbour sends have no event; client-email opens/clicks are not tracked toward any conversion — because there is no TSP conversion to track.

---

## 5. Dead-End Exposures

Ranked by human throughput. "Dead end" = someone receives real value but the product does nothing to turn that exposure into another relationship.

1. **Buyer/seller portal — the whole surface, worst at completion.** Every buyer and seller on every file. High-trust sessions (progress, AI email-explainer, calendar, contact cards) with zero TSP branding and no CTA. At **completion** — a verified, satisfied mover at peak trust — the page offers only "Keep this portal bookmarked" and "Back to overview." No referral, no NPS, no "moving again?", no next-move capture. **VERIFIED first-hand** (`app/portal/[token]/complete/page.tsx:246-265`). **The single biggest dead end.**

2. **Solicitor portal `/s/[token]` + the global solicitor graph.** Every solicitor on every file uses a polished token web app with no TSP identity and no signup/referral CTA. Separately, TSP silently accumulates a cross-agency graph of firms, handlers, contacts, and measured performance that is never leveraged as a network asset. VERIFIED.

3. **Client-facing email stream** (portal-invite, milestone, weekly, exchange-day). Highest email volume, agency-branded, no TSP footer/"powered by"/CTA. VERIFIED (invite) / INFERRED (others).

4. **High-engagement portal micro-actions delivered unbranded** — explain-my-email AI, `.vcf` contact card, `.ics` calendar, follow-up mailto. Sticky, differentiated moments that terminate on the client's device or in the agency inbox with no attribution and no ask. VERIFIED.

5. **Provider/quote marketplace under-exploited.** `QuoteRequest`/`ProviderFirm` capture broker + surveyor leads, but only the TSP-default broker on *outsourced* files auto-emails a provider; no provider portal, no multi-provider competition, no commission automation surfaced. VERIFIED.

6. **WhatsApp + Outlook are capture-only** — noted so they are not miscounted as reach. VERIFIED.

7. **Director/Negotiator invitations are not growth loops** — intra-agency seat management; DirectorInvitation actively blocks existing accounts, preventing cross-agency virality. VERIFIED.

---

## 6. Data Asset Map

TSP's structural advantage: it **sits on both sides of every transaction and across every agency**. No estate agent, solicitor, or broker sees that join.

### What is collected (VERIFIED, structures only)
- **Agencies:** `modeProfile`, full UTM attribution (`signupSource/Medium/Campaign/Referrer/LandingPage`), billing state, per-stream chase switches, white-label branding, `firstSubmissionAt` trial anchor. (`schema.prisma:13-121`)
- **Solicitors:** `SolicitorFirm` **globally unique by name, no agencyId** — one canonical row shared across all agencies; `SolicitorContact` handlers reused across every file; `SolicitorChaseState`+`ChaseSend` capture per-firm responsiveness at the individual-email grain (`openedAt`, `respondedAt`, `responseType`, `repliedByEmailAt`). (`schema.prisma:881-933, 3321`)
- **Brokers/providers:** identity + `QuoteRequest` win/loss + referral economics + postcode coverage. (`schema.prisma:935-1120`)
- **Contacts:** rich engagement column set (`lastVisitedPortalAt`, `pwaInstalledAt`, `exchangeAuthorityGivenAt`, unsubscribe/pause stamps). (`schema.prisma:731-832`)
- **Private client intent:** `ClientMoveInfo` — `mortgageOfferExpiry`, `fundsInPlace`, `fundsSource`, `noticePeriod`, `buyingOnward`, `sellingRelated`, `removalCompany`, `unavailableDates`. The richest private record in the system. (`schema.prisma:1593-1653`)
- **Transactions/milestones:** price, tenure, purchaseType, both solicitor+broker FKs, `expectedExchangeDate`/`predictedExchangeDate`, `exchangedAt`, `completionDate`, `withdrawalReason`+`fallThroughReason`; `MilestoneCompletion` with confirmer attribution (`confirmedBySolicitorFirmId`) — the join that makes per-firm turnaround computable.
- **Chains:** cross-agency structure; **stub non-customer agents' emails, indexed** (`@@index([stubAgentEmail])`); collapse cascades; `chainSnapshot` freezes the whole multi-agency chain at withdrawal.
- **Enquiries:** "whose court" state machine + movement log per file and per solicitor side.

### Already computed [COMPUTED]
- Per-firm median weeks-to-exchange, median search days, fall-through rate, fast/avg/slow rating with sample floors (`solicitor-intel.ts`).
- Phase-aware exchange prediction; 0–100 risk; 8 problem detectors; `DailyMetric`; `WeeklyCohort` (written, unread).

### Derivable by combining datasets (the moat)
| Asset | State | Compounds with |
|---|---|---|
| Cross-agency conveyancer league table | **VERIFIED, COMPUTED, API-exposed** | agencies × files per firm — *sharpens* above sample floors |
| Firm network-wide active-file load | VERIFIED, COMPUTED (currently leaks cross-tenant) | agency count |
| Regional completion-time / fall-through / tenure-mix by postcode | INFERRED, LATENT (postcode present + indexed) | file density |
| Land Registry/EPC ⨯ TSP achieved-price + time comparables | integration VERIFIED, join PROPOSED | file volume |
| Cross-agency chain-fragility / collapse propagation | mechanism VERIFIED, analytics LATENT | chained files |
| Non-customer agent/firm acquisition leads | data VERIFIED (indexed), detector PROPOSED | chain reach |
| Retention/activation cohort patterns | VERIFIED, COMPUTED | agency count |

**Bottom line:** the defensible, no-single-party-holds-it asset is **already real** (`solicitor-intel.ts` runs today). Everything else above is latent in already-collected, mostly-indexed columns — it needs computation, not new capture.

**GDPR pattern worth extending:** `QuoteRequest` already wipes client PII at 12 months while keeping aggregate columns (`anonymisedAt`) — the correct template for any regional-benchmark product.

---

## 7. Funnel & Measurement Map

Two parallel telemetry stacks, and the split explains every gap:

| Stack | Storage | Status |
|---|---|---|
| First-party Event log + rollups | Postgres (`Event`, `DailyMetric`, `WeeklyCohort`, `FeatureEvent`, `FileTimeSession`) | **LIVE, wired** |
| PostHog (all client behavioural analytics) | PostHog EU | **CODED, DORMANT — no key** |

### Funnel stage by stage
| Stage | Measurable? | Source | Missing |
|---|---|---|---|
| Exposure / ad impression | **NO** | — | no marketing analytics |
| Website visit | **NO** | PostHog (dormant) | zero traffic data until a key lands |
| Enquiry / demo | **NO** | — | **no Lead/Demo/Waitlist model exists** — total blind spot |
| Signup | **YES** | `Event.agency_created`, `DailyMetric.signups` | agency-grain; `user_accepted_invite` enum defined but **never emitted** |
| Onboarding | **PARTIAL** | activation page computes TTFT/TTFM from Events | per-step drop-off is PostHog-only → unmeasurable |
| First transaction | **YES** | `Event.transaction_created` | solid |
| First client (portal) invite | **PARTIAL** | PostHog only | **no first-party EventType** for portal invite |
| First solicitor interaction | **YES** | feature-usage registry + `ChaseSend` | strong |
| First chain connection | **YES** | `ChainLink` stamps (`lib/chain/funnel.ts`) | DB stamps live; only PostHog mirror dead |
| Repeat usage | **YES** | `DailyMetric`, usage/retention services | strong |
| Exchange | **YES** | `Event.contracts_exchanged` | solid |
| Retention / referral | **PARTIAL** | `RetentionEmailLog`, `getReferralStats` | referral stats measure *conveyancer fees*, not agency word-of-mouth; no NPS, no viral metric |

### Raw data collected but never turned into a metric (highest-value quick wins)
1. **`WeeklyCohort` — recomputed nightly, read by NOTHING.** A full week-N retention-curve dataset sits in Postgres; the only code that touches it is the writer. The activation page even *reimplements* cohort analysis from raw Events instead of reading it. **VERIFIED headline gap** (`lib/services/metrics-rollup.ts:396` writer; grep finds no reader).
2. **`FileTimeSession`/`PortalTimeSession.engagementIntervals`** — granular focus intervals are summed into a scalar `totalEngagedSeconds` and the shape is discarded. Session depth, time-of-day, bounce-vs-deep-read all recoverable, none analysed. Portal-side (client attention) especially. VERIFIED.
3. **`Event.metadata` (Json)** — attached on many events, read only by the raw activity feed; never aggregated into a dimension. VERIFIED.
4. **`user_accepted_invite`** — defined, never emitted; invite→activation conversion unmeasurable. VERIFIED.
5. **Three PostHog friction detectors** (`posthog-rage-click`, `-session-friction`, `-funnel-abandonment`) — finished code with no possible input until PostHog is enabled. VERIFIED.
6. **`ContentEngagement`** — social metrics hand-typed by the founder; no API sync. VERIFIED.

### Well-instrumented (for balance)
Feature-usage registry (25+ features each mapped to a first-party table), `ChaseSend` (the best-instrumented loop), Experiment lab, `DailyMetric`, Sentry (errors). VERIFIED.

---

## 8. Underused Assets

Things already built with far greater commercial/distribution potential than their current use.

1. **Cross-agency solicitor league table** — used as an in-app hint; is a standalone data product and a partnership magnet (§11.A). VERIFIED.
2. **Tier 3 AI proposal engine** — reads solicitor email, drafts the confirmation, one-click approve. The scalability story for the £250 outsourced service; dormant on an unpaired mailbox. VERIFIED (`lib/services/email-interpret.ts`, `app/command/(protected)/proposals`).
3. **Daily brief / weekly review AI** — founder-private BI. Re-pointed per-agency = a "your pipeline this week" product that drives login frequency and retention. VERIFIED.
4. **Property-intel dossier** — Land Registry + EPC per property, agent-only, not even persisted. A shareable/public asset (§11) and an SEO surface. VERIFIED.
5. **Content studio** — voice corpus → Haiku drafts → FLUX images → engagement scoring → topic feedback loop. A complete personal-brand content engine wired to one inbox, with its automation crons **not even scheduled in `vercel.json`** (`content-batch`, `content-topics`). Could be an agency-facing feature. VERIFIED.
6. **Chain-neighbour "warm-up" drip** — already sends useful progress to a not-yet-joined agent with a "Powered by Sales Progressor" footer. The best-designed nurture in the product, gated OFF by default (`chainNeighbourUpdatesEnabled`) and with no own conversion event. VERIFIED.
7. **UTM attribution columns** — `signupSource/Medium/Campaign/Referrer/LandingPage` exist on `Agency` but read thin ("direct/unknown") because the top of funnel isn't instrumented. VERIFIED.
8. **Referral-fee revenue stream** — 10% on surveyor/broker bookings, live in schema + CC, easy to forget; the cleanest incremental revenue on a *free* self-managed base (free agencies still generate buyer survey bookings). VERIFIED.

---

## 9. Positioning Gaps

The marketing sells "structured milestones + a portal + automated emails" — a workflow tool. The product is a transaction-intelligence platform. (Marketing copy read from `docs/audits/marketing-site-audit.md`; the live site is a separate repo.)

| Capability (VERIFIED in code) | Marketing status |
|---|---|
| Email/WhatsApp auto-capture onto the file | Silent; site even *under*-claims WhatsApp as a manual label |
| AI chase drafting (6 tones, 2 channels) | Silent — a prior audit flagged this as "one of the strongest differentiators… not mentioned" |
| Self-adjusting exchange prediction | **Actively hidden** — audit told the site to delete the "forecast" claim as vapour; the model is now real |
| Nightly AI problem detection | Silent |
| Cross-agency solicitor performance intel | Silent (solicitors unmentioned beyond a directory) |
| Chain + onward/related-sale coordination | Silent — "doesn't mention chain handling at all" |
| Solicitor portal (a whole third audience) | Silent — site sells only "a client portal" |
| Provider quote marketplace + referral income | Silent — this is a *revenue* story for the agency |
| Benchmarking / cohorts | Silent |

**The sharpest irony:** the ProofStrip uses fabricated stats ("4,000+ sales, ~84 days, 94% completion") and fake agency logos — while the product is built to compute the *real* versions (speed-to-exchange, fall-through with a sample floor, cohort trends). Marketing reached for invented numbers over machinery that produces true ones. VERIFIED.

---

## 10. Growth Loops Already Hiding in the Product

### Loop A — The Chain Loop (BUILT, LIVE, the whole game)
```
Agent A links a sale into a chain
   → invites the counterpart agency's agent by email (agency-branded)
   → invited agent opens /claim (TSP-branded, sees the live chain as social proof)
   → "Claim this sale · Free 14-day trial · No card needed"
   → new agency + director created in ~30s, the stub becomes their real file
   → that agent now has their OWN chains → invites THEIR counterparts
   → loop widens
```
**Evidence:** `lib/chain/invite.ts`, `app/claim/page.tsx:338-340` (verified first-hand), `app/api/claim/route.ts`, funnel `lib/chain/funnel.ts` + `lib/analytics/events.ts`. **This is the only fully-built, fully-instrumented loop.** Everything else below is latent.

### Loop B — The Neighbour Warm-Up (BUILT, gated OFF)
```
Seller confirms an onward-purchase step
   → polite progress email to the not-yet-joined agent above ("Powered by Sales Progressor")
   → "See where the chain stands" → /claim → Loop A
```
Evidence: `lib/services/chain-neighbour-updates.ts`. Off by default (`chainNeighbourUpdatesEnabled`), no conversion event. **A pre-built nurture into Loop A, switched off.**

### Loop C — The Solicitor Loop (LATENT — data + audience exist, loop does not)
```
Solicitor uses /s/[token] on Agency X's file (no TSP identity)
   → same solicitor appears on Agency Y and Z's files (SolicitorFirm is global)
   → TSP silently measures their performance across all three
   → [no loop closes: solicitor never learns TSP exists, is never asked to
      recommend it to the agencies they work with, never sees their own scorecard]
```
Evidence: `SolicitorFirm` global unique, `solicitor-intel.ts`, `lib/services/solicitor-updates.ts`. **A whole audience and a whole dataset with no loop attached.** (See §11.A/B for how to close it.)

### Loop D — The Completion Referral (LATENT — dead end today)
```
Buyer/seller completes → peak trust, verified mover
   → [today: "Keep this portal bookmarked"]
   → PROPOSED: NPS + "know someone selling?" + "moving again?" capture
   → their agent gets a warm referral / TSP gets a next-move lead
```
Evidence of the dead end: `app/portal/[token]/complete/page.tsx:246-265` (verified first-hand).

### Loop E — The Provider Flywheel (LATENT — half-built)
```
More agencies → more buyers requesting surveyor/broker quotes
   → more attractive to providers → providers want their agencies on TSP
   → PROPOSED: provider-facing portal + multi-provider competition + auto commission
```
Evidence: `QuoteRequest`/`ProviderFirm`/`broker-callback.ts`. Currently only the TSP-default broker on outsourced files auto-emails.

---

## 11. Non-Obvious Discoveries

The cross-system findings that only surface when you connect distant parts of the codebase.

**A. TSP already runs a cross-agency conveyancer league table — and serves it over an unscoped API.** `getSolicitorIntel(firmId)` aggregates a firm's performance across `vendorForTransactions` + `purchaserForTransactions` with **no agencyId filter**; `getAllSolicitorIntel(agencyId)` takes an agencyId argument and **ignores it**; `GET /api/solicitor-intel` serves it to any authenticated user with a client-supplied `firmId`. This is simultaneously (1) the strongest data-network-effect asset in the company, (2) a ready-made partnership/PR product ("the UK conveyancer speed index"), and (3) a Law-7 tenant-isolation observation to fix before the free land-grab. VERIFIED (`lib/services/solicitor-intel.ts:41,173`, `app/api/solicitor-intel/route.ts:12-18`).

**B. Solicitors are a distribution channel nobody is using.** The same firm appears across many agencies. TSP could show each solicitor their *own* performance scorecard inside the portal they already use — which (i) gives them a reason to care about TSP, (ii) makes them prefer working with TSP-using agencies (faster confirms, clearer asks), and (iii) turns "your slow conveyancer" from an agent complaint into a solicitor self-improvement loop. The data and the portal both exist; only the surface is missing. INFERRED from A + `lib/services/solicitor-updates.ts`.

**C. The chain stub table is a warm B2B prospect list that writes itself.** Every chain records the *other* agent's name, agency, email, and phone in indexed columns (`@@index([stubAgentEmail])`) before any invite is sent. A firm/agent that appears as a stub across many files without ever joining is a high-intent lead sitting in the database. No detector computes this; the detector harness (`lib/services/signals`) already exists to host it cheaply. VERIFIED data, PROPOSED detector.

**D. TSP knows things no one else in the transaction knows.** `ClientMoveInfo.mortgageOfferExpiry` + the milestone timeline means TSP can see an offer about to expire before the broker or agent reacts. `breakChainStance` is "the single most sensitive negotiating fact we hold." Combined across a chain, TSP can see fragility the individual agents can't. These are the raw material for high-value proactive nudges (memory: mortgage-offer-expiry tracker is planned). VERIFIED.

**E. The founder's own AI BI is a product.** The daily brief (Haiku) and weekly review (Opus) already turn platform data into plain-English strategic narrative — for one recipient. The exact same machinery, scoped per-agency, is a retention feature ("your week") and, scoped per-solicitor, is Loop C's payload. VERIFIED (`lib/services/insight/*`).

**F. The product measures the proof points marketing invents.** Speed-to-exchange, fall-through rate, chase volume saved, cohort retention — all computed, none surfaced as marketing evidence; the site fabricates them instead. The moment TSP has live agencies, the honest ProofStrip is a query away. VERIFIED.

**G. What gets more valuable/defensible with scale:** the solicitor league table (sharpens above sample floors), regional benchmarks (postcode density), chain reach (more stub leads), and cohort intelligence — all compound with agency count. This is the argument for the free land-grab *and* the thing that makes it defensible once won.

**H. The content engine's automation is switched off at the wiring level** — `content-batch` and `content-topics` crons exist but are absent from `vercel.json`, so the "topic ideas → drafts → digest" loop never fires on schedule. A capability the founder may believe is running is not. VERIFIED.

---

## 12. Top 20 Opportunity Hypotheses

Ranked by a blend of impact × confidence × "uses something already built." Each: **Impact / Effort / Confidence / Evidence / Time-to-test / Reuses built?**

> Effort/impact are relative (L/M/H). "Reuses built" is the strongest filter the founder asked for — most of the top items are *switch-on*, not *build*.

1. **Add a completion-page referral + NPS + next-move capture.** Convert the highest-trust dead end. *Impact H · Effort L · Confidence H · Evidence `complete/page.tsx:246-265` · Test <1wk · Reuses: portal, Contact, email.*
2. **Turn on + instrument the chain-neighbour warm-up drip by default (with an event).** A pre-built nurture into the only viral loop, currently off. *Impact H · Effort L · Confidence H · Evidence `chain-neighbour-updates.ts` · Test 1–2wk · Reuses: yes, fully built.*
3. **Provision the PostHog key + DPA.** Unblocks the entire pre-signup funnel *and* three finished friction detectors in one move. *Impact H · Effort L · Confidence H · Evidence §7 · Test days · Reuses: fully coded.*
4. **Ship a `WeeklyCohort` retention chart in the Command Centre.** Data recomputed nightly, read by nothing. *Impact M · Effort L · Confidence H · Evidence `metrics-rollup.ts:396` · Test days · Reuses: fully built.*
5. **Pair a mailbox and switch on Tier 3 proposals.** Makes the £250 outsourced service scale; the crown jewel is one integration away. *Impact H · Effort M · Confidence H · Evidence `email-interpret.ts`, `proposals/` · Test 2wk · Reuses: fully built.*
6. **Give solicitors their own performance scorecard in `/s/[token]`.** Closes Loop C; turns a dead audience into advocates. *Impact H · Effort M · Confidence M · Evidence `solicitor-intel.ts` + `solicitor-updates.ts` · Test 3–4wk · Reuses: data + portal exist.*
7. **Add a "moving again?" / next-instruction capture on the client portal.** Sellers who complete are about to be buyers. *Impact M · Effort L · Confidence M · Evidence portal + `ClientMoveInfo` · Test 1–2wk · Reuses: yes.*
8. **Fix the marketing to match the product (prediction, capture, AI chase, chains) and replace fabricated ProofStrip with real computed metrics once agencies are live.** *Impact H · Effort M · Confidence H · Evidence §9 · Test: ongoing · Reuses: computed metrics exist.*
9. **Emit `user_accepted_invite` + a portal-invite EventType.** Cheap, closes two funnel blind spots. *Impact M · Effort L · Confidence H · Evidence §7 · Test days · Reuses: Event log.*
10. **Build the "stale chain-stub → warm acquisition lead" detector.** Self-writing B2B prospect list. *Impact H · Effort L · Confidence M · Evidence `@@index([stubAgentEmail])`, signals harness · Test 1–2wk · Reuses: harness exists.*
11. **Productise the solicitor league table as "The UK Conveyancer Speed Index" (aggregate, anonymised) for PR/SEO/partnerships.** *Impact H · Effort M · Confidence M · Evidence `solicitor-intel.ts` + `QuoteRequest.anonymisedAt` GDPR pattern · Test 4–6wk · Reuses: computed.*
12. **Add a light "Powered by Sales Progressor" + referral CTA to client emails (respecting white-label preference).** Attribution on the highest-volume surface. *Impact M · Effort L · Confidence M · Evidence §4 branding map · Test 1wk · Reuses: email stack.*
13. **Re-point the weekly-review AI as a per-agency "your week" email.** Retention + login frequency. *Impact M · Effort M · Confidence M · Evidence `weekly-review.ts` · Test 3wk · Reuses: fully built.*
14. **Schedule the content crons + productise a light agency content studio.** Turn a founder tool into a feature (and fix that automation is silently off). *Impact M · Effort M · Confidence L · Evidence §11.H · Test 4wk · Reuses: built.*
15. **Persist + join Land Registry/EPC with TSP achieved-price/time → a comparables/"how your sale compares" asset (shareable, SEO).** *Impact M · Effort M · Confidence M · Evidence `property-intel.ts` · Test 4–6wk · Reuses: integration exists.*
16. **Regional benchmark rollups keyed on outward code** (completion time, fall-through, tenure mix). *Impact M · Effort M · Confidence M · Evidence postcode indexed, `metrics-rollup.ts` · Test 4wk · Reuses: data present.*
17. **Mortgage-offer-expiry proactive nudge** using `ClientMoveInfo.mortgageOfferExpiry` (already planned). *Impact M · Effort M · Confidence M · Evidence §11.D · Test 3wk · Reuses: field exists.*
18. **Provider-facing portal + multi-provider quote competition + auto-commission** — turn the thin marketplace into Loop E. *Impact M · Effort H · Confidence L · Evidence `QuoteRequest`/`broker-callback.ts` · Test 6–8wk · Reuses: schema exists.*
19. **Brand the PWA install + calendar/vcf artefacts** so the sticky micro-actions carry attribution. *Impact L · Effort L · Confidence M · Evidence §5.4 · Test 1wk · Reuses: yes.*
20. **Provision Upstash rate limiting before the free land-grab.** Not growth, but a hard prerequisite — free public signup currently leaves AI/email/auth unmetered. *Impact H (risk) · Effort L · Confidence H · Evidence `free-agency-launch/SPEC.md`, `lib/ratelimit.ts` no-op · Test days · Reuses: coded.*

---

## 13. Questions for the Second AI (strategy, not more code investigation)

1. **Which loop to bet on first?** The chain loop is built but rare-per-transaction; the solicitor loop reaches a bigger audience but needs a new surface and has weaker conversion intent. Which compounds faster given a free self-managed base?
2. **Free land-grab sequencing.** Given every current user is outsourced (not self-managed), does giving away self-managed cannibalise or feed the £250 outsourced revenue? What's the upsell trigger?
3. **White-label vs attribution trade-off.** Agencies value being the face to their clients. How much TSP attribution can be added to client surfaces before it damages the core value prop? Is a per-agency toggle enough, or does it gut the loop?
4. **Is the conveyancer league table a feature, a moat, or a media product?** Publishing it (even anonymised/aggregated) is PR gold but risks conveyancer relations and invites gaming. Keep it internal, sell it, or publish it?
5. **Solicitor-side monetisation.** If solicitors get value (scorecard, faster confirms), is there a paid solicitor tier, or do they stay a free distribution channel?
6. **Referral-fee stream at scale.** Is the 10% provider commission a meaningful business line or a distraction from the per-exchange model?
7. **Data-product GDPR/positioning.** Regional benchmarks and comparables are valuable but touch personal transaction data. What aggregation threshold and consent model make them shippable?
8. **Sequencing the switch-ons.** Given ~10 near-zero-effort switch-ons (PostHog key, cohort chart, neighbour drip, completion CTA, mailbox pairing), what's the highest-leverage order for a pre-launch, ~5-user company?

---

## 14. Evidence Appendix

Primary references so a second AI can distinguish evidence from assumption. Line numbers are approximate to the state on 2026-08-29.

### Pricing & billing
- `lib/billing/fee.ts:21-26` — `IN_HOUSE_FEE_PENCE=5900` (£59); outsourced ladder £250/£300/£350 by band; VAT dormant.
- `lib/services/trial.ts` — `firstSubmissionAt` anchor, `freeOnExchange`, 14-day window, `free`/`legacy`/`standard` tiers.
- `lib/services/billing-trigger.ts` (VM19/PM26), `lib/services/billing-reversal.ts` (`CreditNote`).
- `prisma/schema.prisma:1058-1120` — `QuoteRequest`, `referralFeePence` (10% auto), `anonymisedAt` GDPR pattern.

### Signup / onboarding / viral loop
- `app/api/register/route.ts:47` — `createDirectorWithAgency`.
- `app/claim/page.tsx:338-340` — "Claim this sale · Free 14-day trial · No card needed" (verified first-hand).
- `app/api/claim/route.ts` — new agency from stub, `CHAIN_CLAIM_COMPLETED`.
- `lib/chain/invite.ts`, `lib/chain/invite-nudge.ts`, `lib/chain/funnel.ts`, `lib/analytics/events.ts` — invite/nudge/bounce + funnel stamps.
- `prisma/schema.prisma:1792-1879` — `ChainLink` funnel stamps (`inviteFirstViewedAt`, `claimStartedAt`, `inviteNudgedAt`, `inviteDeclinedAt`, `inviteBouncedAt`) + `@@index([stubAgentEmail])`.

### Dead ends / branding
- `app/portal/[token]/complete/page.tsx:246-265` — "Keep this portal bookmarked" / "Back to overview" (verified first-hand — no referral/NPS/CTA).
- `app/api/portal/invite/route.ts` — agency-branded portal invite, `resolveAgencySenderForTransaction`, no TSP CTA.
- `components/portal/PortalShell.tsx` — portal chrome, no TSP identity.
- `lib/services/chain-neighbour-updates.ts` — warm-up drip, "Powered by Sales Progressor" footer, gated `chainNeighbourUpdatesEnabled`.
- `app/actions/broker-callback.ts`, `lib/services/broker-card.ts` — broker referral (only TSP-branded outsider touch, broker-facing).

### Data / network
- `lib/services/solicitor-intel.ts:41,173` — cross-agency league table, `getAllSolicitorIntel` ignores agencyId.
- `app/api/solicitor-intel/route.ts:12-18` — unscoped, client-supplied firmId (Law 7).
- `lib/services/solicitors.ts:109-147` — `getSolicitorDirectory` firm-level counts unscoped.
- `prisma/schema.prisma:881-933` (`SolicitorFirm` global unique), `:1593-1653` (`ClientMoveInfo`), `:1852-1860` (`breakChainStance`).
- `lib/services/property-intel.ts` — Land Registry SPARQL + EPC, not persisted.

### Analytics / funnel
- `lib/analytics/posthog.ts:141`, `lib/analytics/posthog-server.ts:9` — dormant no-op without key; `lib/command/feature-usage.ts:12` "PostHog is dormant (no key)".
- `lib/services/metrics-rollup.ts:396` — `WeeklyCohort` writer (no reader).
- `prisma/schema.prisma:2417` (`EventType`, incl. never-emitted `user_accepted_invite`), `:2461` (`Event`), `:2482` (`DailyMetric`), `:2518` (`WeeklyCohort`), `:2870/2899` (time sessions, `engagementIntervals`), `:3533` (`FeatureEvent`).
- `lib/command/events/write.ts:21` — first-party `recordEvent` (13 live call-sites).

### Command Centre / AI
- `app/api/agent/memo-parse/route.ts:75` (Sonnet), `app/api/ai/generate-chase/route.ts` (Haiku, 6 tones), `app/api/ai/draft-update/route.ts`.
- `lib/services/email-interpret.ts` → `MilestoneProposal`; `app/command/(protected)/proposals/page.tsx`; `app/actions/proposals.ts:23` (human approve).
- `lib/services/insight/daily-brief.ts` (Haiku), `lib/services/insight/weekly-review.ts` (Opus) — founder-only email.
- `lib/services/signals/index.ts:33-51` — 17 detectors (3 PostHog-dependent, dead).
- `lib/command/content/*`, `app/api/cron/content-batch`, `content-topics` — **absent from `vercel.json`** (unscheduled).
- `lib/command/adoption.ts` — reachability funnel.
- `lib/services/exchange-prediction.ts`, `lib/services/fees.ts` (`calculatePhaseAwarePrediction`), `lib/services/risk.ts`, `lib/services/problem-detection.ts:84-213`.

### Strategy docs (context, not code)
- `docs/active/opportunities-discovery.md`, `docs/active/opportunity-sweep-backlog.md`, `docs/audits/AUTOMATION_AUDIT_2026-08-17.md` ("a superb outbound announcer attached to a blind, deaf inbox"), `docs/active/free-agency-launch/SPEC.md`, `docs/audits/marketing-site-audit.md`.

### Caveats to carry forward
- Client weekly-update, exchange-day, and enquiries-chase email *bodies* were not read line-by-line; their no-TSP-branding is INFERRED from the consistent agency-branded pattern — confirm if load-bearing.
- Several `/command/*` pages are INFERRED-LIVE from names/imports, not opened.
- Doc-vs-code contradiction (Law 6): `docs/chain-feature/06-invite-flow.md:13` says chain tokens don't expire; code enforces 60-day expiry (`lib/chain/invite.ts:51`). Code is truth.
- Dormant-not-shipped: PostHog (no key), Tier 3 proposals (no mailbox), AI images (no Replicate token), rate limiting (no Upstash), solicitor/enquiry chase (off by default), content automation (unscheduled), VAT split (off), two-way portal chat (built, deliberately unmounted).
