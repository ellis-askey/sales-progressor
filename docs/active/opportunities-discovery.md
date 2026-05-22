# Opportunities discovery — 2026-05-21

Read-only investigation into what's *latent in the system* — capabilities we've already built most of and could exploit with one more push. Not a generic feature wish-list.

---

## Headline findings (what the codebase actually says today)

1. **Every milestone already knows which side is responsible.** `MilestoneDefinition.side` is an enum (`vendor` / `purchaser`) — set at definition time, used by the engine to filter, gate the exchange unlock, and route bilateral pairs (VM19↔PM26, VM20↔PM27). [`prisma/schema.prisma:406–427`, `lib/services/milestones.ts:559–564`]

2. **Per-milestone grace + chase config is fully wired.** `ReminderRule` has `graceDays`, `repeatEveryDays`, `escalateAfterChases`, `useEventDate`, `requiresExchangeReady` — all DB-driven, not hard-coded. The reminder engine reads these and creates `ChaseTask` rows automatically. [`prisma/schema.prisma:456–473`, `lib/services/reminders.ts:79–91, 183–362`]

3. **Zero automated outbound exists today.** The `OutboundMessage.isAutomated` field is in the schema and is **never set to true anywhere in the codebase**. Every chase goes: reminder fires → ChaseTask created → agent opens drawer → AI drafts → agent edits → agent clicks send. The only auto-outbound is chain-arc emails (invite, withdrawal, exchange/completion celebration). [`prisma/schema.prisma:537–615`, `lib/services/reminders.ts:82–89`, `components/chase/ChaseDrawer.tsx:268–301`]

4. **The Email Arc queue is generic and ready for new event types.** `OutboundEmailQueue.emailType` is a free-form string; the drain ignores unknown types. Adding a new emailType ("MILESTONE_AWAITED_BUYER" etc.) requires **zero schema change to the queue itself**. [`prisma/schema.prisma:853–868`, `lib/email/outboundQueue.ts:86–115`]

5. **But the queue can't send to non-agents yet.** `OutboundEmailQueue.recipientUserId` is required, and suppression is gated on `User.emailUnsubscribedAt`. Sending to a `Contact` (buyer / seller / solicitor) needs either a relaxed constraint *or* a parallel `ContactSuppression` model. **No per-Contact consent / unsubscribe state exists in the schema today.** [`prisma/schema.prisma:270–286, 345–357, 853–868`]

6. **Predictions are computed but nearly invisible.** `calculatePhaseAwarePrediction()` produces a `predictedExchangeDate` per file from `MILESTONE_DURATION_MEDIANS` (47 milestone codes, critical-path chains). That date is *computed* on every file page render but is **not rendered prominently anywhere** — not in the agent sidebar callout, not on the portal home, not anywhere a buyer/seller could see it. [`lib/services/fees.ts:77–88, 133–243`, `app/agent/transactions/[id]/page.tsx:60+`]

7. **LinkCard's progress bar is a hardcoded ratio, not the real weighted progress.** Chain drawer renders `completedMilestones / 28` as the per-link % — bypassing the weighted milestone-engine output. Misleads anyone looking at the chain. [`components/chain/LinkCard.tsx:103–105`]

8. **No cross-link aggregation exists in the chain layer.** `lib/services/chains.ts` has `isChainBroken()` (one boolean) and nothing else. No "which link is furthest behind", "all ready to exchange", "median time per milestone across the chain". The data is there; the aggregation isn't.

9. **The portal doesn't show the chain at all.** Buyers/sellers see their own side's milestones + the *other side's* milestones in their own file. They don't see any other link in the chain. [`app/portal/[token]/progress/page.tsx`, `app/portal/[token]/page.tsx`]

10. **WhatsApp import stores raw messages, no analysis.** No threading, no question/answer detection, no milestone tagging. Rich data, captured, untouched. [`lib/services/comms/parse-whatsapp.ts:1–261`]

---

## Method

Three parallel codebase sweeps:
- Milestone engine + party/solicitor contacts + email pipeline shape (extensibility for new event types).
- Reminder/chase flow + comms log + WhatsApp import + portal data exposure.
- Chain graph state + speed/prediction signals + per-chain analytics.

Every claim below cites a specific file:line. Nothing here is "AI thinks this is a nice idea" — it's "the system has built X% of this, here's the remaining Y%."

---

## The ideas (each with the standard structure)

### Seed 1 — Proactive party nudges (buyer / seller direct outbound)

**What it does.** When a milestone is awaited from a buyer or seller and grace-days elapse, the system sends *the party themselves* a polite first-touch email ("Just checking in on the survey — please book when convenient"), spaced by the existing rule's `repeatEveryDays`, and concurrently notifies the other side ("we've asked X to confirm Y, no action needed from you"). After 1–2 sends, escalates to the agent's task queue (current behaviour). The agent stays in the loop but stops doing the first knock manually.

**What already exists:**
- `MilestoneDefinition.side` distinguishes vendor vs purchaser milestones already [`prisma/schema.prisma:406–427`].
- `ReminderRule.graceDays` / `repeatEveryDays` / `escalateAfterChases` are per-rule configured in seed [`prisma/seed.ts:328–378`].
- `Contact` model holds `email`, `phone`, `roleType` (vendor/purchaser/solicitor/broker/other) on every transaction [`prisma/schema.prisma:270–286`].
- `OutboundEmailQueue` is generic — drains via `drainOutboundQueue()`, business-hours scheduler, idempotent unique constraint, error-tolerant. New `emailType` strings work out of the box [`lib/email/outboundQueue.ts:86–115`].
- AI chase generator already produces tone- and channel-aware drafts; could be reused to produce the *party-facing* nudge with a different tone preset [`app/api/ai/generate-chase/route.ts:28–35`].

**The gap:**
1. **`recipientUserId` is required on `OutboundEmailQueue`** — buyers/sellers don't have User rows. Either relax the constraint (`recipientUserId` becomes nullable) or add a parallel `recipientContactId`.
2. **No per-Contact consent / suppression state.** `User.emailUnsubscribedAt` exists; there's no equivalent on `Contact`. We need: a consent flag captured at point-of-contact-creation, a `ContactSuppression` model (or `Contact.unsubscribedAt`), and an unsubscribe link in the party-facing email that hits a tokenized endpoint mirroring the existing `UNSUBSCRIBE_SECRET` HMAC pattern.
3. **No "responsible party — buyer or seller — for this specific milestone" mapping.** `side` says vendor/purchaser at the *milestone definition* level, but each side has both a solicitor *and* a buyer/seller. e.g. PM5 ("Buyer has applied for mortgage") is owned by the buyer (party), but PM7 ("Buyer's solicitor received draft contract pack") is owned by the solicitor. Need a `MilestoneDefinition.actor` enum: `party` / `solicitor` / `agent` — orthogonal to `side`.
4. **Nudge copy doesn't exist.** The AI generator handles agent-side voice; party-facing voice is different (we're talking *to* the buyer, not *about* the buyer to another agent). Needs a new tone preset + glossary entries.

**Effort: medium.** ~2–3 commits. Big-ticket pieces: `Contact.unsubscribedAt` migration + endpoint, `recipientContactId` queue relaxation, `MilestoneDefinition.actor` enum + backfill, party-tone AI prompt. ~50–60% of this is wiring through existing rails.

**Risk:**
- **Spam / deliverability.** This is exactly what the Email Arc unsubscribe + business-hours work guarded against — same discipline applies. First-time receipt has to be impeccable: clear sender, agent's agency name in the from-line, easy unsubscribe.
- **Wrong party.** If a Contact's email is wrong (typo) or shared (e.g. couple sharing one address), we email the wrong person about their sale. Need a "confirm we have your right address" step or a soft first-send that asks.
- **Compliance.** This is direct marketing-adjacent. UK data law: the contact is in our system because they're the principal in a sale being progressed by the agency — legitimate-interest basis is defensible, but we need the unsubscribe + suppression discipline before the first send.
- **Tone calibration.** A nudge from "Foster & Co" lands differently from a nudge from "The Sales Progressor". Sender identity has to be the agency (we built `agencyFrom()` for this in the Email Arc — reuse).

**Schema change:** **Yes — 3 small ones.** `Contact.unsubscribedAt` (nullable timestamp). `OutboundEmailQueue.recipientContactId` (nullable, mutually exclusive with `recipientUserId`). `MilestoneDefinition.actor` (enum, with backfill mapping from current milestone codes).

---

### Seed 2 — Solicitor-milestone nudges

**What it does.** Same pattern as Seed 1, but targeted at the *solicitor* on the file when a solicitor-side milestone (welcome pack issued, searches ordered, searches back, enquiries raised, replies received) is awaited. The biggest single source of chain delay per the medians data (PM13 "Search results back" = 21 days; VM9 "Mgmt pack received" = 21 days).

**What already exists:**
- `SolicitorContact` model with `name`, `phone`, `email`, `firmId` [`prisma/schema.prisma:345–357`].
- `Contact.roleType = "solicitor"` rows linked per-transaction [`prisma/schema.prisma:270–286`].
- Solicitor analytics exist (`getSolicitorExchangeStats()`) — we already track per-solicitor avg days to exchange [`lib/services/analytics.ts:324–379`]. So we can pick the slow ones to nudge first.
- Same queue + reminder rule + email arc infra as Seed 1.

**The gap:**
1. Same queue + consent + actor-mapping work as Seed 1.
2. **Different tone register.** Solicitors are regulated professionals; tone should be neutral, factual, no warmth ("for your file ref X: status update requested"). Needs its own tone preset.
3. **CC the agent by default.** Solicitor comms in this market always copy the agent; the nudge should mirror that — solicitor as primary, agent on CC.
4. **One-knock then escalate.** Solicitors don't want repeat automated chases. Probably one polite nudge after grace-days, then fall back to current agent-task behaviour rather than auto-repeating.

**Effort: medium** (slightly less than Seed 1 — solicitor email is professional B2B, fewer GDPR edges than party email). ~2 commits if Seed 1 has shipped (re-uses the actor enum, the queue relax, the suppression model). ~3 if standalone.

**Risk:**
- **Solicitor relationship damage.** A misjudged automated chase to a busy senior conveyancer is a real reputational hit for the agency. The repeat-cycle cap matters more here than for parties.
- **Solicitor unsubscribe = file breaks.** If a solicitor unsubscribes, future nudges can't fire — but the milestones still need to progress. Suppression needs to fail soft: convert back to an agent ChaseTask, never a silent gap.

**Schema change:** **Yes — same as Seed 1.** Plus optionally: `Contact.communicationPreference` (enum: `nudge_ok` / `agent_only` / `unsubscribed`) so a solicitor can be marked "agent only" without being fully unsubscribed from system updates.

---

### Idea 3 — Surface the predicted exchange date

**What it does.** Take the `predictedExchangeDate` we already compute and put it in three places: (a) the agent file detail page as a prominent callout ("Expected exchange: 14 June (12 days)"), (b) the portal home for the buyer/seller, (c) the chain drawer per link card.

**What already exists:**
- Full critical-path prediction engine in `lib/services/fees.ts:77–243`. 47 milestone medians, dependency chains, per-side remaining-days.
- `calculatePhaseAwarePrediction()` returns `predictedExchangeDate` and is invoked on every agent file render via `calculateProgress()` [`app/agent/transactions/[id]/page.tsx:60+`].

**The gap:**
- It's not rendered anywhere prominent. Pure UI gap. Three small components to wire it into.
- Stale-bust: when does the prediction refresh? Confirm it's recalculated on milestone-completion events (likely yes via the same `calculateProgress` call path).

**Effort: small.** One commit. Maybe two if portal + chain drawer get separate passes.

**Risk:**
- **Misleading false precision.** "Expected 14 June" sounds specific; the median-based forecast has wide variance. UI should hedge: "Around 14 June (±5 days)" or "Early–mid June, based on similar files".
- **Buyer/seller anxiety if it slips.** A visible prediction that visibly moves later is worse than no prediction. Need a "as of today, …" framing + a non-spike change indicator.

**Schema change:** **No.** Pure rendering.

---

### Idea 4 — "Slower than median" per-milestone alert

**What it does.** On each agent file, surface a small badge per milestone showing "your file is X days slower than median for this step" (only when the gap is meaningful, e.g. >50% over median). Makes the speed leak visible without burying it in a separate analytics page.

**What already exists:**
- `MILESTONE_DURATION_MEDIANS` defined for all 47 codes [`lib/services/fees.ts:77–88`].
- `MilestoneCompletion` records hold `completedAt` and `eventDate` — both are queryable for elapsed-time calculation [`prisma/schema.prisma`].
- The current file detail page renders the milestone list with completion state already.

**The gap:**
- One helper function: `daysSinceMilestoneBecameAvailable(transactionId, milestoneCode)` → compares to median → returns a delta.
- Wire it into the existing milestone-list renderer with a conditional badge.
- Probably a per-file aggregate too: "5 of your 28 milestones are slow — likely exchange slip: +9 days".

**Effort: small.** One commit, mostly logic.

**Risk:**
- **Median is per-platform, not per-agency.** A high-volume agency in a hot London market has different real benchmarks than a regional agency. Surface median as guidance only; eventually move to per-agency rolling median.
- **Reconciled completions contaminate medians.** Already handled — the `reconciledAtClaim` flag from the reconciliation arc excludes those rows from aggregates. Good.

**Schema change:** **No.**

---

### Idea 5 — Chain bottleneck identifier

**What it does.** Per chain, identify the link that's furthest behind (by weighted progress or predicted-exchange delta) and surface that to every link's agent: "Your chain's holdup is link 3 (Foster & Co, 47 Oak Road) — 14 days behind chain median". Stops the constant "where's it stuck?" calls between chain-mates.

**What already exists:**
- `PropertyChain` + `ChainLink` data model with per-link `transactionId` linking to full milestone state [`prisma/schema.prisma:755–822`].
- `calculateProgress()` runs per-transaction and returns `predictedExchangeDate`.
- Chain drawer already renders per-link cards.

**The gap:**
- New function: `computeChainBottleneck(chainId)` → iterates each claimed link's transaction, runs `calculateProgress()`, returns the link with the latest `predictedExchangeDate`.
- UI surface: a banner at the top of the chain drawer ("Holdup: link 3, +14 days vs others").
- *Bonus*: send the bottleneck signal to the agent on the slow file as a separate notification ("Your chain is waiting on you — currently 14 days slower than the median link").

**Effort: small/medium.** One function + UI banner. Computation is N transactions per chain (typically 2–5).

**Risk:**
- **Naming and blame.** Calling out "Foster & Co is the holdup" by name to other agents creates friction. UI should phrase neutrally ("the file at 47 Oak Road") and resist personalisation.
- **Wrong attribution.** A link can be slow because *its solicitor* is slow, not because the agent isn't pushing. The bottleneck signal should encourage chain-mates to escalate together, not to point fingers.
- **Stub links skew.** Unclaimed stubs have no progress data — exclude from bottleneck math.

**Schema change:** **No.**

---

### Idea 6 — Chain-wide exchange readiness signal + auto-celebration

**What it does.** When every link in the chain hits its exchange-readiness gate (VM18 / PM25), automatically: (a) fire a celebratory "all parties ready" email to every agent in the chain, (b) flag the chain as "ready to coordinate exchange" in every agent's UI, (c) optionally send a "we're ready" message to each link's portal so buyers/sellers see it too.

**What already exists:**
- VM18/PM25 exchange-gate logic already in the milestone engine [`lib/services/milestones.ts:210–217, 275–323`].
- `OutboundEmailQueue` + chain-arc emails (invite, withdrawal, exchange) already fire on chain events [`lib/email/chainNotifications.ts`, `lib/services/milestones.ts:559–564`].
- `PropertyChain.celebrationSentAt` already exists in the schema — this slot is *literally pre-built* for this purpose.

**The gap:**
- Detection function: `isChainReadyForExchange(chainId)` → returns true when every claimed link has VM18 *and* PM25 ticked.
- Trigger: hook into the same event path as bilateral pair triggers, fire chain-wide email.
- The portal-visible piece (c) needs a tiny new portal banner.

**Effort: small/medium.** One commit if scoped to (a) + (b); add a third for (c).

**Risk:**
- **Premature celebration.** Exchange-readiness is a *necessary* but not *sufficient* gate — actual exchange requires solicitor-to-solicitor coordination on the day. The email should say "all parties ready" not "we're exchanging today".
- **False fire on broken chain.** A withdrawn link can leave the gate technically met for others. Need `isChainBroken() === false` AND every link claimed in the readiness check.

**Schema change:** **No** — `celebrationSentAt` already exists.

---

### Idea 7 — LinkCard real weighted progress (small-bug-fix)

**What it does.** Replace the hardcoded `completedMilestones / 28` ratio on `LinkCard` with the actual weighted progress already returned by `calculateProgress()`.

**What already exists:**
- `calculateProgress()` returns the correct weighted % per transaction [`lib/services/fees.ts`].
- LinkCard already pulls transaction state.

**The gap:**
- Replace one line in `LinkCard.tsx:103–105`. The data is already in the rendered tree (or one query call away).

**Effort: tiny.** ~10 minutes.

**Risk:** None visible.

**Schema change:** **No.**

---

### Idea 8 — Portal: chain mini-view + ETA

**What it does.** Add a "Your chain" section to the portal home — the same mini-chain visual the claim flow uses, with the buyer/seller's link marked as theirs, and a "Expected exchange: ~14 June" line. Reduces the inbound "what's happening with the others?" calls because the answer is already on the screen.

**What already exists:**
- Chain visual component already exists for the claim flow [`app/claim/page.tsx`, `app/claim/signup/page.tsx`].
- Portal exposes `link.chain.links` via the existing query path — the data is right there.
- `predictedExchangeDate` already computed.

**The gap:**
- New portal component reusing the claim chain visual.
- Privacy review: should other links' addresses be visible to a buyer/seller in this chain? The claim flow shows them; the portal probably should too with the same convention.

**Effort: small/medium.** One commit. Most of the work is privacy-decisions + a small refactor of the claim chain component for reuse.

**Risk:**
- **Privacy overreach.** Showing "the buyer at 47 Oak Road is the holdup" inside a buyer/seller portal is more exposure than they get today. Likely fine because the addresses are public-domain (Rightmove, Land Registry), but it's a design decision Ellis should make.
- **Buyer/seller misreading.** If they see another link's progress and think it's theirs, confusion. UI has to make "you are here" unmissable.

**Schema change:** **No.**

---

### Idea 9 — Days-since-stale staleness indicator (agent + portal)

**What it does.** On every milestone that's `available` (not yet started) for >grace-days, show a "Awaiting: X days" badge. Today the staleness exists in the data (anchor date + elapsed time) but isn't visible until a chase task appears.

**What already exists:**
- `MilestoneCompletion.state` (available / locked / complete / not-required) [`prisma/schema.prisma`].
- Reminder rules know the grace-days per milestone.
- The anchor / `useEventDate` plumbing already determines what date to count from.

**The gap:**
- A small helper: `daysSinceAvailable(completion, rule)`.
- UI: badge per milestone row in the agent file + (selectively) on the portal.

**Effort: small.** One commit.

**Risk:**
- **Staleness anxiety on the portal.** Showing "Awaiting: 21 days" to a buyer/seller can panic them. Need to either gate behind a "you've waited >median" threshold, or pair it with reassuring copy ("typical for this stage — your agent is on it").

**Schema change:** **No.**

---

### Idea 10 — Auto-send the first chase (low-friction templates only)

**What it does.** For specific low-stakes milestones — confirming receipt of something, polite first nudge — when the reminder fires, *auto-send* a formal email (using the existing AI generator with a "first nudge" tone) without queueing a ChaseTask. The agent sees the auto-send in the comms log and only gets a task if the nudge gets no response after `repeatEveryDays`.

**What already exists:**
- `OutboundMessage.isAutomated` field exists, never set [`prisma/schema.prisma:537–615`].
- The full chase pipeline (generator + send) is one POST [`app/api/chase/send-email`, `components/chase/ChaseDrawer.tsx:268–293`].
- Reminder rules already know per-milestone timing.

**The gap:**
- Per-milestone "auto-nudge-eligible" flag on `ReminderRule` — most milestones stay agent-task, a few become auto.
- A simple opt-in / consent step at file creation: "Allow Sales Progressor to send polite first nudges to <party> for milestone X?"
- The auto-send path itself: when reminder fires AND the rule is auto-eligible AND consent exists, generate + send + log to OutboundMessage with `isAutomated = true`.

**Effort: medium.** ~2 commits. Most of the work is the consent gate, not the send logic.

**Risk:**
- **Auto-send accidents.** A single wrongly-configured rule could send 50 inappropriate emails in a morning. Strict per-milestone allowlist, daily-cap circuit breaker, easy global kill-switch.
- **Reduced agent visibility.** If the auto-send happens silently, the agent doesn't learn the file is sticky. Solution: every auto-send appears in the file's activity feed prominently, with a "stop auto-nudges on this file" link.
- **Trust erosion.** Self-managed agents will hate any sense of "the system is acting on my behalf without me". Has to be explicit opt-in per file, never default-on.

**Schema change:** **Yes — small.** `ReminderRule.autoNudgeEligible` (bool), `PropertyTransaction.autoNudgeOptIn` (bool), and the OutboundMessage `isAutomated` field becomes meaningful for the first time.

---

### Idea 11 — Comms thread analysis: "no reply in N days"

**What it does.** Detect when an outbound chase has had no inbound reply in N days, surface that to the agent as a "stuck conversation" signal. Builds on the WhatsApp import + comms log to spot dropped threads.

**What already exists:**
- `OutboundMessage` with `direction` (inbound / outbound), timestamps, `contactIds` linking to a Contact [`prisma/schema.prisma:537–615`].
- WhatsApp import gives us inbound messages with sender attribution [`lib/services/comms/parse-whatsapp.ts`].

**The gap:**
- **No thread or subject concept.** Messages are individual rows with no `inReplyTo` field. We'd have to infer "this inbound from Sarah is a reply to that outbound from agent to Sarah" by sender + timestamp window.
- No classification (question vs FYI vs status) — but we could start with the dumb version: any outbound to a Contact with no inbound from that Contact within N days = potentially stuck.

**Effort: medium/large.** First version is just a stuck-detector heuristic (small). A real version with threading + question detection is large.

**Risk:**
- **False positives.** "No reply" doesn't always mean stuck — maybe the question didn't need an answer ("just to confirm we received your documents — thanks"). Heuristic-only version will have noise.
- **Privacy of imported WhatsApp.** Once a buyer/seller has sent us their personal WhatsApp history, applying NLP / classification on it raises the privacy bar — even though we already store it.

**Schema change:** **Maybe** — a `Conversation` or `Thread` model for proper threading; not needed for the dumb heuristic.

---

### Idea 12 — Solicitor performance signal (already half-computed)

**What it does.** Per-solicitor performance widget on the file detail page: "This solicitor takes a median 18 days for searches — yours is on day 14, on track" or "...yours is on day 29, slower than median".

**What already exists:**
- `getSolicitorExchangeStats()` already computes per-solicitor avg days to exchange [`lib/services/analytics.ts:324–379`]. We have the data.
- `Contact.roleType = "solicitor"` + `SolicitorContact` give us the solicitor identity per file.

**The gap:**
- Per-milestone-band slices of solicitor performance (not just overall exchange) — searches, enquiries, replies, exchange.
- A small "this solicitor's performance on this milestone vs platform median" widget.

**Effort: small/medium.** Mostly query work + a small UI component.

**Risk:**
- **Defamation-adjacent if surfaced wrong.** "Your solicitor is slow" is a fact-finding to the agent only; **never** show solicitor performance to the buyer/seller directly. Even agent-side, use neutral phrasing ("median 18 days; your file is on day 29") not editorial ("your solicitor is slow").
- **Sample-size noise.** Solicitors with 2–3 files in our system aren't meaningfully benchmarkable. Need a min-N threshold before showing the signal.

**Schema change:** **No.**

---

## Ranking — (value × already-built) ÷ effort

Each axis 1–5. Higher score = bigger win for less work.

| # | Idea | Value | Built | Effort | Score | Notes |
|---|---|---|---|---|---|---|
| 7 | LinkCard real weighted progress | 2 | 5 | 1 | **10.0** | Pure bug fix; 10 minutes. Wrong progress shown today. |
| 3 | Surface predictedExchangeDate | 4 | 5 | 1 | **20.0** | Engine produces the date already, nobody sees it. |
| 6 | Chain-wide exchange-readiness + celebration | 5 | 4 | 2 | **10.0** | `celebrationSentAt` is literally pre-built for this. |
| 4 | "Slower than median" per-milestone alert | 4 | 4 | 2 | **8.0** | Medians + completions both queryable; one helper + UI badge. |
| 5 | Chain bottleneck identifier | 4 | 4 | 2 | **8.0** | One aggregation function + banner. |
| 9 | Days-since-stale indicator | 3 | 4 | 2 | **6.0** | Helper + badge; same dataset as #4. |
| 8 | Portal chain mini-view + ETA | 4 | 4 | 3 | **5.3** | Reuses claim chain visual; privacy decision required. |
| 12 | Solicitor performance per-milestone | 3 | 4 | 2 | **6.0** | Per-solicitor stats already exist; slice differently. |
| 2 | Solicitor-milestone nudges (Seed 2) | 5 | 3 | 4 | **3.75** | Needs Seed 1's consent + queue work. Compliance-heavy. |
| 1 | Proactive party nudges (Seed 1) | 5 | 3 | 4 | **3.75** | Big-ticket: consent model, queue relax, actor enum, party-tone AI. |
| 10 | Auto-send first chase | 3 | 3 | 3 | **3.0** | Consent gate is the hard part, not the send. |
| 11 | Comms thread "no reply" detection | 4 | 1 | 5 | **0.8** | No threading concept exists. Big new build. |

---

## What I'd build first

**Quick wins this week (1–2 commits):**
- **#7 LinkCard weighted progress fix.** Misleading data on every chain panel today. Cheapest possible win.
- **#3 Surface predictedExchangeDate.** Everyone is asking the question this answer already exists for. Pure rendering.

**One-arc next (1 week):**
- **#6 Chain readiness + celebration.** `celebrationSentAt` being pre-built is a tell — the schema author was already thinking about it. Closes a real coordination loop and uses every piece of Email Arc infra.
- **#4 + #5 + #9 as a single "speed visibility" arc.** All three pull on the same data shape (medians, completion timestamps, rule grace-days). Could ship as one commit with three small UI pieces.

**Bigger arc when ready (2–3 weeks):**
- **Seeds 1 + 2 as a single "outbound-to-party" arc.** They share the consent/suppression/queue-relax/actor-enum work; doing them together is roughly the effort of one and gives both. Start by shipping the *agent's experience* of it (preview the nudge before send, allow per-file disable, audit log) before any auto-send.

**Defer / not yet:**
- **#11 Comms thread analysis** — interesting, but the data shape isn't built for it. Revisit after we've actually built threading.
- **#10 Auto-send** — only after Seeds 1+2 have shipped *manual-confirm-before-send* mode and earned trust on staging with real test data.

---

## Cross-cutting observation

The recurring theme: **the system computes a lot that nobody sees.** Predictions, medians, completion timestamps, side-ownership — all there in the engine, none of it surfaced to either agents or parties at the right moment. Several of the highest-value/low-effort ideas above (#3, #4, #5, #9, #12) are essentially "render existing computed state in the right place at the right time." Before building anything new, an arc that closes the visibility gap on what we *already know* would probably move the needle more than a new outbound feature.

The Email Arc made the system *capable* of outbound at the right time. The next arc could be: make the system *visible* about what it already knows. Then outbound has a place to point to.
