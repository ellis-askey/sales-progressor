# Sales Progressor — Marketing Site Brief

*For: the designer and copywriter briefed on thesalesprogressor.co.uk*
*Written from the codebase, April 2026*

---

## Part 1 — What Sales Progressor is

Sales Progressor is a property transaction management tool built for estate agencies who run their own sales progression in-house. It gives the person managing a sale — the sales progressor — a structured system for tracking every legal milestone across vendor and purchaser sides simultaneously, sending automated updates to buyers and sellers, managing reminders and chases, and giving agents a live window into their pipeline. Buyers and sellers get a separate client portal: a mobile-friendly progress tracker that shows exactly where their transaction sits, what's happening and why, and what's coming next — without having to call or email anyone to find out.

One important clarification on the business model: Sales Progressor is a service, not just software. Estate agencies sign up, and for every sale they onboard, they choose between two tiers:

- **Self-progress** (£59 inc VAT charged on exchange) — the agency's own negotiators use the software to progress the sale themselves
- **Outsource to our team** (£250 / £300 / £350 inc VAT depending on sale price band, charged on exchange) — our in-house progression team handles it end-to-end; the agent still sees everything in real time via the agent dashboard

This per-sale choice is the core model. No competitor offers it.

---

## Part 2 — The three audiences

### The progressor (admin user)

**Who they are.** A sales progressor is typically employed by an estate agency to keep transactions moving from offer acceptance to keys in hand. They're managing 20–60 live files at once, fielding calls from buyers, sellers, solicitors, and agents simultaneously. They spend a large portion of their day chasing — calling solicitors to find out where a search result is, sending holding emails to anxious buyers, updating agents who want to know why a sale is taking so long. The work is relentless and most of it doesn't scale.

**Problem before.** Before a tool like this, progressors typically worked from a spreadsheet, a shared inbox, and memory. They had no systematic way to see which files were falling behind, no quick record of when they last made contact on a specific file, and no way to send a buyer an update without composing a fresh email. Every chase was manual. Every client question required context-switching to find the right file.

**What they get.** A dashboard that shows every active file with status, days elapsed, and task queue. A property file per transaction that tracks all 29 vendor-side and 27 purchaser-side milestones, with completions, dates, and reversals all logged. A work queue that surfaces which files need attention today, in priority order. Automatic reminders triggered by milestone completions or elapsed time. A comms log that records every interaction against the right transaction. Analytics showing pipeline value, fee totals, average days to exchange, and monthly volume across the agency.

**The one differentiating thing.** When a progressor confirms a milestone, the right email goes automatically to the right people — buyer, seller, their agent, and any other recipient — personalised per recipient type, in plain English, not conveyancing jargon. They don't write that email. It writes itself.

---

### The agent (estate agency negotiator or director)

**Who they are.** An estate agent who listed the property and whose commission depends on it reaching completion. They're not managing the legal process day-to-day, but they're fielding vendor calls ("has exchange happened yet?"), trying to push for earlier exchange dates, and sometimes not sure if a file has moved in two weeks. Directors want oversight of the whole office pipeline; individual negotiators want to see just their own files.

**Problem before.** Agents had no visibility into the conveyancing process unless someone told them. They had to call the progressor to find out anything. Their CRM (Reapit, Alto, Street) told them the offer was accepted but nothing after that. They had no structured way to flag something urgent to the progressor — it was a Teams message or a phone call.

**What they get.** A separate agent portal with their own login, showing their active transactions with status, days elapsed, forecast exchange timeline, and a post-exchange strip for files nearing completion. They can view the full milestone detail on any transaction. They can raise a request to the progressor directly from within the app — it lands in the progressor's to-do list as an "agent request" with distinct styling so it doesn't get lost. Directors can see all files across the office; negotiators see only theirs.

**The one differentiating thing.** The forecast strip: a month-by-month view of expected exchange dates across all active files, which makes it trivially easy to answer "when are we going to have a good month" without phoning anyone.

---

### The buyer or seller (portal user)

**Who they are.** Someone in the middle of the biggest financial transaction of their life. They have almost no visibility into what's actually happening — solicitors send dense legal letters, estate agents say "no news is good news," and the weeks pass in silence. The emotional register is anxiety interrupted by confusion. Most buyers and sellers have never done this before, or haven't done it in seven years.

**Problem before.** No structured communication. Updates arrived when someone remembered to send one, in formats that assumed legal literacy. The question "where are we?" required a phone call. The silence between milestones felt like stagnation even when everything was on track.

**What they get.** A mobile-optimised portal, accessed via a link in their welcome email — no app download, no account creation. It shows their specific transaction: a circular progress indicator, the next thing that needs to happen, what's coming after that, and a timeline of everything that's already been confirmed. Milestone groups are written in plain English and organised by stage. Stage-appropriate tips rotate weekly to explain what typically happens at each point. When exchange happens, they see a full-screen banner with confetti, the completion date, and a countdown. When completion happens, a second celebration marks it.

**The one differentiating thing.** The portal explains what's happening and why, not just what's happened. A milestone confirmation sends an email — personalised to their side of the transaction — that says what this milestone means for them, what the other party is now doing, and what to expect next.

---

## Part 3 — Why this product exists

The thesis is this: property transactions take three to five months not because the legal process requires it, but because information moves too slowly between the people involved. Solicitors wait for clients to return packs. Agents wait for progressors to update them. Buyers wait for anyone to call them back. Every wait multiplies because nobody knows what the other person is waiting for.

Sales Progressor is built on the idea that if the right information reaches the right person at the right time — automatically, in language they understand — transactions move faster and fall through less often. The progressor gets a system. The agent gets visibility. The buyer and seller get transparency. The process doesn't get shorter by magic; it gets shorter because fewer things stall waiting for someone to pick up the phone.

---

## Part 4 — Feature inventory (current state only)

All features below ship in the current production build.

### Progressor / admin features

- **Dashboard** — Filterable list of all active transactions with status, days elapsed, assigned user, and task badge counts. Ships: current.
- **Work Queue** — Prioritised task list of pending reminders and automated chase items across all files, sorted by urgency. Ships: current.
- **To-Do list** — Manual tasks created by the progressor, plus a separate "Agent requests" section for tasks flagged by agents, visually distinguished. Ships: current.
- **Completing strip** — Dedicated view of files that have exchanged and are in the completion window, with urgency grouping. Ships: current.
- **Property file — milestones** — Per-transaction view of all 29 vendor-side and 27 purchaser-side milestones, with confirm/reverse/not-required controls, date capture for time-sensitive steps, and automatic email dispatch on confirmation. Ships: current.
- **Property file — reminders** — Automated reminder rules triggered by milestone completions or elapsed time; manual chase log entries; escalation tracking. Ships: current.
- **Property file — comms log** — Record of every communication on a file (email, phone, SMS, WhatsApp, post, voicemail), with method badge, content, and timestamp. Ships: current.
- **Property file — contacts** — Vendor, purchaser, solicitor, broker, and other contacts per transaction, with portal invite and portal token management. Ships: current.
- **Property file — activity timeline** — Chronological feed of all events on a file: milestone confirmations, comms entries, notes, and status changes. Ships: current.
- **Property file — chain widget** — Simple chain link view showing the transaction's position in a chain of related sales. Ships: current.
- **Property file — documents** — File upload and document storage per transaction, accessible to portal users if shared. Ships: current.
- **Solicitors** — Firm-level directory of all solicitor firms across transactions, with handler contacts and file counts. Ships: current.
- **Analytics** — KPI dashboard: active files, pipeline value, average days to exchange, completion rate, our fee pipeline, agent fee pipeline, monthly volume bar chart, progressor breakdown table, referral income tracking. Ships: current.
- **Reports** — Separate reporting page. Ships: current.
- **Not Our Files** — View of transactions where the agent self-progresses. Ships: current.
- **Admin panel** — User management, agency configuration; admin role only. Ships: current.
- **Global search / command palette** — Ctrl+K search across transactions, contacts, and solicitors; also surfaces quick navigation to any main page. Ships: current.
- **Changelog** — Bell icon in sidebar showing recent releases with unread indicator. Ships: current.
- **Feedback button** — Floating button for bug reports, feature ideas, and general feedback. Ships: current.

### Agent features

- **Agent dashboard** — Pipeline view: all the agent's active files, status, days elapsed, exchange forecast strip, post-exchange strip; directors see all agency files. Ships: current.
- **Agent transaction file** — Read-only detailed view including milestones, reminders, contacts, solicitors, activity feed, notes, and risk/health indicators. Ships: current.
- **Flag to progressor** — Raise a manual request to the progressor with a message; appears in progressor's to-do list flagged as an agent request. Ships: current.
- **My requests panel** — All tasks previously flagged by the agent, with current status (pending / resolved). Ships: current.
- **Role split** — Director role sees all agency files; negotiator role sees only their own. Ships: current.
- **Agent analytics** — Analytics scoped to the agent's own transactions. Ships: current.
- **Agent comms log** — Comms filtered to the agent's own transactions. Ships: current.

### Buyer / seller portal features

- **Milestone progress view** — Emoji-grouped milestone checklist for the user's side (vendor or purchaser), with confirmed/pending/not-required states. Ships: current.
- **Circular progress indicator** — Percentage complete on portal home based on milestones confirmed. Ships: current.
- **Next action card** — The single most important thing for the user to do or expect right now. Ships: current.
- **Coming up section** — The next two or three milestones, with plain-English labels. Ships: current.
- **Key dates** — Time-sensitive milestones with confirmed dates (mortgage offer expiry, survey date, exchange target). Ships: current.
- **Rotating stage tips** — Three context-aware tips per stage from a library of 40+ entries, changing weekly. Ships: current.
- **Milestone email notifications** — On each confirmation, personalised emails to buyer, seller, agent, and progressor — each written in the recipient's frame. Ships: current.
- **Portal updates / timeline** — Chronological feed of confirmed milestones and internal updates, with side badges distinguishing vendor and purchaser events. Ships: current.
- **Client milestone confirmation** — Buyers and sellers can confirm certain milestones themselves from the portal. Ships: current.
- **Exchange celebration** — Full-screen coral/amber banner with confetti, completion date, and countdown. Ships: current.
- **Completion celebration** — Full-screen green banner with confetti marking the transaction as done. Ships: current.
- **Portal push notifications** — Optional browser push notification subscription. Ships: current.
- **Document access** — Documents shared by the progressor are accessible in the portal. Ships: current.
- **Two-sided milestone view** — For linked transactions, shows both sides' progress with the other side marked as view-only. Ships: current.

---

## Part 5 — Visual and tonal identity

### Admin product: dark glass

The admin UI is a dark glass design system layered over a photographic backdrop. The backbone is a full-viewport hero image (`/public/hero-bg.jpg`) rendered at 0.52–0.58 opacity behind every page. All UI surfaces — sidebar, cards, panels, modals — are frosted glass: `backdrop-filter: blur(40px) saturate(200%)`, white fill at 44–56% opacity, with edge highlights that pick up light from the image behind them.

The palette is restrained: slate text, white glass surfaces, emerald for active/on-track states, amber for warnings, blue for in-progress, violet for fee data. No loud colours. The emotional register is "in control."

Key signature moves:
- Dark panels for page headers use a stronger glass treatment with the photo visible through them (`rgba(8,12,24,0.72)` + `blur(32px)`). Section labels reverse-out in white at varying opacities.
- Cards use a chromatic edge highlight on their top border — a faint gradient (`rgba(255,255,255,0.50) → rgba(200,220,255,0.30)`) that catches the light like etched glass.
- The sidebar uses a distinct shadow separating it from content without a hard line.
- Screenshots for reference: `public/ab-dark.png`, `public/phase1c-static.png`, `public/phase1c-flash.png`

### Portal: warm light

Page background: `#F8F9FB`. Cards are white with soft shadows. All radius values are generous (20–28px). The emotional register is calm and approachable.

The hero gradient runs coral-to-amber (`#FF8A65` to `#FFB74D`). Primary interactive colour: coral (`#FF6B4A`). Secondary: blue (`#3B82F6`). Success: emerald (`#10B981`). Milestone groups use emoji headers (👋 🏦 🔍 ⚖️ 🔑 🎉).

Key signature moves:
- Circular progress ring on portal home in coral.
- Confirmation modals use a bottom sheet on mobile.
- Exchange and completion banners are full-width, full-bleed celebration moments — the only surfaces in the product that use strong solid colour fills.
- Confetti fires in two staggered bursts (coral, amber, gold — particleCount 120 then 60, spread 80° then 120°).
- Screenshots: `public/phase1b-preview-v2.png`, `public/phase1b-preview.png`, `public/phase1-refine-v1.png`, `public/ab-light.png`

---

## Part 6 — Voice and tone

**On buyer/seller surfaces (portal, portal emails): warm, plain, anticipatory.**
Treats the reader as intelligent but not legally trained. Explains what's happening without condescension, always adds "what this means for you." Uses the reader's perspective throughout. Acknowledges that waiting is hard. Does not use legal terms without explaining them.

Examples from the codebase:
- "This is the moment that makes it real." (exchange email)
- "You've formally instructed your solicitor to act on the sale. They'll now start the conveyancing process on your behalf — preparing the contract pack, gathering title documents, and raising any questions from the buyer's side."
- "Return your solicitor's welcome pack as quickly as possible. It's the single thing that makes the biggest difference to the pace of your transaction."
- "Management packs can take 4–8 weeks — this is one of the most common causes of delays in leasehold sales."
- "The quickest thing you can do to speed up your transaction is reply to requests within 24 hours."

**On progressor and agent surfaces: terse, data-first, no handholding.**
Labels are short. Counts are numbers. Actions are imperative ("Confirm", "Reverse", "Mark not required"). The interface doesn't explain itself.

**Words the product uses:** confirm, exchange, completion, on track, on hold, withdrawn, flag, chase, milestone, pipeline, instruction, conveyancer, progressor.

**Words the product avoids:** stakeholder, leverage, streamline, empower, journey, ecosystem, world-class, game-changing, platform, solution, revolutionary, AI-powered.

**Emotional register by surface:**
- Portal home: calm confidence. "Here's where you are. Here's what's next."
- Portal milestone confirmation: satisfaction. The confetti is proportionate, not overwrought.
- Portal exchange banner: genuine excitement. "This is the moment that makes it real."
- Portal completion banner: warmth and closure. "Sale complete."
- Admin dashboard: focus. Much information, cleanly organised, no filler.
- Agent dashboard: efficiency. Numbers, file list, exchange forecast.

---

## Part 7 — The moments that matter most

**Exchange — the portal banner.** A coral-amber full-width banner fires with a two-burst confetti animation; for most buyers and sellers, this is the first time they feel certain the sale is going to happen.

**Completion — the portal banner.** Green banner, second confetti burst. The product marks it properly; most software treats this as just another status change.

**Confirming a milestone from the portal.** The buyer or seller taps "Yes, it's done" on something they've done themselves. A confetti burst confirms it. The action is small but the feeling is ownership.

**The first time a client opens the portal.** They see their address, a progress percentage, and — for most of them — more information about their own transaction than they've had at any point before. The bar is low; the effect is large.

**The exchange forecast on the agent dashboard.** A recurring moment of clarity: a month-by-month view of when each file is likely to exchange. Replaces a phone call with a glance.

**The first automated email a buyer receives after a milestone confirmation.** Arrives minutes after the progressor clicks confirm. Written from their perspective. For many recipients, the first communication that explains something in plain English without being asked.

---

## Part 8 — What the marketing site must NOT do

- Don't position this as generic SaaS. Every line should be recognisably about property transactions.
- Don't use stock estate-agency photography. No happy couples with keys, no agents pointing at houses, no sold boards.
- Don't say "AI-powered." It is not the pitch. The pitch is transparency, structure, and speed.
- Don't mimic Reapit, Alto, or Street.co.uk. The visual comparison set is closer to Notion, Linear, or Monzo.
- Don't lead with the feature list. Lead with the problem — the silence, the anxiety, the chasing.
- Don't address buyers and sellers in the marketing. They don't choose this product.
- Don't use the word "platform."
- Don't describe it as "end-to-end" or "all-in-one." It manages communication and milestone tracking between instruction and completion.
- Don't use the milestone count as a selling point. "29 vendor milestones" means nothing to someone who hasn't used the product.
- Don't say "per-transaction pricing" as the headline. Say "pay on exchange" — that's the emotionally correct framing. You pay when the sale completes, not as an ongoing cost.

---

## Part 9 — Testimonials

No real testimonials yet — placeholder content needed.

---

## Part 10 — Competitive landscape

The obvious comparison set is Reapit, Alto (Zoopla's CRM), Street.co.uk, and PropertyBase. These are all estate agency CRMs — they manage listings, valuations, viewings, and offers. None of them does what Sales Progressor does after offer acceptance; the conveyancing phase is uniformly weak across the category, usually handled by a notes field and a manual status dropdown. Their marketing is dominated by stock photography, enterprise-blue colour schemes, and feature matrices. Street.co.uk is marginally newer-looking but still firmly in the CRM-for-agencies category. None of them has a buyer/seller-facing portal that goes beyond a basic progress bar. The marketing site for Sales Progressor should be visually legible as a different category of product — one that takes its design as seriously as the category leaders in fintech or productivity tools — and should not look like any of them.
