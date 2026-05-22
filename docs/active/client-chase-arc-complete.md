# Client-chase arc — complete reference

**Status:** Sub-arc A (A1–A6) + Sub-arc B (B1–B7) shipped on staging, flag-gated to no-op. Nothing emails real clients until `CLIENT_CHASE_ENABLED=true` is set in the Vercel environment. Last touched: 2026-05-22.

**Purpose of this document:** a single complete plain-English reference for the whole arc. Written for the product owner reading before a staging walk, not for a developer reading a changelog. The plain-English layer at the top of each section answers "what does the system now do?" The technical specifics underneath are for reference only.

The aim: when you walk the staging cron, the walk confirms your understanding rather than discovers new behaviour.

---

## TL;DR — the one-page version

### What the feature does in one paragraph

The system now automatically emails buyers and sellers when something on their sale is overdue, without the agent having to chase them manually. The clients can confirm a milestone is done, tell us a date they're expecting, or leave a note — all from a single page reached by the email link. If they go quiet (no response after two emails OR no engagement for 14 days), the chase is handed off to the agent with a clear "this client has gone silent" signal on the agent's task list. Throughout, the agent sees a small chip on every milestone row showing whether we're currently chasing the client about it, whether they've engaged recently, or whether they've opted out. Six bilateral milestones (ready-to-exchange, exchange, completion — both sides) are excluded because they're agent-orchestrated events, not client-confirmable actions. The whole system is currently off in production; it goes live only when you flip a flag.

### A client's experience, start to finish

1. The system has been chasing them for one or more sale milestones. A digest email lands in their inbox at the morning batch (one email per client per day, regardless of how many things are due).
2. The email has the subject line `{address}: one update needed` or `{address}: 3 updates needed` and a short body that reads differently depending on what kind of items are in the digest:
   - If everything is "yours to do" (e.g. sign contracts, complete ID checks): a calm "these only you can move forward" message.
   - If everything is "sitting with your solicitor or lender": a "no action needed unless you want to chase" message with the option to "let us know if you've heard back so we stop reminding you."
   - If it's a mix: both, grouped clearly.
3. They click the single link, which lands them on the respond page. The page shows the same items the email mentioned (or fewer, if any have been confirmed elsewhere since the email was sent). Visiting the page counts as engagement; the chip on the agent's view flips from "chasing" amber to "engaged" green.
4. For each item, three buttons: confirm it's done, tell us when they expect it, or leave a note. Each button opens an inline panel; submitting shows a brief "Done. We won't ask again." style pill before the row disappears. When they've cleared everything, the page says "That's everything. Thanks for the update."
5. They never see a "your sale is in trouble" or "URGENT" framing. Tone is calm and address-led throughout.
6. If they want to stop receiving these, an unsubscribe link in the email footer turns them off in one click. They land on a page that says "We won't email you about update reminders for your sale anymore. Your agent will still be in touch directly when they need something from you."

### An agent's experience, start to finish

1. Nothing in their existing workflow breaks. Their reminder feed, their milestone-confirmation buttons, their notifications all work as before.
2. On every milestone row in the file view, a small chip now appears when the client-chase system is actively touching that milestone. Three states:
   - **Amber: "Client chased 2d ago"** — we've emailed them about this; no response yet.
   - **Green: "Client engaged 1d ago"** — they've visited the respond page (or set a date / left a note) since the most recent chase; no need to manually chase them yourself.
   - **Grey: "Client opted out"** — the client has either unsubscribed, the chase escalated after two unanswered emails, or 14 days have passed in silence. The agent should now take over this chase manually.
3. When a chase escalates, the agent's task list shows a fallback message explaining why — for example "Automated client chase suppressed — client chased twice with no response. Reminder handed back to agent." (Five distinct fallback messages cover the different escalation reasons.)
4. The agent can still confirm any milestone themselves from their own UI as before. Client confirmations and agent confirmations now flow through the same backend code path so neither produces "missed" downstream effects.

### What is not yet live

- The whole chase pipeline is gated by `CLIENT_CHASE_ENABLED`. Until you set this to `"true"` in Vercel, the daily cron runs but returns `{ ok: true, skipped: "flag_disabled" }` and does nothing.
- Six database migrations are pending production (applied to staging already).
- B8 (SendGrid bounce webhook — auto-suppress on hard bounces) is deferred as a fast-follow.
- Two small follow-ups parked: the chip text in `RemindersSection.tsx` (still shows a single generic line for all five fallback kinds) and the wiring of the B6 client-chase chip on the agent transaction-detail page.

That's the whole thing in one page. The rest of this document drills into each piece.

---

## 1. What changed for existing behaviour

This is the section you most need for reassurance that nothing regressed. The arc made two changes to **existing** code paths; everything else was pure addition.

### 1.1 — Confirming a milestone (A1)

**Plain English:** Before this arc, when a client confirmed a milestone via the portal, the system did less than when an agent confirmed the same milestone from the agent UI — fewer notifications fired, fewer downstream effects, less audit trail. The arc unified these: a client portal-confirm now triggers the exact same chain of events as an agent confirm. The Confirmer (agent vs client) is recorded, but everything downstream is identical.

**What an agent's behaviour looks like, before and after:** identical. Agents confirming milestones from the agent UI experience zero change. The same notifications fire, the same audit logs are written, the same downstream milestones unlock. Nothing was removed from the agent path — the client path was brought up to parity with the agent path.

**Technical specifics:**
- The two code paths (agent vs portal) were collapsed into one shared service function with a `Confirmer` parameter.
- A small race-condition fix was made along the way: in the old portal path, a side-effecting call to the structured Notification system was being swallowed by an over-broad `.catch(() => {})`, masking failures. The unified path no longer swallows.

### 1.2 — Confirming six bilateral milestones via the portal (B1)

**Plain English:** Before this arc, the portal would theoretically let a client confirm any milestone whose ID they could reach (in practice they only saw the buttons the UI rendered, which already excluded the bilateral codes — but the server didn't enforce it). The arc adds server-side enforcement: the portal action throws a hard error if a client tries to confirm any of the six bilateral milestones (`VM18`/`PM25` ready-to-exchange, `VM19`/`PM26` exchange, `VM20`/`PM27` completion). This matches the product reality — these events are agent-orchestrated, both solicitors talking — and prevents a forwarded link or URL fiddling from misrecording them.

**What an agent's behaviour looks like, before and after:** identical. Agents can still mark these six milestones from the agent UI as before. The hard-block is portal-side only.

**What happens if a client somehow lands on a respond page deep-linked to one of these:** the respond page filters them out so they never appear in the displayed list. If they trigger the server action by some other route (manual URL, race), the action throws and the page falls back to a per-code explanation (the six locked strings in section 5.3 below).

**Technical specifics:**
- The set lives in `lib/chase/portal-agent-only-codes.ts`. The server action in `lib/services/portal.ts` throws `PORTAL_AGENT_ONLY_ERROR` (constant exported from the same module so both throw and catch sites are byte-identical).
- The chase pipeline separately excludes these same six via `CLIENT_CHASE_EXCLUDE` in `lib/chase/chaseable-milestones.ts` — semantically distinct ("we don't email about these" vs "clients can't confirm these") but identical contents today.

### 1.3 — Everything else is additive

No other existing behaviour changed. The reminder engine, the milestone engine, the portal pages, the agent UI, the email infrastructure — all retained their existing behaviours and gained new capabilities alongside.

---

## 2. The timing model in plain English

### When does a client get chased?

When ALL of the following are true:
1. A milestone they're responsible for (or a milestone sitting with their solicitor/lender) is `available` (not done, not blocked).
2. The grace period for that milestone has passed (each milestone has its own grace period, ranging from 1 to 21 days, defined per existing `ReminderRule`).
3. The transaction is active (not closed/declined).
4. They have a valid email address and a portal token, and they haven't unsubscribed.

### How often does a chase repeat?

Every milestone has a "repeat every N days" setting (same setting the agent's own reminder engine uses, ranging from 2 to 10 days depending on the milestone). The client chase uses the same number. Two chases maximum — never three.

### What stops the chases?

Three things, any one of which is enough:
- **The client engages.** Engagement = visiting the respond page OR using any of the three actions (confirm, set date, leave note). The chase pauses immediately; the chip in the agent's view flips from amber to green.
- **The milestone is confirmed** (by anyone, anywhere — client, agent, system). The chase row is marked `completed` and forgotten.
- **The client unsubscribes.** Their `unsubscribedAt` is set and no further emails to them go out.

### When does the chase hand off to the agent?

When either of these is true (whichever happens first):
- **Chase-count cap:** Two emails sent, the repeat window has fully closed after the second one, and there's been no engagement since the last chase. (For example: a 3-day-repeat milestone with two unanswered chases escalates 6 days after the first chase.)
- **14-day silence ceiling:** It's been 14 days since the client either first engaged or first got chased, and they haven't engaged since.

When either fires, the chase row's status flips from `active` to `escalated`. The agent's reminder task for that milestone surfaces a fallback chip explaining what happened (see section 4 for the five fallback messages).

### The day-1 floor (small but important)

Four rules in the system have a grace period of 0 days (memorandum-of-sale receipt on both sides). Without a floor, the system would fire a chase email the same day the transaction was created — which reads as robotic and slightly desperate even for a low-friction action. So the client cron applies a minimum of 1 day before the first chase, regardless of the rule's stated grace. The agent's reminder engine keeps its own grace-0 behaviour for its own task list; the floor is client-side only.

### "Interpretation B" — what happens at chaseCount=2

After the second chase email is sent, the system does NOT escalate immediately. It waits one more repeat window before declaring silence. The reasoning: the second email itself needs time to be read and acted on. Escalating the moment the second email is sent would be unfair. So the timeline is:

- Day 0: anchor confirmed
- Day grace: first chase email
- Day grace + repeat: second chase email (chaseCount=2)
- Day grace + 2×repeat: if no engagement since the second chase, escalate

This is locked. The verify script proves it works: a row at chaseCount=2 with lastChasedAt 4 days ago and repeatEveryDays=5 is NOT escalated (window hasn't closed); at 6 days ago it IS.

### A worked example end to end — PM8 (Searches Ordered)

PM8 is a NUDGE-solicitor milestone (the buyer's solicitor orders searches; the buyer can't do it themselves, but they can chase). Its settings from the live data:
- Anchor: PM7 (draft contract pack received by buyer's solicitor)
- Grace: 3 days
- Repeat: 3 days
- Recipient: the buyer (purchaser-role contact on the transaction)

Day 0 — PM7 confirmed (anchor lands)
- The buyer's solicitor confirms PM7 (or the agent marks it on their behalf).
- The system marks PM8 as `available`.
- No chase yet — within grace.

Day 3 — first chase
- The 0830 UTC cron runs. PM8 has been `available` for 3 days, the grace is hit, no `ClientChaseState` row exists yet → first chase fires.
- A `ClientChaseState` row is created: chaseCount=1, firstChasedAt=day3, lastChasedAt=day3, status=`active`.
- A digest email is queued for the buyer. Subject: `12 Acacia Avenue: one update needed`.
- Body uses NUDGE-solicitor tone: "One thing is sitting with your solicitor right now that we haven't seen confirmed yet: Searches ordered."
- Within 30 minutes, `drain-outbound-email` sends it (or at 0900 UTC; whichever).
- The agent's milestone row for PM8 now shows the amber chip: "Client chased today."

Day 3, late afternoon — client clicks the link
- They land on the respond page. The page-load bumps `lastEngagedAt`. The chip in the agent's view flips from amber to green: "Client engaged today."
- They don't click any button — just looked.
- The next chase is paused: even though the repeat window will close on day 6, the engagement gate blocks the chase.

If they NEVER click the link (no engagement):

Day 6 — second chase
- The cron runs at 0830 UTC. PM8 still `available`, the ClientChaseState row exists with chaseCount=1, lastChasedAt=day3, no `lastEngagedAt`. The repeat window (3 days) has closed.
- Second chase fires: chaseCount=2, lastChasedAt=day6.
- Another digest email — same NUDGE-solicitor tone — lands in their inbox.

Day 7-8 — still in window
- No further chase. chaseCount is at the cap (2) and the second window hasn't closed yet.
- The amber chip in the agent's view persists with "Client chased 1d/2d ago."

Day 9 — escalation
- The cron runs at 0830 UTC. The ClientChaseState row has chaseCount=2, lastChasedAt=day6 → second window closed (3 days). No engagement since lastChasedAt → chase-count cap path fires.
- Status flips to `escalated`. The chip in the agent's view goes grey: "Client opted out" (which here means "escalated after no response").
- The agent's reminder task for PM8 now carries the `max_chases_exhausted` fallback message: "Automated client chase suppressed — client chased 2 times (last on day 6) with no response. Reminder handed back to agent."
- No further emails will go to this client about PM8.

### What if the client engages mid-process?

Anywhere in the timeline above, an engagement event (page visit OR action) flips the chip green and pauses the chase. The chase resumes — at the same repeatEveryDays cadence — only if engagement goes quiet again (and only up to the cap of 2 total). Engagement also resets the 14-day silence clock: the silence path measures from the most recent engagement, not from firstChasedAt.

### What about the 14-day silence ceiling?

If a client engages on day 1, then nothing for two weeks: at day 15, the silence path fires even though chaseCount is only 1. The 14-day measure is from `max(lastEngagedAt, firstChasedAt)`. This catches the "they read the first email and clicked through but never actually did anything" pattern.

### Mutual exclusion: what if both ceilings hit at once?

Whichever applies first wins, and the row escalates exactly once. The two paths are checked in order (silence first), and the function uses an atomic database update with a `status="active"` precondition — so even if the cron crashed mid-run and a retry tried to escalate the same row again, the second attempt would be a no-op. The verify script proves this directly.

---

## 3. What hands off to a human — the complete list

The system never silently drops a chase. Every failure mode results in a fallback chip on the agent's reminder task explaining what happened. The agent then takes over manually. Five fallback kinds cover every case:

| Fallback kind | When it fires | What the agent sees on the chip |
|---|---|---|
| `client_opted_out` | The contact has clicked the unsubscribe link (their `unsubscribedAt` is set) and the chase pipeline therefore can't email them | "Automated client chase suppressed — {contact name} unsubscribed on {date}. Reminder handed back to agent." |
| `max_chases_exhausted` | The chase-count cap has been reached and the final window has closed without engagement | "Automated client chase suppressed — {contact name} chased 2 times (last on {date}) with no response. Reminder handed back to agent." |
| `days_cap_exhausted` | The 14-day silence ceiling has been hit | "Automated client chase suppressed — no engagement from {contact name} for {N} days since {date}. Reminder handed back to agent." |
| `no_email_on_contact` | The contact row has no email address (data hygiene gap) | "Automated client chase not sent — {contact name} has no email on file. Add an email or chase manually." |
| `no_portalToken_on_contact` | The contact row has no portal token (defensive — every contact gets one at creation, but defends against migration gaps) | "Automated client chase not sent — {contact name} has no portal access set up. Set up portal access or chase manually." |

When and how the chip surfaces:
- The chip text per kind is rendered in `AgentRemindersList.tsx` (the main agent reminders view). Each kind has its own distinct message — the agent doesn't see a generic "something went wrong" line.
- A second component, `RemindersSection.tsx` (the per-file reminders panel), still shows a single generic chip line ("Client opted out — manual") for all five kinds. This is a known follow-up parked at B3 — the parallel conversation has in-flight work on that file so we didn't touch it. The chip is visible and indicates a manual handoff is needed; only the per-kind specificity is missing on that one surface.

### The fail-soft guarantee

Every chase that can't proceed for any reason produces a fallback chip. No chase ever silently fails. The cron's logic is structured so that:
- A contact with no email is skipped by the chase pass (the SQL query filters them out at fetch time) AND would trigger the `no_email_on_contact` fallback chip when the agent's reminder engine next runs against that transaction. The agent never sees "this should have been chased" silence.
- A contact that's unsubscribed is skipped by the chase pass AND the agent gets the `client_opted_out` chip.
- A chase that escalates by chase-count or silence ceiling flips the row's status to `escalated` AND the agent gets the matching chip.

The audit trail is: every chase email enqueued writes a row to `OutboundEmailQueue` with the `emailType="CLIENT_CHASE"` tag and a deterministic `sourceId`. Every chase fired updates `ClientChaseState`. Every milestone confirm (by anyone) is recorded as before. You can reconstruct exactly what happened by reading these three tables.

---

## 4. The client-string table — every word a client can read

The centrepiece. Every string a buyer or seller can see across all four surfaces. If a client can see it, it's here.

Notation in this table:
- `{address}` = the first line of the property address (everything before the first comma)
- `{first}` = the first name extracted from the contact's full name
- `{n}` = the count of items in this digest
- `{phrase}` = one of three: "your solicitor", "your lender", or "your solicitor or lender"
- `{with-phrase}` = one of three: "with your solicitor", "with your lender", or "with your solicitor or lender"
- `{dd Mmm}` = formatted date like "15 Jun"

### 4.1 — Digest email — subject

| When | Subject |
|---|---|
| 1 item in digest | `{address}: one update needed` |
| 2+ items in digest | `{address}: {n} updates needed` |

### 4.2 — Digest email — DIY body (all items are `who: "you"`)

| When | Line |
|---|---|
| Always | `Hi {first},` |
| 1 item | `There's one thing on your sale at {address} that only you can move forward:` |
| 2+ items | `There are {n} things on your sale at {address} that only you can move forward:` |
| Per item | `  • {Milestone label}` |
| Closer | `Open the page below to confirm each one is done, tell us a date you're expecting, or leave a quick note about why it's delayed. It takes about a minute.` |
| CTA URL | `{respondUrl}` |
| Sign-off | `Thanks,` then `Sales Progressor` |
| Unsubscribe line | `If you'd rather we stop sending these, unsubscribe here:` then `{unsubscribeUrl}` |
| CTA button (HTML only) | `Open the page` |

### 4.3 — Digest email — NUDGE body (all items are `who: "solicitor"` or `"lender"`)

| When | Line |
|---|---|
| Always | `Hi {first},` |
| Always | `A quick update on your sale at {address}.` |
| 1 item | `One thing is sitting with {phrase} right now that we haven't seen confirmed yet:` |
| 2+ items | `{n} things are sitting with {phrase} right now that we haven't seen confirmed yet:` |
| Per item | `  • {Milestone label}` |
| Always | `You don't need to do anything yourself. If it's been a while and you want to chase, a short email often helps.` |
| Always | `If you've heard back and we just don't know yet, open the page below and let us know. We'll mark it done on our side so you don't get reminded again.` |
| CTA URL | `{respondUrl}` |
| Sign-off | `Thanks,` then `Sales Progressor` |
| Unsubscribe line | `If you'd rather we stop sending these, unsubscribe here:` then `{unsubscribeUrl}` |
| CTA button (HTML only) | `Open the page` |

### 4.4 — Digest email — MIXED body (digest has both DIY and NUDGE items)

| When | Line |
|---|---|
| Always | `Hi {first},` |
| Always | `A few updates on your sale at {address}. Some of these are yours to do; the rest are {with-phrase} and we're just flagging that we haven't seen them confirmed yet.` |
| DIY heading | `Yours to do:` |
| Per DIY item | `  • {Milestone label}` |
| NUDGE heading (solicitor only) | `With your solicitor (no action needed unless you want to chase):` |
| NUDGE heading (lender only) | `With your lender (no action needed unless you want to chase):` |
| NUDGE heading (both) | `With your solicitor and lender (no action needed unless you want to chase):` |
| Per NUDGE item | `  • {Milestone label}` |
| Always | `Open the page below to confirm the items that are done, set an expected date, or leave a note for anything that's running late.` |
| CTA URL | `{respondUrl}` |
| Sign-off | `Thanks,` then `Sales Progressor` |
| Unsubscribe line | `If you'd rather we stop sending these, unsubscribe here:` then `{unsubscribeUrl}` |
| CTA button (HTML only) | `Open the page` |

### 4.5 — Respond page — heading + sub-headings

| When | Line |
|---|---|
| Page heading (always) | `Updates on {address}` |
| Sub-heading, all DIY | `Hi {first}, these are yours to confirm or update us on.` |
| Sub-heading, all NUDGE, solicitor only | `Hi {first}, these are sitting with your solicitor. You don't need to do anything yourself, but if you've heard back, you can update us.` |
| Sub-heading, all NUDGE, lender only | `Hi {first}, these are sitting with your lender. You don't need to do anything yourself, but if you've heard back, you can update us.` |
| Sub-heading, all NUDGE, both | `Hi {first}, these are sitting with your solicitor or lender. You don't need to do anything yourself, but if you've heard back, you can update us.` |
| Sub-heading, mixed | `Hi {first}, some of these are yours; the rest are sitting with other parties. Update us on whatever you can.` |

### 4.6 — Respond page — per-row buttons (DIY vs NUDGE branching)

| Action | DIY button (who="you") | NUDGE button (who="solicitor"/"lender") |
|---|---|---|
| Confirm | `Yes, this is done` | `Yes, this is already done` |
| Set date | `Tell us when` | `Tell us when` |
| Note | `Leave a note` | `Leave a note for your agent` |

### 4.7 — Respond page — modal prompts inside each action

| Action | DIY prompt | NUDGE prompt |
|---|---|---|
| Confirm | `When did this happen? (optional)` | `When did you hear back? (optional)` |
| Set date | `When do you think this'll happen?` | `When are you expecting this?` |
| Note (universal) | `Tell your agent what's happening:` | `Tell your agent what's happening:` |
| Note textarea placeholder | `Anything they should know...` | `Anything they should know...` |

### 4.8 — Respond page — submit/cancel buttons inside modals

| State | Confirm modal | Date modal | Note modal |
|---|---|---|---|
| Idle | `Confirm` | `Save date` | `Send to agent` |
| Submitting | `Saving...` | `Saving...` | `Sending...` |
| Universal cancel | `Cancel` | `Cancel` | `Cancel` |

### 4.9 — Respond page — post-save in-place pills (A2 pattern, ~1.2s before row collapses)

| Action | DIY pill text | NUDGE pill text |
|---|---|---|
| Confirm | `Done. We won't ask again.` | `Thanks. We'll stop asking about this.` |
| Set date | `Got it. We'll wait until {dd Mmm} before asking again.` | `Got it. We'll wait until {dd Mmm} before asking again.` |
| Note | `Thanks. Your agent will see this.` | `Thanks. Your agent will see this.` |

### 4.10 — Respond page — full-page states

| State | Heading | Body |
|---|---|---|
| Empty (no due items on first load) | `Nothing waiting on you right now.` | `We'll email if anything new comes up on {address}. In the meantime, you can close this page.` |
| All-done (everything submitted this session) | `That's everything. Thanks for the update.` | `Your agent has been notified. We'll be in touch when the next step is ready.` |
| Opted-out banner (top of list when `unsubscribedAt` is set but they followed an old link) | n/a | `You've unsubscribed from these update reminders. You can still use this page if you want to. We just won't email you about items here unless you re-subscribe.` |

### 4.11 — Respond page — inline error messages

| Trigger | Message |
|---|---|
| Tried to set a date without picking one | `Please pick a date.` |
| Tried to leave a note with empty text | `Please type something first.` |
| Unknown error fallback (network, server) | `Something went wrong. Please try again or contact your agent.` |

### 4.12 — Respond page — previous-date hint (when `expectedDate` is set on a row)

| When | Line |
|---|---|
| The client previously gave us a date for this item | `You said around {dd Mmm} — has that changed?` |

### 4.13 — Hard-block lines (the six bilateral codes)

These render in place of the row controls if a client somehow lands on a respond page deep-linked to one of these milestones AND triggers a confirm action against it. In normal flow they never appear — the respond-page loader filters them out before display.

| Code | Line |
|---|---|
| VM18 (seller ready-to-exchange) | `Ready-to-exchange means your solicitor has confirmed to your agent that they're set to exchange contracts on your side. Exchange itself happens once the buyer's solicitor confirms the same. Your agent will mark this when your solicitor confirms it.` |
| PM25 (buyer ready-to-exchange) | `Ready-to-exchange means your solicitor has confirmed to your agent that they're set to exchange contracts on your side. Exchange itself happens once the seller's solicitor confirms the same. Your agent will mark this when your solicitor confirms it.` |
| VM19 (seller exchange) | `Exchange is the point where the sale becomes legally binding. Your solicitor and the buyer's solicitor confirm everything is agreed, and from then on neither side can pull out without big consequences. Your agent will mark this here once it's happened.` |
| PM26 (buyer exchange) | `Exchange is the point where the sale becomes legally binding. Your solicitor and the seller's solicitor confirm everything is agreed, and from then on neither side can pull out without big consequences. Your agent will mark this here once it's happened.` |
| VM20 (seller completion) | `Completion is the day the sale finishes. The buyer's solicitor sends the money over to your solicitor, and the keys hand over to the new owner. Your agent will mark this here once it's done.` |
| PM27 (buyer completion) | `Completion is the day you officially own the property. Your solicitor sends the money over to the seller's solicitor, and the keys become yours. Your agent will mark this here once it's done.` |
| Generic fallback (unreachable today but defends against future codes added to the SET but not the COPY map) | `Your agent handles this step. Nothing for you to do here.` |

### 4.14 — Unsubscribe surfaces

When a client clicks the unsubscribe link in a chase email:

| Surface | Heading | Body | Footer |
|---|---|---|---|
| Confirmation page after one-click unsubscribe (contact variant) | `You're unsubscribed` | `We won't email you about update reminders for your sale anymore. Your agent will still be in touch directly when they need something from you.` | `Changed your mind? Tell your agent and they can re-enable reminders for you.` |
| Confirmation page after one-click unsubscribe (generic, used for User/invite subjects — included for completeness) | `You're unsubscribed` | `We won't send you any more emails from this address.` | `Changed your mind? support@thesalesprogressor.co.uk` |
| Confirmation page if the link is invalid (any subject) | `Link not recognised` | `This unsubscribe link isn't valid. If you're still receiving emails, contact us directly.` | `support@thesalesprogressor.co.uk` |

The contact variant says "your sale" generically — not "your sale at {address}" — by deliberate design (security: the page does not look up the contact by ID to avoid an unauthenticated ID-keyed data read).

---

## 5. Schema and data changes — every new table, every new column

Six migrations land with this arc. Five small, one larger.

### Contact.unsubscribedAt (A2)
**What it's for, plain English:** a column on every contact recording whether they've clicked an unsubscribe link in any of our chase emails. If it's set to a date, the chase pipeline skips them and the agent gets the `client_opted_out` fallback chip.

**Technical:** `DateTime?` (nullable). Set to `now()` by the contact branch of the unsubscribe route. Once set, never cleared by the system — the manual re-subscribe path is to flip it back to NULL via Supabase (no UI for this in v1; logged in ELLIS_MANUAL_TODO.md).

### MilestoneCompletion.expectedDate (B2)
**What it's for, plain English:** a column for the client's *speculation* about when a milestone will happen, distinct from `eventDate` which is the *real* date when it actually does. If a client says "I think contracts will go off around the 15th," we write that to `expectedDate` and the milestone stays `available`. When the event actually happens, `eventDate` is filled and the milestone moves to `complete`. The respond page reads `expectedDate` to render the "You said around 15 Jun — has that changed?" hint on subsequent visits.

**Technical:** `DateTime?` (nullable) on the existing `MilestoneCompletion` table.

### ClientChaseState (B2)
**What it's for, plain English:** a new table that records, per (transaction, contact, milestone), the full history of how the chase pipeline has interacted with that client about that one milestone. How many times we've emailed them, when we first chased, when we last chased, when they last engaged, and what the current status is. This is the table the agent's milestone-row chip reads from to decide whether to show amber/green/grey.

**Technical:** New table. Composite uniqueness on `(transactionId, contactId, milestoneCode)`. Status enum: `active` | `completed` | `escalated` | `opted_out`. Other columns: `chaseCount` (Int), `firstChasedAt`, `lastChasedAt`, `lastEngagedAt` (all `DateTime?`).

### OutboundEmailQueue.recipientContactId (A5)
**What it's for, plain English:** the system already had a queue for outbound emails to internal staff (users). This added the ability to send to a Contact (buyer/seller) instead, by adding a second nullable recipient column. A database-level CHECK constraint ensures exactly one of the two recipient columns is populated — preventing a row from accidentally addressing both a user and a contact, or neither.

**Technical:** New nullable `String?` column referencing `Contact.id`. CHECK constraint: `(recipientUserId IS NULL) <> (recipientContactId IS NULL)`. This is the **non-additive reshape** the prod runbook will watch — schema constraints can fail in subtle ways under live load. Verified on staging.

### ReminderRule and ReminderLog (A4/B3)
**What it's for, plain English:** the existing reminder rules and logs gained no new columns. The `FallbackKind` enum used to render fallback chip text was extended from 1 to 5 kinds (see section 3). All five kinds are emitted from existing code paths — no schema changes needed, just new logic.

**Technical:** `FallbackKind` is a TypeScript union type in `lib/services/reminders.ts`, not a database enum — so adding kinds is code-only.

---

## 6. Things you might worry about — answered

A cautious-owner Q&A. If a question you have isn't on this list, that itself is a finding to surface; the doc is meant to leave none.

### "Did this break existing agent confirmations?"
No. A1 unified two code paths into one — the agent's path was the more complete one, and the client's path was brought up to its level. The agent's behaviour is identical before and after: same notifications fire, same audit log, same downstream unlocks. The verify scripts for A1 explicitly cover the agent path.

### "Can a client still confirm exchange or completion?"
No, and they couldn't before either — but now there's a server-side hard-block in addition to the UI not showing the buttons. The six bilateral codes (`VM18`/`PM25`, `VM19`/`PM26`, `VM20`/`PM27`) reject any client confirm attempt at the server with a `PORTAL_AGENT_ONLY_ERROR`. The agent confirms these from the agent UI as before.

### "What happens if a client has no email address on file?"
The chase pipeline silently skips them on the chase pass (the database query filters them out at fetch time), so no email goes anywhere it shouldn't. The agent's reminder task for the same milestone surfaces a `no_email_on_contact` fallback chip — visible, manually actionable. Fail-soft holds.

### "What if a contact has no portal token?"
Same as above. The chase pass filters them out (the query requires `portalToken IS NOT NULL`), and the fallback chip is `no_portalToken_on_contact`. In practice every contact gets a portal token at creation, so this is defensive against migration gaps.

### "What if two contacts share a sale (joint sellers, joint buyers)?"
Both get chased independently. Each has their own `ClientChaseState` row per milestone. The agent's chip aggregates across them: if ANY contact has opted out, the chip shows opted-out (the most-conservative state wins); else if ANY has engaged after their most-recent chase, the chip shows engaged; else if ANY has been chased, the chip shows chased. The chip's hover tooltip reports the contact count. The verify scripts for B6 cover this directly with multi-contact scenarios.

### "What if the cron runs twice on the same day (retry, double-trigger, manual fire)?"
Nothing duplicates. The system uses two layers of dedup:
- `OutboundEmailQueue.sourceId` follows the pattern `{transactionId}:{contactId}:{YYYY-MM-DD-UTC}` and has a unique constraint. A second enqueue with the same `sourceId` is a no-op (the insert fails silently and the existing row is returned).
- `ClientChaseState` is upserted: chaseCount only increments if the first enqueue actually inserted a new queue row. The verify script proves this directly — two cron runs back-to-back produce one queue row and chaseCount=1, not two and 2.

### "What if a client unsubscribes mid-chase?"
The next cron run skips them (the chase pass query filters out `unsubscribedAt IS NOT NULL`). The existing `ClientChaseState` row stays as it was — the chase doesn't re-fire. The agent's chip flips to grey on the next reminder-engine pass (the `client_opted_out` fallback kind). The escalation pass doesn't escalate them either, because their status is `active` not stuck at "we still owe them an email."

There's a subtle edge: if a client unsubscribes BETWEEN the cron enqueueing a digest and `drain-outbound-email` actually sending it, the existing email drain logic checks suppression at send time and skips the row. (This is via `isContactEmailSuppressed` from A2, the canonical "should we send?" check.) So even a digest that's already in the queue won't be sent if the client unsubscribed in the intervening minutes.

### "What happens if a client engages once and then goes quiet?"
The first engagement pauses the chase loop — even if the repeat window has elapsed, no further chase fires. But the 14-day silence ceiling still applies: it measures from `max(lastEngagedAt, firstChasedAt)`. So a client who engages on day 1 and never returns escalates on day 15 via the silence path. The verify script proves the silence path fires under this exact scenario.

### "What if a client clicks the same chase link twice (or shares it)?"
The respond page is authoritative on what to show — it reads `ClientChaseState` and the current milestone states, ignoring the `?items=` query parameter entirely (B5's locked behaviour). A stale or shared link will display the current due items, or "Nothing waiting on you right now" if everything has been confirmed elsewhere. The verify script for B5 proved this directly.

### "Does opening the respond page count as engagement?"
Yes. Every page load bumps `lastEngagedAt` for all of this contact's active `ClientChaseState` rows — not just the rows currently visible. The reasoning: a visit indicates attention, even if they didn't act. Engagement resets the 14-day silence clock and pauses the chase loop. (Documented as the locked behaviour in the B5 commit comment.)

### "Could a client confirm a milestone for a different transaction than their own?"
No. The portal token is the only auth surface, and it's tied to a specific `Contact` which has a `propertyTransactionId`. All actions are scoped to that transaction. The respond page's loader queries by `transactionId` derived from the contact, not by anything from the URL.

### "What happens if a milestone is marked complete between an email being sent and the client clicking through?"
The respond page filters items by current `MilestoneCompletion.state === "available"`. If the milestone was confirmed elsewhere (by the agent, by another contact, by the system), it drops from the display. The B5 verify script proves this directly — confirm a milestone after the digest is queued, then load the respond page, and the stale item is dropped.

### "Will this send emails outside business hours?"
The cron runs at 0830 UTC daily, and `drain-outbound-email` runs at 0900 UTC daily. Mail goes out around 0900 UTC. Business-hours scheduling is handled by the existing `drainOutboundQueue` logic — the chase pipeline doesn't bypass it.

### "If a chase row exists for a milestone but the milestone gets undone (reverted from complete to available), what happens?"
The existing `ClientChaseState` row is unaffected. If it was `completed`, it stays `completed`. The chase pipeline won't re-chase the same client about the same milestone (the status filter is `active` only). Re-chasing after an undo would be a separate feature ask — currently if a milestone is undone, the chase has been considered "delivered" once already and the agent takes over from there.

### "Can a malicious actor enumerate clients by guessing portal tokens?"
The portal tokens are random and the existing portal infrastructure already addresses this surface. The new respond page uses the same token validation as the existing portal pages. The unsubscribe link uses an HMAC-signed token that includes the contact ID as its subject — guessing one would require forging the HMAC, which requires the server secret.

### "What about the security note about the unsubscribe confirmation page?"
The page intentionally does NOT do an unauthenticated lookup of the contact by ID — that would be an IDOR pattern (any URL with `&c=<id>` could reveal an arbitrary contact's data). Instead, the contact-variant confirmation says generically "your sale" without the address. The recipient knows which sale; they were just emailed about it. The HMAC verification on the unsubscribe ACTION happens upstream; only the action is sensitive, not the confirmation message.

### "What if the cron throws halfway through a run?"
Vercel will retry on a 5xx response. The cron is structured so retries are safe: the dedup at the `OutboundEmailQueue` level (sourceId unique) and the `ClientChaseState` upsert (only the first enqueue increments chaseCount) means a retry processes the same transactions again without duplicating anything. The verify script proves this.

### "How do I know what the cron actually did on a given day?"
The route returns `{ ok: true, digestsEnqueued: N, contactsChased: N, escalations: N, byReason: { first_chase: N, repeat_due: N, chase_count: N, silence_14d: N } }`. Vercel logs the response. For deeper inspection: `OutboundEmailQueue` rows with `emailType="CLIENT_CHASE"` show what got enqueued (with the digest payload visible); `ClientChaseState` shows current per-(tx, contact, milestone) state.

### "If the system is wrong about something (cadence too aggressive, wrong tone), can I tune it without redeploying?"
Cadence comes from `ReminderRule.graceDays` and `ReminderRule.repeatEveryDays` — these are database rows you can edit directly. Changes take effect on the next cron run. The chase-count cap (2), silence ceiling (14 days), and grace floor (1 day) are constants in code — those require a redeploy to change. Tone is determined per-milestone by `getMilestoneCopy(code).who` in `lib/portal-copy.ts` — also code.

### "What's the relationship between agent chase tasks and client chase emails — do they run independently or coordinate?"
They run independently. The agent has their own chase task in `ChaseTask` per `ReminderRule`. The client chase pipeline is separate, with its own table (`ClientChaseState`). When the client chase escalates, the corresponding agent task surfaces the fallback chip — but the agent task itself was already there. The agent's chip is the only place they intersect.

### "Could the chase email accidentally be sent to a solicitor or agent contact?"
No. The cron's contact query filters by `roleType: { in: ["vendor", "purchaser"] }`. Only buyer and seller contacts can be recipients. The `getMilestoneCopy(code).who` field (which determines DIY/NUDGE tone) is separate from this — that field describes what kind of party owns the underlying action ("you" / "solicitor" / "lender") for the purpose of tone, not for the purpose of choosing recipients.

### "Will an agent ever be CC'd or BCC'd on a client chase email?"
No. The chase is purely client-facing. The agent's visibility is exclusively via the chip on the milestone row + the fallback chip on their reminder tasks.

---

## 7. What is not yet live and still pending

### Flag-gated to off

The whole pipeline is no-op until `CLIENT_CHASE_ENABLED=true` is set in the Vercel environment. The cron route returns `{ ok: true, skipped: "flag_disabled" }` when the flag is anything other than `"true"`. Set the flag on staging only first; walk the cron; then prod.

### Six migrations pending production

All six have been applied to staging. In production-deploy order:
1. `Contact.unsubscribedAt` (A2)
2. Unsubscribe HMAC + endpoint extensions (A3 — code only, no migration)
3. `OutboundEmailQueue.recipientContactId` + CHECK constraint (A5) — **this is the non-additive reshape; watch it land**
4. Chaseable-milestone allowlist (A6 — code only)
5. `ClientChaseState` table + `MilestoneCompletion.expectedDate` (B2)
6. Everything in B3–B7 — code only, no further migrations

The promote runbook will sequence these. The watched one is A5 because it adds a CHECK constraint that touches existing rows; staging verified it cleanly applies under live data.

### B8 — SendGrid bounce webhook (deferred)

When a SendGrid send results in a hard bounce, the system currently has no automatic suppression. B8 was scoped to add a webhook endpoint that listens for SendGrid bounce events and sets `Contact.unsubscribedAt` (or a dedicated `bouncedAt`, TBD) so the chase pipeline stops emailing them. Deferred as fast-follow — pre-launch with ~5 users the manual cost of finding and flagging a bouncing email is low.

### Two parallel-conversation follow-ups parked

- **`RemindersSection.tsx` chip text per fallback kind.** The B3 work expanded `FallbackKind` to five values and `AgentRemindersList.tsx` renders each with distinct text. The sibling component `RemindersSection.tsx` (the per-file reminders panel) still shows a single generic line ("Client opted out — manual") for all five. The file has in-flight work from a parallel conversation we didn't want to collide with. Logged in `docs/active/client-chase-discovery.md` follow-up section.
- **B6 agent chip wiring on the file-detail page.** The B6 work added the service helper, the `MilestonePanel` prop, and the `MilestoneRow` chip render. The agent's file-detail page (`app/agent/transactions/[id]/page.tsx`) does not yet call the helper or pass the prop, so the chip doesn't render in production. Same in-flight collision; small two-file follow-up commit after the parallel work lands.

Both follow-ups are non-blocking for the chase pipeline working correctly; they affect agent visibility only.

### The promote sequence (high-level)

When you give the word and the staging walk is clean:
1. Apply the six migrations to production in lexical order (Prisma's deploy applies them all automatically; A5 the one to watch).
2. Deploy the code (Vercel).
3. Leave `CLIENT_CHASE_ENABLED` unset (default: off). The cron runs but no-ops.
4. Validate the no-op path is clean for a day or two.
5. When ready, flip `CLIENT_CHASE_ENABLED=true` on production. The cron starts sending real emails on the next 0830 UTC run.

---

## 8. Reading guide for your staging walk

Given the above, here's what to check during the walk to confirm the document matches the running system:

### Read the actual generated emails

Trigger the cron with the flag on. Then in the Supabase `OutboundEmailQueue` table, find rows with `emailType="CLIENT_CHASE"` from today. Each row's `payload` contains the full subject/text/html. Read three or four — one DIY-only, one NUDGE-only, one mixed. Look for:
- Subject reads `{address}: one update needed` or `: N updates needed`. Address is the FIRST LINE of the property address only, not the full string.
- DIY body opens with "There's one thing..." or "There are N things..."; never "There is 1 things".
- NUDGE body opens with "A quick update on your sale at {address}." then "One thing is sitting with your solicitor..." (or lender; or both, depending on what's in the digest).
- Mixed body has both `Yours to do:` and `With your solicitor (no action needed unless you want to chase):` sections.
- Unsubscribe URL is present, includes a long HMAC-signed token, and is HTTPS to your portal domain.

### Click the respond link as a client

Use a private browsing window. Should:
- Land on the respond page with the same items the email mentioned.
- Show the sub-heading variant matching the items' tone composition.
- Show the per-row buttons with DIY or NUDGE labels matching each item's `who`.
- Bump `lastEngagedAt` in `ClientChaseState` on page load (verify via Supabase). The agent's milestone-row chip should flip to green within ~1 cron cycle.
- Submitting any action shows the in-place pill (~1.2s) before the row collapses.

### Click the unsubscribe link as a client

Should:
- Land on a page that says "You're unsubscribed" with the contact-variant copy ("update reminders for your sale", "your agent will still be in touch directly").
- Set `Contact.unsubscribedAt` in the DB.
- A subsequent cron run skips this contact entirely; the agent's reminder task for any pending milestone surfaces the `client_opted_out` fallback chip.

### Flag back off

Once the walk is complete, set `CLIENT_CHASE_ENABLED=false` (or unset it) on staging to return to a no-op state.

### What to flag if you see something off

Anything that doesn't match this document is either a bug or a doc gap. Either way, surface it before prod promote.

---

## 9. Where to find the code

For reference if you want to follow up on anything specific:

| Concern | File |
|---|---|
| Cron route | [app/api/cron/client-chase/route.ts](app/api/cron/client-chase/route.ts) |
| Cron logic (read + side-effecting) | [lib/services/client-chase-cron.ts](lib/services/client-chase-cron.ts) |
| Digest assembly (three tones) | [lib/email/client-chase-digest.ts](lib/email/client-chase-digest.ts) |
| Respond page (server) | [app/portal/[token]/respond/page.tsx](app/portal/[token]/respond/page.tsx) |
| Respond page (client UI) | [components/portal/RespondList.tsx](components/portal/RespondList.tsx) |
| Six hard-block strings | [lib/chase/portal-agent-only-copy.ts](lib/chase/portal-agent-only-copy.ts) |
| Bilateral allowlist (set) | [lib/chase/portal-agent-only-codes.ts](lib/chase/portal-agent-only-codes.ts) |
| Chaseable allowlist | [lib/chase/chaseable-milestones.ts](lib/chase/chaseable-milestones.ts) |
| Aggregator for agent chip | [lib/services/client-chase-state.ts](lib/services/client-chase-state.ts) |
| Milestone-row chip render | [components/milestones/MilestoneRow.tsx](components/milestones/MilestoneRow.tsx) |
| Fallback chip text (per kind) | [components/reminders/AgentRemindersList.tsx](components/reminders/AgentRemindersList.tsx) |
| Fallback kind union + helpers | [lib/services/reminders.ts](lib/services/reminders.ts) |
| Unsubscribe route | [app/api/unsubscribe/route.ts](app/api/unsubscribe/route.ts) |
| Unsubscribe confirmation page | [app/unsubscribed/page.tsx](app/unsubscribed/page.tsx) |
| Per-milestone copy (label + who) | [lib/portal-copy.ts](lib/portal-copy.ts) |
| Active ReminderRule data | DB query — `SELECT * FROM "ReminderRule" WHERE "isActive" = true` |
| ClientChaseState data | DB query — `SELECT * FROM "ClientChaseState"` |
| Manual ops follow-ups | [docs/active/ELLIS_MANUAL_TODO.md](docs/active/ELLIS_MANUAL_TODO.md) |
| Open follow-ups for the arc | [docs/active/client-chase-discovery.md](docs/active/client-chase-discovery.md) (follow-ups section) |

### Verify scripts (proof of the build)

Each commit ships with a verify script that exercises the relevant logic against fixture data:

| Sub-arc piece | Script |
|---|---|
| B1 hard-block | [scripts/verify-b1.ts](scripts/verify-b1.ts) |
| B2 schema + expectedDate | [scripts/verify-b2.ts](scripts/verify-b2.ts) |
| B3 fallback kinds | [scripts/verify-b3.ts](scripts/verify-b3.ts) |
| B4 digest assembly + enqueue dedup | [scripts/verify-b4.ts](scripts/verify-b4.ts) |
| B5 respond-page authoritative read | [scripts/verify-b5.ts](scripts/verify-b5.ts) |
| B6 agent chip aggregation | [scripts/verify-b6.ts](scripts/verify-b6.ts) |
| B7 silence-logic proof (14 scenarios) | [scripts/verify-b7.ts](scripts/verify-b7.ts) |

Run any of them with `npx tsx scripts/verify-bN.ts` — they create fixtures, exercise the logic, assert correctness, and clean up after themselves.

---

*End of document. If you finish reading and have a "but what about..." that isn't answered above, that's a doc gap to fill before the walk, not a question to answer in your head.*
