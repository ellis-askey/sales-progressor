# Sales Progressor - Automation Audit (2026-08-17)

**Purpose:** forensic product + technical audit answering one question: *what could be added to this system to dramatically reduce the manual typing, clicking, chasing, checking, remembering and calling the human sales progressor (Ellis) has to do?* This report describes what exists, what the system knows, what still requires a human, and why. It deliberately proposes no architecture and no tools; it is input for a separate AI architect.

**Method:** eight parallel read-only codebase explorations (architecture/infra, data model, automation, communications, milestone engine + events, chains, AI inventory, staff workflows), cross-checked against each other. Where two explorations disagreed, the code was re-read directly and the resolution is recorded inline. File references are repo-relative.

**Known doc drift found during the audit (trust the code, not the docs):**
- CLAUDE.md says the internal file view is `/transactions/[id]`; that route does not exist as a page. The real file view is `app/agent/transactions/[id]/page.tsx` (shared by agency + internal staff via role gates). Some emails still deep-link `/transactions/{id}` (e.g. `lib/services/agent-weekly-brief.ts` mixes both forms).
- CLAUDE.md credits "Vercel analytics"; `@vercel/analytics` is not installed. Product analytics is PostHog (consent-gated, key pending), errors/perf is Sentry.
- CLAUDE.md's stack omits Stripe (fully integrated billing) and lists only Haiku + Opus models; a third model (`claude-sonnet-4-6`) powers memo-of-sale extraction.
- `docs/chain-feature/10-deferred.md` lists withdrawal cascade + chain notifications as deferred; they are shipped and live.
- Two-way portal messaging: DECLINED per the product ledger (2026-08-16), and the code matches - the full machinery exists end-to-end (`PortalMessage` model, send/reply services with push + email, `PortalMessageCompose.tsx`, `PortalMessagesWidget.tsx`) but the two chat UIs are defined and never imported by any page. The model IS in live one-way use via the portal respond page's "leave a note". An architect should treat the chat components as deliberately dormant, not missing.
- `docs/MILESTONES_SPEC_v1.md` §6.3 restricts NR-undo to directors/progressors; code does not enforce the role check.

---

## 1. What the system is today

**Product:** UK estate-agency sales-progression SaaS. Two tiers: self-managed (£59/sale on exchange) and outsourced (£250+/sale, progressed by Sales Progressor's internal team). Pre-launch, ~5 test users.

**Frontend/backend:** Next.js 16 App Router, React 18, TypeScript strict, server actions + API route handlers. One codebase serves five surfaces: marketing site, agent app (`/agent/*`), internal staff (same file view with role gates + `/admin/*`), superadmin Command Centre (`/command/*`), and the token-authenticated buyer/seller portal (`/portal/[token]`).

**Database:** Supabase Postgres via Prisma (pooled `DATABASE_URL` + `DIRECT_URL` for migrations). Multi-tenancy is enforced entirely in application code (`lib/security/access-scope.ts`); DB-level RLS policies exist in a migration but the strict block is commented out - `lib/prisma-rls.ts` is currently a security no-op.

**Auth:** NextAuth v4, JWT strategy, Credentials + Google + Azure AD providers. Portal visitors authenticate by opaque per-contact UUID token (`Contact.portalToken`, DB lookup, no expiry). Solicitors act through stateless HMAC-signed `/s/<token>` links (no DB token record, not revocable). Command Centre has step-up auth (HMAC cookie, idle/step-up/hard expiry, optional IP allowlist, a hybrid-superadmin email bypass).

**Hosting:** Vercel. `vercel.json` contains only crons (28 of them); no function config - `maxDuration` is set per-route on some heavy routes, everything else runs on defaults. Migrations deploy during the Vercel build (`scripts/vercel-db-deploy.mjs`).

**Background processing:** no queue library, no workers, no event bus (verified: no BullMQ/Inngest/pg-boss/Kafka/EventEmitter-based bus anywhere). The architecture is **cron-drained DB tables**: side effects either run inline in the server action, or get written to a table (`OutboundEmailQueue`, milestone digests, `ChainNotificationQueue`) that a cron drains later. 28 scheduled crons (full inventory in §4); several pile up at 03:00 UTC unstaggered. Two cron handlers on disk (`content-batch`, `content-topics`) are not registered in the scheduler - orphaned.

**AI:** Anthropic only. Ten isolated single-shot call sites (full inventory §15): chase drafting (Haiku), memo-of-sale extraction (Sonnet, PDF/vision), transaction summary prototype (Haiku, single-user-gated), portal "explain this solicitor email" (Haiku), problem-flag reason labels (Haiku), founder daily brief (Haiku) + weekly review (Opus), content topics/drafting (Haiku), Replicate FLUX images (superadmin content only). No tool use, no multi-step reasoning, no embeddings, no RAG, no memory between calls - verified by grep (zero `tool_use`, `embeddings`, `pgvector`, `langchain` hits).

**Email:** SendGrid outbound only. Layered sender resolution (agency's verified address -> assigned progressor's personal address -> `updates@`), inline hand-built HTML (no SendGrid templates), delivery/bounce webhook wired for queue-based sends. **No inbound email reception of any kind** (no Inbound Parse, no IMAP, no mail webhook). One partial exception: a Microsoft Graph Outlook integration (OAuth tokens stored encrypted) can *import* messages from one connected mailbox into file activity - but only when a human clicks Sync, only via heuristic matching, and the granted `Mail.Send` scope is never used.

**WhatsApp:** no API integration. Reality: `wa.me` deep links that open the human's own WhatsApp with pre-filled text (per-contact and group-invite flows), a stored free-text group-invite URL per transaction, and a paste-importer that parses a copied WhatsApp chat into backdated activity entries after the human maps senders to contacts.

**SMS:** enum values exist in the schema; no provider, no send path. Placeholder only.

**Files/documents:** Supabase Storage, three buckets (`transaction-documents` private + signed URLs, `provider-logos` public, `avatars` public). Documents are stored and served, never parsed - with one exception: the memo-of-sale uploaded at file creation IS parsed by Claude Sonnet (`/api/agent/memo-parse`) and pre-fills the whole new-sale form (verified directly in `components/transactions-v2/NewSaleFlow.tsx:522` - one earlier exploration wrongly reported this absent).

**Notifications:** real web-push (VAPID) to both portal contacts and staff, with subscription pruning; in-app bell feeds (`Notification` per-user, polled every 30s); PWA install prompts + service worker on both portal and agent surfaces.

**Client portal:** per-contact tokened portal with milestone progress, an updates timeline, document upload, a respond page (confirm milestone / set expected date / leave a note), a costs card (deposit/mortgage/FTB/funds), moving-circumstances form (`ClientMoveInfo` incl. mortgage-offer expiry), calendar export, push. (Two-way chat components exist but are deliberately unmounted per the 2026-08-16 decline decision; client->staff notes flow one-way via the respond page.)

**Chain:** first-class linear chain model with claimed (real platform transaction) and stub (free-text external) links, invite lifecycle, withdrawal cascade notifications, bottleneck ranking, weakest-link summary. Details §8.

**Reminders/chases:** four separate engines (agent work-queue reminder engine, automated client chase digests, solicitor confirmation chases, enquiries chases) plus an on-demand AI chase drafter. Details §4.

**Search/indexing:** one Postgres `tsvector` + trigram index on `OutboundMessage` (Command Centre message search) and client-side fuse.js fuzzy search over already-fetched lists. **No embeddings, no vector store, no semantic search** (verified).

**Analytics/reporting:** agent analytics dashboard + CSV export, weekly agency report service, Command Centre metric rollups, 12 statistical signal detectors, founder AI briefs. Nothing acts on any of it.

**External services:** SendGrid, Anthropic, Stripe (billing + webhooks), Supabase Storage, Land Registry SPARQL (price history), EPC register, Microsoft Graph (Outlook import), Replicate (pending token), PostHog (pending key), Upstash (rate limiting - **globally disabled**; all limiters pass through), Sentry, web-push.

---

## 2. The transaction data model (plain English)

Source: `prisma/schema.prisma` (~3,000 lines). The spine is `PropertyTransaction`.

**Transaction** knows: one free-text address (no structured postcode/town columns - postcode is regex-parsed on demand), tenure, purchase type (mortgage/cash), price (pence) + price history, lifecycle status (draft/active/on_hold/completed/withdrawn) with append-only hold periods, owning agency + assigned internal progressor + agent, service tier, fees/billing state (`exchangedAt`, `billedAtExchange`, `priceAtExchange`), chain link pointer, buyer-supplied cost fields (deposit, mortgage, FTB, funds sent), a WhatsApp group invite URL (free text), a large set of email-pause flags (per-file, per-party-side, per-contact - three overlapping generations of pause mechanism, mid-migration), and a frozen per-file `chaseRuleSnapshot`.

**Parties:**
- Buyers/sellers are `Contact` rows per transaction (name/phone/email, role enum, own portal token, engagement telemetry). There is **no global person entity** - the same human on two files is two unrelated rows.
- Solicitors are structured and reused: `SolicitorFirm` -> `SolicitorContact`, linked per side.
- Mortgage broker is structured (`BrokerFirm`/`BrokerContact`). **The lender is not modelled at all.**
- Off-platform estate agents exist only as free-text stub fields on chain links.

**Milestones:** a DB catalogue (`MilestoneDefinition`, seeded from code: VM1-VM21 vendor side, PM1-PM27 purchaser side, ~10 retired zero-weight enquiry rows) with weights, exchange-blocking flags, predecessor codes, and per-milestone summary templates. Per-transaction state lives in `MilestoneCompletion`: `locked/available/complete/not_required`, with the strongest provenance in the system - `completedAt` (when recorded) vs `eventDate` (when it really happened) vs `expectedDate` (a promise from client/solicitor), and confirmer attribution split across agent (`completedById`), client (`confirmedByPortal` + contact id) and solicitor (firm + contact id). Purchaser rows are scoped per `BuyerRound` (relist support; the round model is Phase-0 scaffolding, mostly not yet read).

**Chain:** `PropertyChain` -> position-indexed `ChainLink` rows; claimed links point at real transactions, stubs carry free text. Invite lifecycle, withdrawal status, chain-split audit, and a directional `ChainNotificationQueue` are all modelled.

**Communications records:** four overlapping outbound logs, no single email table: `OutboundMessage` (activity mirror; full body, AI provenance, open/click columns that are **never populated**), `OutboundEmailQueue` (durable queue with real SendGrid delivery/bounce status), `AgentEmailLog` (agent-facing sends, full rendered HTML), plus per-purpose logs (`ChaseSend`, `RetentionEmailLog`) and chase-state tables (`ClientChaseState`, `SolicitorChaseState`). `OutboundMessage.type` supports `inbound` but inbound rows exist only via manual Outlook sync or WhatsApp paste.

**Reminders/chases:** `ReminderRule` (global cadence catalogue) -> `ReminderLog` (per-file live schedule) -> `ChaseTask` (the human work item, with honest `chaseCount`, escalation, fallback-kind chips). Solicitor cadence has its own per-code rules in working days.

**Notes/updates/activity:** `TransactionNote` (isolated table - not merged into any feed), the de-facto activity log = `OutboundMessage` internal_notes (free text), a partial append-only `Event` table (~25 event types, instrumented call-site-by-call-site, admittedly incomplete), `Notification` bell rows, `EnquiryMovement`, `PriceHistory`, hold periods, and a strict `AdminAuditLog`. **No call-log model** (calls are free-text comms entries).

**Documents:** `TransactionDocument` metadata (filename, storage path, type taxonomy, uploader, share-with-other-side flag). No versioning, no content extraction.

**Portal/client-supplied:** `ClientMoveInfo` per (transaction, side): preferred completion date, flexibility, **mortgage-offer expiry**, funds in place/source, notice periods, onward purchase, removals, unavailable dates - progressor-only, never shared across sides. Costs-card figures live on the transaction itself (a modelling split worth knowing).

**Enquiries:** rebuilt as 2 milestones + tracker: `EnquiryRaiseChase` (pre-loop), `EnquiryTracker` (whose court + one-line outstanding note + chase counters), `EnquiryMovement` (movement log with source + court-flip), `ChaseSend` (per-send log with opened/responded).

**What the system reliably knows about a transaction at any moment:** ownership/assignment/tier/billing state; full milestone state with three-way date provenance and per-confirmer attribution; structured parties with contact details and portal engagement; chain topology + invite/withdrawal state; every outbound email it sent (body included) with delivery state for queued sends; chase pipeline state per contact and per solicitor side; documents; price history; client-supplied move/costs info; hold history.

**What it cannot know / holds only as free text:** structured address; the lender; off-platform agents; *why* anything is delayed (every reason field in the schema is free text - no delay-cause taxonomy, no blocker model); anything said in a phone call, an email reply, or WhatsApp; whether anyone replied to anything; a complete audit history (Event log partial; milestone reversal destructively wipes prior confirmer; reassignment history overwritten).

---

## 3. Every event the system can currently detect

Grouped by reliability. Format: event - trigger - stored where - does anything react automatically?

**First-class events (explicit write, side effects fire):**
- Transaction created (action; `Event(transaction_created)`; initializes milestones, auto-NR by tenure/cash, intro emails, assignment notification).
- Milestone confirmed by agent / client portal / solicitor link (three attributed paths through the single chokepoint `completeMilestone`, `lib/services/milestones.ts:843`; fires dependent unlocks, reminder re-eval, chase cancellation, exchange-gate recompute, enquiry-tracker sync, VM21 reflection, billing stamp on exchange, chain notifications, client/agent emails, push, bells, `Event(milestone_confirmed)`).
- Milestone marked Not Required (attributed, reasoned, `Event` recorded; cascades e.g. PM9->PM10).
- Milestone reversed/undone (impact-preview flow; re-locks, cascades, credit-notes billing, `Event(milestone_reversed)` - but destructively erases the prior confirmer).
- Exchange gate unlocked (`Event(exchange_gate_unlocked)` + internal note + ready-to-exchange email path).
- Exchange / completion (bilateral codes; stamps `exchangedAt`/billing, chain-wide notifications, completion pack, auto-completes the file via `maybeAutoCompleteTransaction` + nightly safety net).
- Enquiries: raised (opens tracker), movement logged (resets chase clock, flips court, bell), satisfied (closes tracker, reflects VM21).
- Client portal actions: self-confirm, set expected date (snoozes chases), leave note (PortalMessage + bell + push), submit move info / costs (stored; **no reaction**), portal visit (daily row + engaged-time; read by risk scoring only), PWA install.
- Solicitor link actions: confirm (instant milestone flip), expected date (snooze), free-text update (internal note + bell only), stop-emails.
- Chase sent / chase count incremented (honest counting - only real sends/marks tick it), escalation (priority flip + push/bell).
- Chain: link added/claimed/invited, withdrawal cascade responses, chain split, celebration.
- Document uploaded (`Event(file_uploaded)`; no downstream reaction - a survey PDF does not suggest confirming the survey milestone).
- Status changes incl. withdrawal (with enum reason + cascade) and holds (append-only periods; freeze time-based signals).
- Billing: exchange charge, credit-note reversal, invoice issuance, failed-payment block after 7-day grace.
- Bounce/delivery for queued emails (SendGrid webhook -> `OutboundEmailQueue` columns; hard bounce suppresses user + flags chain invites).

**Derived-only (computed on read, never stored as a moment):**
- Milestone overdue/stalled (reminder date-math buckets; staleness badges computed against a **proxy** for "became available" - there is no `becameAvailableAt` timestamp, called out in `lib/services/milestone-staleness.ts:11`).
- Progress %, predicted exchange date, risk score, chain bottleneck/weakest link.
- "Client went quiet" (problem-detection flags, nightly).

**Detectable but nothing reacts:**
- Mortgage offer expiry approaching (client-supplied dates stored in `ClientMoveInfo`; an Overview card renders amber/red **only if the file is opened**; no cron, no alert, no chase).
- Client submitted preferred completion date / moving circumstances (stored for the progressor to read).
- Portal visit patterns (feed risk score only).

**Events that VANISH (no representation at all):**
- Any email reply. Any phone call content. Any WhatsApp message (unless hand-pasted). A solicitor's verbal commitment.
- Reassignment history (overwritten, no Event).
- Prior confirmer of a reversed-then-reconfirmed milestone (wiped).
- Price change as a platform-level event (file note only, no `Event` -> invisible to analytics/risk).
- Note added (`TransactionNote` is in no feed and no Event).
- Email failure for non-queued sends (`OutboundMessage.failedAt` exists, never populated; no `email_failed` event; a bounced milestone email to a client leaves no actionable trace and no one is told).
- Milestones completed via the two bypass paths (claim reconciliation, admin migration write rows directly: no Event, no tracker sync, no billing stamp - Command Centre velocity analytics never sees them).
- Auto-NR provenance (stores the string "Auto-set at file creation", not the structured cause).

**Divergence warning for the architect:** `POST /api/milestones` (kept for non-React callers) routes through `completeMilestone` but skips ALL action-layer side effects (no client emails, no push, no bells, no reminder re-eval) - two confirm paths that look equivalent are not.

---

## 4. Everything automated today (trigger -> decision -> action -> where it stops)

28 scheduled crons + event-driven flows. All crons bearer-auth with `CRON_SECRET`; per-agency loops isolate failures. The most important pipelines:

**Reminder engine** (04:00 Mon-Sat + inline after confirms; `lib/services/reminders.ts`): for each active `ReminderRule`, anchor date (milestone `eventDate`/`completedAt` or file creation) + grace days -> creates/updates `ReminderLog` + pending `ChaseTask` in the agent work queue, normalised to 06:00 UK. Deactivates when target complete/NR, prereqs unmet, or gates closed. Escalates (priority flip + web push) when chase count >= threshold and another repeat window elapsed. **Stops:** it only populates the human's queue; it never contacts anyone.

**Client chase digests** (08:30 Mon-Sat; `lib/services/client-chase-cron.ts`): triple-gated (env `CLIENT_CHASE_ENABLED`, per-agency toggle, per-file/contact pauses + unsubscribes). First chase at anchor+grace, repeats every N days if the client hasn't engaged. Hard caps: **2 chases**, **14-day silence ceiling**. Deterministic template digest (not AI), enqueued and drained hourly. Records `ClientChaseState`, mirrors into the agent's ChaseTask. On cap/opt-out/no-email, hands the file to the human with a "(manual)" fallback chip. **Stops:** "engagement" = portal actions only. An email reply is invisible; the loop chases a client who already replied, then quietly hands over via a chip the human must notice.

**Solicitor confirmation chases** (09:00 weekdays; `lib/solicitor-confirm/chase.ts`): master switch OFF by default (`SolicitorChaseSettings.enabledByDefault=false`). Per-milestone working-day cadences, max ~2 chases, digest per (file, side) from the agency's sender with signed `/s/` links. Solicitor-supplied expected dates snooze the chase. Escalates to a bell (`solicitor_unresponsive`). **Stops:** a Confirm click auto-advances the milestone; anything typed as free text is a note a human must read.

**Enquiries chases** (09:00/09:30 weekdays; `lib/enquiries/`): same master switch (OFF). Reply-loop: chase whoever holds the ball every 9 working days, escalate (stalled flag + bell) at 15. Raise-loop: WD7 buyer nudge, WD10 buyer's solicitor, WD13 escalate, repeat every 6 alternating. Movement only registers via tokenised click or human log. **Stops:** stalled = bell to owner.

**Milestone emails** (event-driven; `lib/services/portal.ts` + copy in `lib/portal-copy.ts`): every confirm fires per-recipient rich copy (vendor/purchaser/agent/progressor variants) with computed clause tokens; client sends batch through a 5-minute digest window; bilateral suppression avoids re-notifying the actor; stale exchange/completion confirmations suppress the customer email but still notify staff. **Stops:** at SendGrid delivery. No reply/read loop.

**Problem detection** (03:00 daily; `lib/services/problem-detection.ts`): eight deterministic flag kinds with hard thresholds (>=10 days silence, >25% behind 12-week benchmark, >=7 days unanswered chase, exchange <=14 days with <25 completions, hold >=14d, no portal activity >=14d, engaged-then-quiet, >=21 days no milestone). Haiku writes a <=12-word label per flag (with a deterministic fallback - the only gracefully-degrading AI call). **Stops:** flags feed the hub/digest UI; nothing else acts.

**Digests/briefs:** morning digest to staff (08:00) + exchange-approaching pushes (<=7 days); agent weekly brief (Mon); client weekly "on track" (Sat); founder daily AI brief (06:00) + Monday Opus review; 12 statistical signal detectors (03:00) writing `Signal` rows that **nothing acts on**.

**Housekeeping:** outbound queue drain (hourly, cap 50), milestone digest drain (5-min), withdrawal-notification drain + 14-day wait-nudge, completion safety net, session-close crons, metric rollups, retention email sweep (staff re-engagement bands), GDPR anonymisation, quote-request expiry, Stripe invoice accrue/issue/failed-payment block, SendGrid domain re-validation, medians-ready check (emails superadmin when >=50 real files exist so a human can swap hardcoded stage medians for learned ones - the learning loop stops at an email).

**AI chase drafting** (on demand): agent opens chase drawer, picks channel/tone (tone auto-escalates with chase count), Haiku drafts from a PII-minimised context + milestone glossary, agent edits, sends in-app (email) or via `wa.me` handoff (WhatsApp - the human must press send in WhatsApp; the system logs it as sent when they come back).

**The universal stopping point:** every pipeline is fire-and-forget outbound. Nothing ingests a reply. The chase engines wait for tokenised clicks or portal actions; a plain email reply lands in a human inbox the platform cannot see.

---

## 5. Where the human still does the work

For each: what / why a human / what the system knows / what it doesn't / automatable?

**5.1 Reading and interpreting every reply.** Solicitor/client/agent replies land in Ellis's or the agency's real inbox (Reply-To always resolves to a human mailbox). He reads, interprets, decides which file and milestone it affects, and re-keys the salient facts. System knows: what it sent, to whom, when. Doesn't know: that a reply exists, its content, its meaning. **Automatable: Yes - agent/workflow** (once inbound exists; interpretation is AI-assisted). This is the single largest gap; every chase engine's honesty depends on it.

**5.2 Updating milestones from information received off-platform.** A solicitor emails "searches back" or says it on the phone; Ellis opens the file, finds the milestone, confirms it, types the event date. System knows: the milestone catalogue, gating, who to notify (all automatic after the click). Doesn't know: that the event happened. **Automatable: Yes - AI-assisted extraction + human approval** (the entire downstream cascade already exists and is the system's strongest asset - one confirmed milestone triggers emails, unlocks, billing, chain notifications automatically).

**5.3 Noticing silence and re-chasing.** Automated chases stop at 2 attempts/14 days and drop a "(manual)" chip inside one file's Reminders tab. Solicitor/enquiry loops stop at a bell. There is no worked queue of "these went silent"; the hub's client-silence signal is hard-coded to 0 (`kinetic-hub.tsx:349`). **Automatable: Partially today (rules: a real silent-files queue), fully with reply-awareness.**

**5.4 Answering "what's happening?"** Portal shows milestone events; there is **no client-facing weekly narrative** (the weekly brief goes to agency staff), so reassurance ("waiting on the management pack, chasing weekly") is a bespoke typed reply, per client, repeatedly. System knows: milestone state, chase history, whose court, days elapsed. Doesn't know: how to narrate it (that's a template/AI-drafting gap, not a data gap). **Automatable: Yes - AI drafting over existing data.**

**5.5 Phone calls.** Logged as free-text comms entries (channel + direction + prose). No outcome field, no follow-up, no transcript. Whatever was agreed lives in prose the system cannot act on; any follow-up must be self-created as a manual task. **Automatable: Partially (structured capture is rules; extraction from transcript is AI - but recording/transcription infrastructure doesn't exist).**

**5.6 Onboarding a new sale.** Partially automated: uploaded memo-of-sale PDFs are Sonnet-extracted and pre-fill address/price/parties/solicitors, auto-save a draft, trigger Land Registry/EPC lookups, auto-match solicitor firms. The human reviews, corrects, fills gaps (fees, broker, chain stubs). **Remaining manual: verification + the fields the memo lacks. Already largely automated - the pattern to copy elsewhere.**

**5.7 Chasing decisions (who/when/how).** Cadences are rule-driven; but Ellis decides when to override, phone instead, escalate to a director, or stop annoying someone. System knows: chase counts, silence duration, milestone criticality. Doesn't know: reply content, relationship temperature, anything a call produced. **Automatable: decision support yes; final judgement human for now.**

**5.8 Chain awareness.** Claimed links auto-derive progress; stub links require Ellis to phone the other agent and type what he learned into stub notes. Bottleneck ranking exists; date-conflict detection doesn't. **Automatable: Partially (claim-rate is a product problem; stub updates could be structured; conflict detection is deterministic once dates exist).**

**5.9 Exchange/completion coordination.** Dates are hand-typed from solicitor emails; no chain-wide date alignment, no conflicting-dates check; completion is a monitoring list, not a day-of checklist. **Automatable: conflict detection deterministic; date capture needs inbound; checklist is rules.**

**5.10 Mortgage-offer expiry.** Client-supplied dates render a card only when the file is opened. No proactive alert, no chase, no hub widget. **Automatable: Yes - deterministic (data is already stored; a cron + alert is trivial with existing plumbing).** The known deferred tracker.

**5.11 Duplicated announcement of the same fact.** Confirming a milestone auto-notifies, but any *narrative* around it (internal note, softened client version, agent heads-up) is typed separately per audience. **Automatable: Yes - AI drafting from one input.**

**5.12 To-do requests from agents.** Free-text tasks routed to the progressor inbox; no linkage to milestones/reminders; human reads, does the work elsewhere, marks done. **Automatable: Partially (classification/linkage AI-assisted).**

**5.13 Deciding what to work on.** Hub shows counts + top-6 attention items bucketed by urgency; within/beyond that, prioritisation is the human eye. No value/exchange-proximity ranking. **Automatable: Yes - rules/decision support over existing signals.**

**5.14 Keeping the record honest.** "Chased by phone" -> the ↻ button; WhatsApp sent -> trust-me logging; Outlook sync -> manual click + hand-placing ambiguous matches. The human is the integration layer between reality and the record. **Automatable: only by closing the ingestion gaps (§6).**

---

## 6. Communications audit

### Email

**Outbound:** SendGrid via `lib/email.ts` (+ `sendChainEmail` variant with ASM unsubscribe group + sandbox). Sender resolution is genuinely sophisticated (`lib/email/agency-sender.ts`, `resolveSenderForTransaction`): agency verified address -> outsourced progressor's personal SP address -> platform default; Reply-To always equals the human From. White-label domain verification with nightly re-validation. HTML is hand-inlined per call site + a milestone copy system (`lib/portal-copy.ts`, Command Centre overrides); no template engine.

**Recording:** four overlapping logs (§2). Bodies stored. Delivery/bounce recorded for queue sends only (webhook joins on `customArgs.queueId`). **Open/click columns on `OutboundMessage` exist but are never populated** - the webhook explicitly ignores open/click events. Failures for non-queue sends effectively unrecorded.

**Inbound: none.** No Inbound Parse route, no IMAP, no mail webhook (webhooks dir contains exactly: sendgrid-bounce, stripe, vercel-deploy). The Outlook integration reads one connected mailbox on manual click: last 90 days, Inbox + digit-named folders, heuristic match (participants/folder/postcode) -> confident matches become `type:"inbound"` activity rows; ambiguous ones need hand-placing. `Mail.Send` scope requested, never used.

**Threading/correlation: none.** No Message-ID/In-Reply-To/References set or read; no reply tokens, no plus-addressing, no VERP. Even if a reply were captured, nothing could tie it to the send that prompted it.

**Reply awareness: none automatic.** The two fields that look like reply-tracking (`EnquiryTracker.repliedByEmailAt`, `ChaseSend.respondedAt`) are set by manual toggles. "Last contacted" is explicitly outbound-only.

**Drafting/sending:** real in-app compose with send exists (verified-address compose + chase drawer); `mailto:` handoffs also exist. AI drafts are human-approved in the drawer (`wasAiGenerated`/`wasEdited` tracked). The `requiresApproval/approvedBy` columns on OutboundMessage belong to an unshipped LinkedIn flow, not email.

**Missing pieces between today and "solicitor replies -> system understands -> milestone updates -> parties informed -> next action scheduled":**
1. An ingestible reply destination (every Reply-To is a human mailbox).
2. Any inbound receiver.
3. A send<->reply correlation identifier.
4. Automatic (not click-driven) ingestion; coverage beyond one Outlook mailbox.
5. A persisted reply signal on the chase/comm models (fields half-exist, unwired).
6. Interpretation (which file, which milestone, what changed) - the only piece that is AI-shaped; everything downstream of a milestone confirm already automates.

### WhatsApp

Exists: UK-number-normalised `wa.me` deep links (per-contact buttons + group-invite modal with pre-filled text), stored group-invite URL per file, chase drawer WhatsApp drafts handed to `wa.me`, and the paste-importer (`lib/services/comms/parse-whatsapp.ts`) that turns a copied chat into mapped, backdated, deduped activity rows with a 10-minute undo. Absent: any WhatsApp Business API, Twilio, message webhooks, delivery state, group membership data. Outbound "sending" means opening the human's WhatsApp; inbound means the human pastes. For the system to understand/act on WhatsApp: an actual messaging API integration, number<->contact identity resolution (exists roughly via `Contact.phone`), and the same interpretation layer as email.

---

## 7. Transaction memory

"What exactly is holding up 24 High Street?" - what could the software marshal today?

**Centrally queryable:** full milestone state + three-way date provenance + confirmer attribution; reminder/chase state incl. counts, silence chips, escalations; every outbound email body; enquiry tracker (whose court + outstanding note + movement log); chain view with per-link progress and bottleneck ranking; client-supplied dates/circumstances; documents; price/hold history; problem flags with AI labels; risk score; portal engagement.

**Fragmented:** the narrative. The activity feed is a runtime merge of two tables (milestones + OutboundMessage rows incl. free-text internal notes); `TransactionNote` is in neither the feed nor the Event log; the Event log itself is partial by admission; bell notifications are transient; reversal wipes history; reassignment history doesn't exist.

**Absent:** anything anyone *said* (replies, calls, WhatsApp) unless hand-transcribed; the *reason* for any delay as structured data (free-text everywhere); a `becameAvailableAt` on milestones (so "how long has this been sitting" is a proxy computed off prerequisites and is impossible for first milestones).

**Retrieval infrastructure:** none. No embeddings, no vector store, no RAG, no summarisation-on-read (the one AI file summary is a single-user prototype, no DB writes). The nearest thing to transaction memory is `getActivityTimeline` + the structured milestone/chase tables. Notably: the *structured* facts needed to answer "what's blocking this file" are mostly present and queryable; what's missing is the unstructured layer (replies/calls) and any synthesis layer.

---

## 8. Chain intelligence

Model: flat, integer-position, strictly linear list (`@@unique([chainId, position])`); top of chain = position 0. No parent/child edges, no forks/DAG (chain split creates a *new* linear chain with audit stamps). Links are claimed (FK to a real transaction) or stubs (free-text address/agency/agent + invite lifecycle). Legacy free-text `externalStatus` is dead ("do not use").

State: **derived read-through, not stored** - progress %, prediction, stuck-milestone, status badge are recomputed from the linked transaction on every fetch, so claimed-link drift is structurally minimal. Stub links carry no progress at all; whatever Ellis learns by phone goes into stub notes (free text). Persisted per-node state is only claim/invite/withdrawal.

Reasoning that exists: bottleneck ranking (slowest predicted exchange, >7 days behind the median of the others), weakest-link scoring (withdrawn > bounced/declined invite > lowest progress by >=20pts), per-file stuck-milestone, and a real directional withdrawal cascade (walks to nearest claimed neighbour, stops at broken links; remarketing/wait/buyer-found/detached notifications with response tracking + 14-day nudges).

Reasoning that does not exist: cross-transaction milestone dependencies (the prerequisite graph is intra-file only); readiness propagation ("when one moves, everything below moves" is marketing copy, not code); date alignment or conflicting-dates detection across links (each completion date typed independently; chain predicted completion = max of links, gated behind a disabled medians flag); anything driven by a stub's real-world progress.

For the architect: the claimed-link half already behaves like a live graph node (auto-derived state, event cascade); the gaps are edges/dependencies between files, any representation of stub-side progress, and a readiness/date-coordination layer.

---

## 9. Decisions Ellis repeatedly makes

**Deterministic (codifiable as rules; partial code exists):**
- Should a chase fire yet / at what cadence (already coded; caps hardcoded at 2/14d).
- Is this file "at risk" (eight flag heuristics exist; thresholds hardcoded).
- Is the file ready to exchange (`exchangeReady` derivation exists).
- Does a mortgage offer expire soon (data exists; check absent).
- Do chain dates conflict (nothing exists; pure date comparison once captured).
- Which files need attention today (bucketing exists; ranking beyond urgency doesn't).

**Contextual (AI-shaped judgement over data the system partly has):**
- Does this reply actually answer the question / does it mean a milestone happened?
- Is this delay normal for this stage (medians captured but not yet learned into behaviour)?
- Who needs to know about this development, at what level of detail, in what tone (per-audience copy exists for milestone events only)?
- Should the next touch be a call rather than a fourth email?
- What should the client hear this week (no narrative generation exists)?
- Is the other side's solicitor stalling vs genuinely blocked (would need reply content)?

**Human-critical (should remain human-gated):**
- Declaring exchange/completion (already agent-only: portal self-confirm blocked for VM18/PM25, VM19/PM26, VM20/PM27, enforced server-side).
- Anything legally consequential said *to* clients about their transaction.
- Escalation to named humans / relationship-sensitive calls.
- Marking gating milestones off the back of ambiguous evidence.

Note: the codebase already encodes an unusually clear split between "evidence recorded" and "milestone confirmed" (attribution fields per confirmer type) - a natural seam for keeping humans in the loop over AI-proposed confirmations.

---

## 10. Phone calls

What exists: a comms entry with channel Phone/Voicemail, direction, tagged contacts, free-text body, optional share-with-client - rendered into the activity feed. That is all. No call outcome field, no follow-up date, no next-action, no transcript storage, no recording integration, no telephony of any kind, no dedicated call model (calls are `OutboundMessage` rows by convention).

Gaps to a "call -> transcription -> facts extracted -> transaction updated -> parties updated -> next actions" future: (1) no audio capture/telephony integration; (2) no transcript storage model; (3) no structured call outcome ("solicitor promised searches by Friday" has nowhere to live except prose); (4) no extraction step (would be the same interpretation layer as email); (5) no link from a call to the milestone/chase it affects; (6) no follow-up primitive generated from a call (manual tasks exist but are hand-created). The one asset already in place: the activity timeline renders call entries chronologically alongside everything else, and `expectedDate` on milestones is exactly the right landing slot for "they said Friday" - it already snoozes chases when set.

---

## 11. Where information is duplicated

1. **Memo of sale -> form fields:** now largely solved by the Sonnet extractor, but fees/broker/chain stubs are still typed, and the same solicitor details get re-keyed on every file where auto-match misses (no global person entity compounds this).
2. **One real-world fact -> multiple tellings:** milestone confirm (automatic notifications) + internal note + softened client message + agent heads-up are separate typed artefacts of the same event.
3. **Dates re-keyed from emails:** completion date, expected exchange, valuation/survey event dates, mortgage expiry - all read out of an email/call and typed into fields.
4. **Stub chain status:** the other agent's file knows its own progress; Ellis re-types a phone-call summary of it into stub notes.
5. **Chased-by-other-means bookkeeping:** the ↻ Chased button and WhatsApp trust-me logging re-enter facts that happened in other channels.
6. **Same contact typed per transaction:** repeat buyers/sellers/solicitor contacts are re-keyed per file (solicitor firms dedupe by name; people don't).
7. **Pause flags triple-modelled:** file-level, per-party-side, per-contact email pausing overlap mid-migration - staff can express the same intent in three places.
8. **WhatsApp paste:** the entire conversation is retyped (pasted + sender-mapped) to exist at all.

---

## 12. Polling vs event-driven

| Current behaviour (polled/scheduled) | Real event it proxies |
|---|---|
| Hourly outbound queue drain; 5-min milestone digest drain | send-at time reached (self-inflicted latency of the drain pattern) |
| Nightly reminder engine recompute | milestone confirmed / date passed (confirm-time re-eval already exists inline; the cron catches date passage) |
| Daily problem detection (silence, stalls) | last-activity crossing a threshold |
| Client/solicitor/enquiry chase crons | anchor + cadence due; *should* also react to "reply received" - impossible today |
| Manual Outlook sync click | email arrived (Graph supports change notifications; unused) |
| SP bell polling every 30s | notification created |
| Medians-ready daily check | nth transaction completed |
| Morning digest / weekly briefs | (legitimately scheduled) |
| Completion safety net nightly | milestone confirm (belt-and-braces for the existing event path) |
| Stripe/billing crons | (legitimately scheduled) |

Genuinely event-driven already: everything downstream of `completeMilestone`, portal actions, `/s/` link clicks, chain withdrawal cascade, SendGrid delivery webhook, Stripe webhook. The event the whole business runs on - *a counterparty communicated* - has no trigger at all.

---

## 13. Reliability and safety constraints

**Existing boundaries (good):**
- Clients cannot self-confirm exchange/completion/gate codes (server-side block).
- Solicitor links are side- and code-scoped; confirms are attributed to firm+contact.
- AI chase drafts are human-edited/approved before send; AI never sends externally unsupervised except the portal explain-email tool (which only explains the user's own pasted text back to them, with a no-advice prompt - still the one unmediated AI->client surface).
- PII minimisation in chase prompts (street-only address, no price, first-names only); memo-parse sends full unredacted documents (necessarily).
- Social publishing is structurally human-gated.
- Milestone provenance (eventDate vs completedAt vs expectedDate; per-confirmer attribution) gives automation a factual substrate that distinguishes claims from confirmations.
- Undo flows reverse billing with credit notes; exchange stamping is race-guarded.

**Weak points any added automation must respect:**
- Tenant isolation is app-code-only (RLS commented out); rate limiting globally disabled; webhook signature checks skip when env keys are unset; portal tokens never expire and solicitor tokens aren't revocable.
- The `/api/milestones` bypass path and the two direct-write reconciliation paths mean "milestone confirmed" side effects are not invariant - an automation layer keying off confirmations must use the chokepoint, not the table.
- Destructive reversal + partial Event coverage means the audit trail cannot currently prove who-knew-what-when.
- Estimated vs agreed dates are distinguished on milestones but NOT on transaction-level date columns; automation that treats `expectedExchangeDate` as agreed would mislead clients.
- Bounced non-queue emails vanish - an automated communicator could keep "successfully" emailing a dead address.
- No delay-cause taxonomy: any automated narrative about *why* something is stuck is inference, and should be labelled as such.

---

## 14. Technical constraints for the next architect

- **Serverless-only:** Vercel functions, no persistent processes, no websockets server, no long-running workers. Heavy routes set `maxDuration` (max seen 120s); most run defaults. Any long-running agent loop needs external execution or careful chunking. Cron minimum granularity in use: 5 minutes.
- **TypeScript/Next monolith:** all business logic lives in `lib/services/*` server modules called from actions/routes; no service boundaries. Prisma is the only data access; Postgres is Supabase (pgvector *available* on the platform but not enabled; native tsvector already proven in one migration).
- **The DB-as-queue pattern works and is idempotent** (unique indexes for dedup, drain caps, webhook status joins) but adds up-to-an-hour latency and has no retry/backoff semantics beyond re-running the drain.
- **Existing kill-switch discipline is strong:** env master switches, per-agency toggles, per-file/party/contact pauses, sandbox email mode, forward-only cadence edits with per-file snapshots. New automation can inherit this pattern.
- **Anthropic usage is bare-metal:** one shared client, no retries, several unhandled-failure paths, no fallback models, no output-schema enforcement (regex JSON extraction), inconsistent model pinning. Costs only observed (one console log + a drift signal), never budgeted except images.
- **Email deliverability is a first-class asset** (white-label domains, verified senders, ASM groups, bounce suppression) - any automated sending must ride the existing resolution stack, not bypass it.
- **Microsoft Graph is already connected** (OAuth, encrypted tokens, read scope granted, send scope granted-but-unused, delta/change notifications unused) - the shortest existing path to inbound email, but currently single-mailbox and manual.
- **No staging/prod parity assumption:** staging Supabase exists; migrations apply staging-first by law.
- **Cost posture:** pre-launch, ~5 users; token spend is trivial today; the binding constraints are correctness and trust, not scale.

---

## 15. Existing AI inventory

| # | Call site | Model | Trigger | Output | Human gate | Writes DB | Failure handling |
|---|---|---|---|---|---|---|---|
| 1 | Chase drafting `app/api/ai/generate-chase` | haiku-4-5 (raw fetch, not SDK) | agent click | free text | edit+send in drawer | no (send route logs) | no try/catch on fetch |
| 2 | Content drafting `app/api/command/content/generate` | haiku-4-5 | superadmin click | 2 variants (regex-parsed) | approval flag + manual posting | DraftPost + token counts | none |
| 3 | Weekly review `lib/services/insight/weekly-review` | opus-4-7 (unpinned alias) | Mon cron | free text email | none (founder-only inbox) | OutboundMessage audit | none (cron unwrapped) |
| 4 | Daily brief `lib/services/insight/daily-brief` | haiku-4-5 | daily cron | free text email | none (founder-only) | OutboundMessage audit | cron try/catch |
| 5 | Content topics `app/api/cron/content-topics` | haiku-4-5 | **unscheduled** | JSON topics | feeds human flow | contentTopic rows | try/catch |
| 6 | File summary `app/actions/transaction-summary` | haiku-4-5 | click (single-email-gated prototype) | structured JSON | screen-only | none | try/catch + shape guard |
| 7 | Portal explain-email `app/api/portal/explain-email` | haiku-4-5 | portal visitor paste | free text to client | **none** | metadata marker (rate limit) | try/catch, DB-based 3/hr cap |
| 8 | Memo parse `app/api/agent/memo-parse` | **sonnet-4-6** (PDF beta) | agent upload | JSON (regex-extracted) | pre-fills form, human reviews | no (stores file) | try/catch, 422 on no-match |
| 9 | Problem-flag reasons `lib/services/problem-detection` | haiku-4-5 | daily cron | JSON labels | internal UI only | TransactionFlag.reason | **deterministic fallback** (best in codebase) |
| 10 | FLUX images `app/api/command/content/images/ai` | Replicate flux-schnell | superadmin click | image URL | human flow | GeneratedImage + cost | try/catch, £50/mo hard cap |

**Answer to the key question:** AI is used exclusively as isolated single-shot API calls. There is no persistent reasoning layer, no agent loop, no tool use, no conversation state, no retrieval. The only "pipelines" are DB-decoupled (detectors write Signal rows; a later cron summarises them). Prompts are inline strings tightly coupled to schema enums, with one code-coupled corpus file (`docs/chase-generation/MILESTONE_GLOSSARY.md`) and one DB-driven prompt section (voice samples). PII redaction logic is duplicated across two call sites.

---

## 16. Manual workload map

| Task | Frequency | Current trigger | Data available | Human action required | Communication involved | Potential automation level |
|---|---|---|---|---|---|---|
| Read + interpret email replies | daily, per reply | inbox (invisible to system) | outbound history, milestone state | read, identify file/milestone, decide | inbound email | Agent/workflow (needs ingestion) |
| Confirm milestones from off-platform info | daily | reply/call | full milestone engine ready to cascade | open file, click confirm, type eventDate | none (system then auto-notifies) | AI extraction + human approve |
| Chase after automation gives up | daily | "(manual)" chips, bells | chase counts, silence durations | notice chip, draft/send, or call | email/WhatsApp/phone | Rules (queue) + AI drafting |
| Re-chase solicitors (engines OFF today) | daily | reminder list | per-code cadence config exists | generate, edit, send | email | Already built; switched off |
| Answer client "what's happening?" | weekly+ per client | client message/call | milestone+chase+court state | compose bespoke narrative | email/portal/WhatsApp | AI drafting |
| Log phone calls + create follow-ups | per call | memory | contact, file context | type prose; hand-make tasks | phone | AI extraction (needs transcript source) |
| Onboard new sale | per instruction | MOS received | Sonnet extraction live | review/correct, fill gaps | none | Mostly done (AI extraction) |
| Type dates from emails (completion, expiry, survey) | per file | reply reading | fields + provenance slots exist | re-key dates | none | AI extraction (needs ingestion) |
| Update stub chain links | per chain check | phone call to other agent | linked-side auto-derives | call, type stub notes | phone | Partially (structure + claim growth) |
| Monitor mortgage expiry | should be weekly | none (card renders on open) | dates stored in ClientMoveInfo | remember to look | then chase | **Rules - trivially automatable now** |
| Coordinate exchange/completion dates | per exchange | solicitor emails | per-file dates once typed | compare, phone around | email/phone | Rules (conflict check) + human |
| WhatsApp send + transcribe | per message | human memory | wa.me links, paste importer | press send in WA; paste chats back | WhatsApp | Needs API integration |
| Prioritise the day | daily | hub counts | flags, urgency buckets, risk | choose among top-6+ | none | Rules/decision support |
| Weekly client update narratives | none exist | - | all progress data | ad-hoc when asked | email | AI drafting (greenfield) |
| Process agent to-do requests | per request | inbox item | free-text task | read, do elsewhere, close | varies | Human + AI classification |

---

## 17. Automation readiness map (1-5)

| Workflow | Data | Trigger | Action | AI usefulness | Risk | Notes |
|---|---|---|---|---|---|---|
| Inbound email -> milestone update | 2 | 1 | 5 | 5 | 4 | Action=5: the confirm cascade is fully built. Trigger=1: no ingestion. Risk=4: wrong confirm sends wrong emails to clients. |
| Chase persistence (incl. re-chase on silence) | 4 | 3 | 5 | 3 | 3 | Trigger=3: silence is detectable, replies aren't - risk of chasing people who answered. |
| Mortgage-expiry alerts | 4 | 5 | 5 | 1 | 1 | Deterministic; only gap is client-supplied coverage (Data=4). Cheapest win in the report. |
| Client narrative updates | 5 | 5 | 4 | 5 | 3 | All data structured + copy system exists; risk is tone/accuracy toward clients. |
| Call capture -> actions | 1 | 1 | 4 | 5 | 2 | Nothing upstream exists; downstream slots (expectedDate, tasks) do. |
| MOS onboarding | 5 | 5 | 5 | 5 | 2 | Shipped; residual risk = silent extraction errors surviving review. |
| Chain readiness/date alignment | 3 | 3 | 2 | 3 | 3 | Claimed links rich, stubs empty; no coordination surface to act through. |
| Exchange-readiness declaration | 5 | 5 | 3 | 2 | 5 | Derivation exists; the declaration itself must stay human. |
| Prioritised work queue | 4 | 4 | 4 | 3 | 1 | Signals exist, ranking doesn't; silence signal hard-coded to 0. |
| WhatsApp automation | 1 | 1 | 1 | 4 | 3 | Everything missing upstream of the human's phone. |

---

## 18. Missing instrumentation (genuinely absent, would multiply automation value)

1. **Reply state on communications** - the single highest-value absence: no captured replies, no reply-received timestamp, no send<->reply correlation ID (unpopulated half-fields exist: `OutboundMessage.openedAt/clickedAt/failedAt`, `repliedByEmailAt` manual toggle).
2. **`becameAvailableAt` on MilestoneCompletion** - "how long has this been actionable" is a proxy; first milestones can never be staleness-flagged.
3. **Milestone completion history** - reversal destructively wipes prior confirmer/date; no history table.
4. **Structured delay causes** - every reason field is free text; no taxonomy, no blocker attribution, no responsible-party linkage.
5. **Call outcomes** - no structured disposition/promise/follow-up on phone entries.
6. **Event-log completeness** - `Event` instrumentation is partial by admission; missing types incl. price change, assignment, note added, chain-link added, email failed, client info submitted; two confirm paths bypass it entirely.
7. **Assignment history** - overwritten in place.
8. **Transaction-level date provenance** - no estimated-vs-agreed flag on `expectedExchangeDate`/`completionDate` (milestones have it; the transaction columns don't).
9. **Contact preferences/identity** - no preferred-channel field, no global person entity across transactions, no record of who supplied each fact for non-milestone data.
10. **Lender + offer facts** - lender unmodelled; mortgage-offer expiry only exists if the client typed it; no confirmed-by-whom on it.
11. **Delivery state for non-queued email** - bounces on direct sends vanish.
12. **Stub-link progress** - no structured status for external chain parties (only free-text notes).

---

## 19. Representative code locations

- **Milestone engine:** `lib/services/milestones.ts` (chokepoint `completeMilestone` :843; gates :470; undo :1776+), `app/actions/milestones.ts` (all confirm actions incl. reconciliation paths), `app/api/milestones/route.ts` (divergent bypass), `lib/milestone-prerequisites.ts`, `prisma/seed.ts` (catalogue), `lib/services/milestone-staleness.ts`.
- **Reminders/chases:** `lib/services/reminders.ts`, `lib/reminders/classify.ts`, `lib/services/client-chase-cron.ts`, `lib/email/client-chase-digest.ts`, `lib/solicitor-confirm/{token,chase}.ts`, `lib/enquiries/{chase,raise-chase,tracker,chase-log}.ts`, `components/reminders/RemindersSection.tsx`, `components/chase/ChaseDrawer.tsx`.
- **Email:** `lib/email.ts`, `lib/email/agency-sender.ts`, `lib/email/outboundQueue.ts`, `lib/email/sendgrid-webhook.ts` + `app/api/webhooks/sendgrid-bounce/route.ts`, `lib/portal-copy.ts`, `lib/services/portal.ts` (milestone email engine), `lib/command/email-senders.ts` (catalogue of every email type).
- **Inbound (partial):** `lib/integrations/outlook/{config,sync}.ts`, `app/api/integrations/outlook/*`.
- **Portal:** `app/portal/[token]/*`, `app/actions/portal.ts`, `lib/services/portal-messages.ts`, `components/portal/*`.
- **Chain:** `prisma/schema.prisma:1530-1718`, `lib/services/chains.ts`, `lib/chain/{bottleneck,summary,withdrawal,split,status,permissions}.ts`, `lib/email/chainNotifications.ts`, `components/chain/ChainDrawer.tsx`, `app/api/claim/route.ts`.
- **AI:** `lib/anthropic.ts`, `app/api/ai/generate-chase/route.ts`, `app/api/agent/memo-parse/route.ts`, `app/actions/transaction-summary.ts`, `app/api/portal/explain-email/route.ts`, `lib/services/problem-detection.ts`, `lib/services/insight/{daily-brief,weekly-review}.ts`, `docs/chase-generation/*`.
- **Events/activity:** `lib/command/events/write.ts`, `prisma/schema.prisma:2052-2110` (EventType/Event), `lib/services/comms.ts` (`getActivityTimeline`, WhatsApp import), `components/activity/{CommsEntry,PasteWhatsAppPanel}.tsx`.
- **Staff surfaces:** `app/agent/transactions/[id]/page.tsx`, `components/transactions-v2/NewSaleFlow.tsx`, `app/agent/hub` -> `kinetic-hub.tsx`, `app/agent/work-queue`, `app/agent/to-do`, `app/agent/completions`, `app/agent/settings/automation`, `app/agent/automated-emails`.
- **Security/tenancy:** `lib/security/access-scope.ts`, `lib/prisma-rls.ts` (no-op), `middleware.ts`, `lib/ratelimit.ts` (disabled), `lib/auth.ts`.
- **Infra:** `vercel.json` (28 crons), `app/api/cron/*` (30 handlers incl. 2 orphans), `app/api/webhooks/*`, `lib/supabase-storage.ts`, `lib/services/push.ts`.

---

## 20. Executive summary

### What the application already does automatically
A genuinely large amount, all downstream of structured state changes: one milestone confirmation triggers per-audience emails with computed copy, digest batching, counterpart notifications, dependent unlocks, exchange-gate recomputation, chase cancellation, enquiry-tracker sync, billing stamps, chain-wide notifications, push, bells, and reminder recalculation. Time-based engines generate the human work queue, chase clients (capped, currently gated), chase solicitors and enquiries (built, switched off), detect eight kinds of file problems nightly with AI labels, produce staff digests and founder AI briefs, drain queues, reconcile billing to Stripe, and run a full chain withdrawal cascade. Document extraction at onboarding is live. The kill-switch and pause discipline around all of it is unusually mature.

### Where Ellis is still the automation layer
The system is a superb *outbound announcer and scheduler* attached to a *blind, deaf inbox*. Information enters via exactly four machine-readable doors: staff clicks, portal clicks, tokenised solicitor clicks, and one AI document extraction. Everything else the business runs on - email replies, phone calls, WhatsApp - arrives in Ellis's human senses, and he personally performs: **read** (the reply/call), **understand** (which file, which milestone, what changed), **decide** (does this confirm anything, who needs to know, chase or wait), **act** (click confirm, type dates, draft messages per audience), **communicate** (bespoke narratives, softened client versions, WhatsApp by hand), and **remember to revisit** (silence chips he must notice, expiries only visible if he opens the file, follow-ups he must self-create from calls). The cruel irony documented throughout: the *hard* half (what happens after a fact is known) is almost fully automated; the *mechanical* half (getting the fact into the system) is almost fully manual.

### The five biggest categories of manual workload
1. **Reply ingestion + interpretation** - reading every email/WhatsApp/call and translating it into milestone confirms, dates, notes, and next actions. No inbound channel exists; no reply is ever correlated to a send.
2. **Multi-audience communication authoring** - narrating the same fact to client, agent, and file in different tones; answering "what's happening?"; no client-facing periodic narrative exists.
3. **Silence management** - noticing when capped automation hands over (chips/bells inside individual files), deciding the next escalation, and keeping honest records of off-platform chases.
4. **Date and fact re-keying** - completion/exchange/survey/expiry dates and party details typed from documents and emails into fields (solved at onboarding by the memo extractor; unsolved everywhere else).
5. **Vigilance** - mortgage expiries, chain stubs, conflicting dates, and prioritisation: data the system holds but only surfaces passively, leaving the watching to a human.

### What another AI architect needs to know before recommending additions
- **The confirm cascade is the crown jewel and the correct integration point** - but only via the `completeMilestone` chokepoint; three write paths bypass it with materially different side effects.
- **There is no event bus and no queue** - the platform's native pattern is cron-drained tables on serverless Vercel; anything long-running or reactive needs to respect or replace that deliberately.
- **Reply-awareness is the keystone gap** - most other automation (chase honesty, date capture, milestone proposals, narrative generation) is blocked on or multiplied by it. Partial scaffolding exists: Outlook OAuth with read scope, `CommType.inbound`, an `EmailParseAttempted` event type, unpopulated reply fields.
- **Provenance discipline already exists on milestones** (event vs recorded vs expected date; per-confirmer attribution) - extend it, don't reinvent it; but transaction-level dates, the Event log, and reversal history do not meet the same standard.
- **Safety posture is app-layer only right now** (RLS commented out, rate limits off, non-expiring portal tokens) - autonomous actors would raise the stakes on all three.
- **AI is present but primitive by design** - ten single-shot calls, human-gated where it matters, no retries/schemas/fallbacks; prompts are inline and schema-coupled; one unmediated AI->client surface exists (portal explain-email).
- **Several relevant features are built but dormant**: solicitor + enquiry chase engines (master switch off), learned stage medians (capture live, consumption hardcoded), skeleton email mode, Outlook send scope, BuyerRound scaffolding, and two-way portal chat components (deliberately unmounted - declined 2026-08-16 in favour of WhatsApp; do not resurrect without a product decision).
