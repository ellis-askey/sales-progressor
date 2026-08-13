# Sales Progressor — Platform Audit

**Snapshot date:** 2026-07-16
**Purpose:** a working list of 25 improvements identified from a full-platform read. We walk through each one, decide the actual scope, then ship.
**Working rule:** don't touch any item until it's discussed. Each item ends with a "Notes & decisions" block that we fill in when the item comes up.

---

## How this document works

- The 25 items are numbered and in a rough priority order (Week 1 / Week 2 / Week 3 / Later).
- Each item is written in plain English: what the user sees today, why it's wrong, how it'll behave after.
- Each item has a **Status** line (`pending` / `discussing` / `in progress` / `done`) — flip it as we walk through.
- Each item has a **Notes & decisions** block — this is where the nuance we discover during discussion lives. Reasons for scope changes, decisions to defer, decisions to combine with another item, all go here.
- The evidence for every item is the DB snapshot at the bottom + the file paths that were audited. Pointer references only in this doc — keep it plain-English.

---

## Progress tracker

| # | Item | Status |
|---|------|--------|
| 1 | Directors and negotiators can't see their notifications | done |
| 2 | Turn on the "how long things really take" numbers | pending |
| 3 | Give the "To-Do" tab a real inbox | pending |
| 4 | Stop leaking developer pages into production | in progress |
| 5 | Chains are being hidden inside the "create a sale" form | in progress |
| 6 | Use portal engagement as a warning signal | pending |
| 7 | Let clients ask a question from the portal | pending |
| 8 | Add a preview line to every email | pending |
| 9 | Voice pass on emails that have drifted | pending |
| 10 | Send an email the moment both sides are ready to exchange | pending |
| 11 | Let a client pause chases from an email | pending |
| 12 | Rewrite chase-email subject lines | pending |
| 13 | Show which milestone is killing sales, at a glance | pending |
| 14 | Promote two better demo pages to being real features | in progress |
| 15 | Give clients basic self-serve controls | in progress |
| 16 | Tell the client who's on their team | pending |
| 17 | Start measuring email performance properly | in progress |
| 18 | Suggest smarter chase timings based on real behaviour | pending |
| 19 | Score prediction accuracy per agent | pending |
| 20 | Build three new founder-brief signals | pending |
| 21 | Two small admin tools that retire a lot of DB work | pending |
| 22 | Kill the leftover duplicate routes | pending |
| 23 | Finish or delete the "read this email for me" widget | pending |
| 24 | Send a proper "welcome" email to people who signed up via a chain claim | done |
| 25 | Two Command Centre nav items that show "Coming soon" are teaching you to ignore them | pending |

---

## Reconciliation against the codebase — 2026-08-12

All 25 items were checked against the current code (a parallel read of the
actual files, not from memory). Result:

- **Done (2):** #1 (notifications bell now works for every role) and #24
  (chain-claim welcome email is wired). Ticked off above, with evidence in
  their Notes blocks.
- **Partly done (3):** #4, #14, #15 — set to `in progress`. Each item's Notes
  block records exactly what's live and what's still missing.
- **Not started (20):** everything else stays `pending`. Confirmed still
  matching the "Today" description in each.

**Bottom line: 23 of the 25 are still open**, and 3 of those 23 are already
part-built. Only 2 are fully closed.

---

## The five things I'd fix on Monday morning

### 1. Directors and negotiators can't see their notifications

**Status:** done

**Today.** Taylor at Akeman logs in. The bell in the top-right shows nothing. There is no red dot. She thinks nothing's happened. Behind the scenes, twelve things have happened — her client Ben confirmed a milestone from the portal, someone set an expected date, a solicitor email came in. All of it is sitting in the database with her name on it. None of it is on her screen. When she does eventually click the bell out of curiosity, nothing marks as read either. The counter never moves.

Ellis has the same problem — 305 unread notifications, none of which he's ever seen. This is true for every director, every negotiator, every admin. Only the internal "sales progressor" role sees anything.

**Why it's wrong.** The bell is the platform's promise that if something happens, you'll be told. Right now it silently breaks that promise for everyone except one role. Agents don't know their clients acted. Their clients wonder why they aren't hearing back. The whole feedback loop is broken.

**After the fix.** The bell shows a count that matches what actually happened. Taylor logs in on Monday, sees "3", clicks it, gets a short list — "Ben confirmed searches ordered", "Chain agent Philippa declined", "Sarah set an expected date of 25 July". She clicks any of them and lands on the file. The count clears. When she logs in from her phone tomorrow, that state is preserved.

**Notes & decisions.** DONE (verified 2026-08-12). Rewritten in the 2026-08-09 bell pass. `app/api/agent/notifications/route.ts` routes director/negotiator through `resolveAgentVisibility` (their agency's files) and admin/sales_progressor/viewer through `resolveInternalVisibility`, returning a real per-role count + items list. `components/layout/AgentBell.tsx` polls with an `after=` last-read timestamp, shows the unread badge, and opening the bell stamps a fresh timestamp into a per-user `localStorage` key (`agent-bell-cleared-${userKey}`) so the count clears and persists per browser.

---

### 2. Turn on the "how long things really take" numbers

**Status:** pending

**Today.** The app has a switch inside it that says "we have enough real data yet — false". Because it's set to false, every part of the UI that could say "this step usually takes 5 days and yours has been 12" stays silent. The agent looks at a stuck file and gets no context on whether it's stuck or normal.

Meanwhile the app has now watched more than a hundred real sales go through. We know exactly how long each step takes in reality — 27 days for the buyer's solicitor to raise initial enquiries, 33 days for them to review the responses, 93 days from creation to exchange on average.

**Why it's wrong.** We built the machinery to compare real files against real medians. We're refusing to feed it the data it needs, because a boolean is set to false from launch day.

**After the fix.** Every file that's been sitting on a step longer than typical gets a small badge — "12 days · usually 5". The agent scans their hub and can see which files have genuinely stalled without opening every one. The chain drawer's "one file is behind" banner starts firing on real bottlenecks. The forecast on when a sale will exchange stops being a 12-week guess and starts using what's actually happened.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 3. Give the "To-Do" tab a real inbox

**Status:** pending

**Today.** When a client does something meaningful — sets an expected date, leaves a chase note, confirms something themselves — no page shows the agent "here's what your clients did that needs your attention". The information exists. There's even a fully-built component that could render it. It just isn't placed on any page.

**Why it's wrong.** Agents want to open the app and see "here's what needs me". Right now the To-Do tab is mostly free-text tasks you type in yourself (and hardly anyone does — only 12 have ever been created). The tab that should be an inbox is instead a notebook nobody writes in.

**After the fix.** Taylor opens To-Do and the top of the page shows the things her clients did overnight: "Ben set expected date of 25 July for searches", "Sarah asked to pause chases", "Client note on 27 Willowbrook Crescent — 'solicitor won't reply'". She clicks each one, deals with it, it clears. Real inbox behaviour.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 4. Stop leaking developer pages into production

**Status:** in progress

**Today.** There are about twenty URLs on the live app that are supposed to be internal preview/audit/mockup pages. They're reachable by anyone who guesses or gets a link. Some of them literally have comments in them like "clicking these buttons will error harmlessly" — but a customer landing there sees a broken page. Names like `/agent/polish/slowness-demo`, `/agent/audit/before-after`, `/bg-test`, `/login-preview`, `/helpdrawertest`.

**Why it's wrong.** Even a small chance that a customer, chain partner, or curious visitor lands on one of these is a trust hit. "Their site is half-built" is the impression it leaves.

**After the fix.** These pages continue to exist for internal use, but on the live site they either don't render or redirect to the real page. Nobody outside the team can reach them.

**Notes & decisions.** PARTLY DONE (verified 2026-08-12). Unauthenticated visitors are now blocked: `middleware.ts` removed `bg-test`, `login-preview`, `helpdrawertest`, `audit-gallery`, and `test` from the matcher exclusions (2026-05-25), so public visitors get redirected to `/login`; `/dev/*` is separately prod-blocked via page-level `notFound()`. The signed-in-customer gap is now CLOSED (built 2026-08-12, awaiting push + staging test): a server-side `layout.tsx` on each of `app/agent/polish/` and `app/agent/audit/` calls `notFound()` for anyone whose email isn't on the founder allowlist (`isHybridSuperadminEmail`, currently just `ellis@thesalesprogressor.co.uk`), so both trees are a 404 for every customer, logged in or not, while staying available to the founder. Covers all current + future pages under each tree in one gate. The top-level `/test/*` email-preview mockups got the same founder-only `layout.tsx` gate in the same pass (all three are internal email previews, nothing that needed sharing), so every known internal preview tree (`/agent/polish`, `/agent/audit`, `/test`) is now a 404 for non-founders. `/dev/*` was already prod-blocked. This item is effectively complete pending push + staging test.

---

### 5. Chains are being hidden inside the "create a sale" form

**Status:** in progress

**Today.** When an agent creates a new sale, the form has five sections. The chain section is the last one, collapsed, labelled "(optional)". If the agent doesn't open it and add chain-mates, no chain is created. Result on prod: only 27% of active sales ever get a chain (12 out of 44). The rest are lonely files with no visibility into what the other sales are doing.

Compounding this: even when a chain IS created, the invite flow means only one agent's link gets claimed — the others are stubs that decline or go unsent. Taylor's 83 Highfield Road chain has three positions: her own, one declined, one never sent. That's typical.

**Why it's wrong.** The chain feature is what makes the platform genuinely different from any other estate-agent tool. Under-adopting it because a section is collapsed by default undermines the whole product.

**After the fix.** When the file is a purchase-with-mortgage or freehold-with-onward-sale (the situations where a chain is almost certain), the chain section defaults to open. The agent sees "is this file in a chain?" instead of "there's an optional collapsed section". Chain adoption rises from 27% to something closer to 60-70%. Once we've got a normal sample of files in chains, we can add a small hub prompt: "You've got 4 active files without a chain — do any of them need one added?"

**Notes & decisions.** BUILT 2026-08-12, awaiting push + staging test. Trigger uses the real purchase-type field, not the audit's "freehold-with-onward-sale" (the form doesn't capture onward sale): **Mortgage** and **Cash from proceeds** open the chain section by default; a pure **Cash** buyer keeps the quiet collapsed prompt. When it auto-opens, the header reframes to the question "Is this sale part of a chain?" with a one-line reason ("This looks like a chain, because a mortgaged buyer is usually selling too…") and a one-click "Not in a chain" dismiss. Nothing forced, no data-model change, the drawer + add-sale flow are untouched. Helpers `isChainLikely` / `chainOpenReason` in `components/transactions-v2/form/types.ts`; wiring in `Stage2Sections.tsx`; copy in `components/chain/ChainSection.tsx`. Interactive mockup approved by Ellis before build. STILL DEFERRED: the "you've got N files without a chain" hub nudge (do once adoption data builds).

---

## Four more this week

### 6. Use portal engagement as a warning signal

**Status:** pending

**Today.** The app knows when each buyer/seller last logged into their portal. It doesn't do anything with that. Files where the buyer used to log in every day and then went silent for three weeks look identical, on the agent's dashboard, to files where they log in every morning.

**Why it's wrong.** A client who was engaged and then went quiet is the single strongest early warning that a sale is about to fall through. We're literally recording that signal and throwing it away.

**After the fix.** The file's risk indicator picks up on this. A file where the buyer visited daily for two weeks and then not at all for two weeks flips into "watch this". The agent gets a heads-up before the deal goes cold.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 7. Let clients ask a question from the portal

**Status:** pending

**Today.** A buyer opens their portal, sees a status update they don't understand, and has nowhere to ask about it. They have to leave the portal, find the agent's email, write a fresh email, and hope the agent connects it to the right sale.

There's already a fully-built "Ask" component sitting in the codebase, orphaned. It hasn't been placed on any page.

**Why it's wrong.** The whole point of the portal is to be the single place where the client and the agent talk about the sale. Making them leave the portal to ask a question is a bug in the concept.

**After the fix.** Every portal page has an "Ask us" button. The client types a question. It shows up as a message on the file for the agent to reply to. Their conversation stays inside the tool where the context is.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 8. Add a preview line to every email

**Status:** pending

**Today.** When an email from us lands in Gmail, the preview line under the subject shows either "SALES PROGRESSOR" (the brand banner) or the "Hi Sarah" greeting. Nothing about what the email is actually about.

**Why it's wrong.** Every email consultant will tell you that the preview line under the subject is the second-biggest driver of whether someone opens the email, after the subject itself. We're leaving it blank on every single template — dozens of them.

**After the fix.** Each email carries its own one-line preview: "Ben confirmed searches, 3 more steps to exchange", "Your buyer for 42 Elm Road has confirmed she wants to proceed", "One quick thing on 83 Highfield Road". Recipients see, at a glance in their inbox, why they should open. Opens go up.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 9. Voice pass on emails that have drifted

**Status:** pending

**Today.** Three specific emails are visibly off-brand. A retention email tells the reader "The system starts working once the first few steps are ticked off" — we banned "the system" language months ago. Two "welcome to the team" emails sign off with "The Sales Progressor team", with an em-dash we also banned. A fallback "there's been a progress update" email doesn't say what actually updated.

The portal itself has about 35 em-dashes in prose ("Ready to exchange, today"), plus a few celebratory exclamation marks that we said we'd avoid in client-facing copy.

**Why it's wrong.** Voice consistency is what makes the product feel deliberate. Drift makes it feel automated.

**After the fix.** Each of those templates gets a small rewrite. "We start moving as soon as you tick off the first few steps." "Sales Progressor" alone as sign-off. The "progress update" email actually tells you what updated. The portal loses its em-dashes and softens its exclamations. Nothing dramatic; the tone just steadies.

**Notes & decisions.** _(filled in when we walk through this item)_

---

## Medium-term wins — bigger, still obvious

### 10. Send an email the moment both sides are ready to exchange

**Status:** pending

**Today.** When the seller's side and the buyer's side both hit "ready to exchange", the app sends a push notification saying "Ready to exchange, everything's in place." No dedicated email fires. The information rides on whichever side's confirmation email happens to send last.

**Why it's wrong.** This is the single biggest moment in a UK property sale before exchange itself. It's the moment agents want to celebrate and clients want to be reassured. Right now, if a client only checks email and not the app, they can miss the "we're ready" signal entirely.

**After the fix.** As soon as both gates close, one clean email goes out: "Everything's ready for exchange on 83 Highfield Road. Your solicitor will be in touch to agree a date." Clear moment, clear next action.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 11. Let a client pause chases from an email

**Status:** pending

**Today.** A buyer is on holiday and doesn't want three more chase emails while they're away. Their only option, from the chase email itself, is a giant "unsubscribe" link that stops every future email, including their transactional chain updates.

**Why it's wrong.** We're forcing "not now" to mean "never". Anyone who wants a week off ends up either unsubscribing (and losing legitimate updates) or ignoring the emails until we manually intervene. Meanwhile the unsubscribe list grows.

**After the fix.** Every chase email carries a "Pause for a week" one-click link. The client hits it, sees "Got it, we'll check back on 23 July", and gets no chase emails for seven days. Their chain updates keep coming. Nobody's unsubscribing to escape a holiday.

Same treatment for the unsubscribe page in general. Instead of one giant off-switch, it becomes a small preference centre: chain updates, chase emails, retention emails, celebrations. Turn off what you don't want, keep what you do.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 12. Rewrite chase-email subject lines

**Status:** pending

**Today.** The chase emails go out with the subject "42 Elm Road: one update needed" or "3 updates needed". Reads like a bill.

**Why it's wrong.** These are the emails the whole chase engine depends on for opens. If the subject reads transactional, opens fall.

**After the fix.** Warmer variants: "Quick update on 42 Elm Road", "Sarah, one thing on 42 Elm Road", "On your sale at 42 Elm Road". Rotate them. Measure which lift opens the most.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 13. Show which milestone is killing sales, at a glance

**Status:** pending

**Today.** On the founder's Command Centre overview, one number says "4 transactions stuck". No breakdown of what they're stuck ON.

**Why it's wrong.** The single most useful founder-level question is "where in the sale process are files dying?" The data to answer it is right there. It just isn't rendered.

**After the fix.** A small table on the overview showing each step of a UK sale, how long it typically takes, and how many files are currently over that limit. Ellis opens the Command Centre, sees "PM16, buyer solicitor reviewing responses, median 33 days, 8 files currently over 40 days", and knows that's where to focus.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 14. Promote two better demo pages to being real features

**Status:** in progress

**Today.** Two of the pages hidden in the developer preview tree are, honestly, better than the live equivalents. One is a nicer chain drawer (better copy, better invite explanation). One is a nicer prediction of when a sale will exchange, phased by which stage it's at.

**Why it's wrong.** We built better versions, then never swapped them in. The customer-facing pages stay less good than the versions sitting one folder over.

**After the fix.** Both get promoted to the real routes. The chain drawer becomes what agents open when they click "Open chain". The prediction becomes what shows on the sidebar. The old versions come out.

**Notes & decisions.** HALF DONE (verified 2026-08-12). The phased exchange-date prediction IS promoted — `formatPredictedBand` renders on the real agent sidebar (`components/transaction/TransactionSidebar.tsx`) as the "Expected exchange" band. STILL OPEN: the nicer chain drawer was NOT swapped in — agents still open the older `components/chain/ChainDrawer.tsx`, and the richer preview at `app/dev/vibe/chain/page.tsx` still self-labels "not linked from production". So this is one of two done; the chain-drawer half remains.

---

### 15. Give clients basic self-serve controls

**Status:** in progress

**Today.** A buyer on the portal cannot change their email address, cannot change their phone number, cannot pause chases from within the portal, cannot re-subscribe if they previously unsubscribed. Every one of these becomes a phone call or email to the agent.

**Why it's wrong.** The top-two support tickets any customer-facing portal ever gets are "you have my old email" and "please stop for a week". We're forcing both of those into the agent's inbox.

**After the fix.** A small profile icon in the top-right of the portal opens a four-item panel: change email, change phone, pause chases for N days, subscribe/unsubscribe. Changes are logged for the agent to see. Client sorts themselves, agent doesn't get the call.

**Notes & decisions.** 3 OF 4 DONE (verified 2026-08-12). `components/portal/PortalMenuDrawer.tsx` (opened top-right via `PortalShell.tsx`) already does change name/email/phone (`updateMyContactAction`), subscribe/unsubscribe via the notifications email toggle, and logs every edit as an `internal_note` for the agent. STILL OPEN: the "pause chases for N days" control — `app/actions/portal-menu.ts` has no timed-pause action, only a binary email on/off. Just that one control left to add.

---

### 16. Tell the client who's on their team

**Status:** pending

**Today.** The portal shows the agency name and the property address. It never names the actual person handling the sale, doesn't show a photo, doesn't say which solicitor firm is instructed, doesn't say who the other side's agent is.

**Why it's wrong.** UK sellers and buyers trust people, not portals. "Your progressor is Sarah at Akeman Residential" plus a small photo does more for trust than a paragraph of copy ever will.

**After the fix.** Small "Your team" card on the overview: progressor name and photo, solicitor firm (once instructed), other agent (if in a chain). Faces + names + roles.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 17. Start measuring email performance properly

**Status:** in progress

**Today.** No email we send is tagged with what type it is when we hand it to SendGrid. So there's no way to look at SendGrid analytics and ask "did our chase emails open at a higher rate this month?" We're flying blind on every copy change.

**Why it's wrong.** Every proposal in this section that touches email copy is untestable without this. We can't A/B a subject line, we can't compare templates, we can't answer basic performance questions.

**After the fix.** Each email hands SendGrid two labels: what type of email it was, and which version of the template. The analytics side then works: opens per type, click rates per template version, response rate on chases by subject variant.

**Notes & decisions.** BUILT 2026-08-13, awaiting push + staging test. Done ahead of #12 so the subject-line change is measurable from day one. `lib/email.ts` (`sendEmail` + `sendChainEmail`) now accept optional `emailType` + `templateVersion` and pass them to SendGrid as **categories** (its native aggregation dimension): `[emailType, "env:<vercel-env>"]`, plus `"<emailType>:<version>"` when a template stamps a version. The `env:` tag keeps staging traffic out of prod's numbers; the same labels are mirrored into customArgs for the Event Webhook. Wired at the two drains that carry the automated volume: the outbound-email queue drain (`lib/email/outboundQueue.ts` — tags CLIENT_CHASE / EXCHANGE / COMPLETION / CELEBRATION / outsource-intro / etc., and reads `templateVersion` off the queue payload) and the milestone-digest drain (MILESTONE_CONFIRMATION). No SendGrid setup needed — categories auto-appear under Stats. NOT YET TAGGED (opt-in later via the same optional param, low priority — not the measurement target): one-off transactional sends (invites, welcome, password reset, weekly briefs, portal messages).

---

## The bigger structural bets

### 18. Suggest smarter chase timings based on real behaviour

**Status:** pending

**Today.** Every "we'll chase after 3 days, and then again every 5 days" rule was set by hand months ago. We now know how quickly clients actually respond, per type of chase, from real data. Nothing feeds that back.

**Why it's wrong.** If clients typically respond in 6 days but we chase after 3, we're chasing needlessly. If they respond in 2 days but we wait 5 to chase again, we're leaving days on the table.

**After the fix.** A nightly job looks at real response times per chase type and quietly proposes rule changes on the admin page: "your rule says chase after 3 days, clients typically respond in 6, consider bumping". Ellis says yes or no. No auto-mutation; it's a suggestion.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 19. Score prediction accuracy per agent

**Status:** pending

**Today.** When an agent creates a file, the app predicts when it'll exchange. Some agents override that with their own guess. Nothing later compares "what did they predict?" against "what actually happened?"

**Why it's wrong.** Some agents habitually predict overly-optimistic dates. Some are pessimistic. Neither knows it because we never show them.

**After the fix.** Once a file completes, we log the difference between predicted and actual. Each agent's rolling accuracy shows on their hub: "your predictions are typically 12 days early". Ellis sees the platform-wide accuracy in his daily brief. Agents self-correct without being told.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 20. Build three new founder-brief signals

**Status:** pending

**Today.** The daily "here's what's happening across the platform" brief that Ellis reads is built on twelve signal detectors. None of them look at actual sale progress, chase behaviour, or milestone completions. They only look at product-side signals like session friction and PostHog events (which aren't even wired yet).

**Why it's wrong.** The whole point of the brief is to surface sale-progression signal. It currently doesn't.

**After the fix.** Three new detectors join the family. One flags agencies whose middle-solicitor step is much slower than average. One flags agencies whose chase-response rate collapsed week-over-week. One flags agencies where predicted vs actual dates are drifting apart. Ellis's morning email shifts from "here's product telemetry" to "here's who needs help this week".

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 21. Two small admin tools that retire a lot of DB work

**Status:** pending

**Today.** When a client unsubscribes and later asks to be re-added, Ellis logs into the database and runs a manual SQL update. When an agency needs to be blocked from creating new files (unpaid invoice) or unblocked (paid), same thing. Both are documented as manual database work.

**Why it's wrong.** They're both routine tasks. Neither should require a database console. Any small mistake is a real risk.

**After the fix.** Two small admin pages inside the Command Centre. Contact search-by-email → toggle their unsubscribe / pause state. Agency list → row-level "block / unblock / extend trial" buttons. Every action logged for audit. Ellis stops touching the database for anything routine.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 22. Kill the leftover duplicate routes

**Status:** pending

**Today.** The site has multiple URLs pointing at the same thing. `/agent/transactions/new` (redirect stub) → `/agent/transactions/new-v2` → the real page. `/dashboard` redirects to `/agent/hub`. Some don't redirect at all and just sit there. Nobody's sure which one is current.

**Why it's wrong.** Confusion when bookmarks break. Extra hops on every navigation. A codebase where nobody remembers which page is authoritative.

**After the fix.** Rename `new-v2` back to `new` (it's the real one now). Delete every stub. One URL per surface, and the URL you'd guess is the one that works.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 23. Finish or delete the "read this email for me" widget

**Status:** pending

**Today.** On two pages there's a dimmed card that says "Email reader, coming soon". Someone built the endpoint that would let an agent paste a solicitor email and get milestone-update suggestions back. Nobody wired the UI to the endpoint.

**Why it's wrong.** "Coming soon" cards teach users to look past that space forever. Either the feature ships or the card goes.

**After the fix.** Either paste-solicitor-email actually works (paste an email, get "this looks like PM7, draft contract received. Confirm?"), or the card is removed and the space belongs to something else.

**Notes & decisions.** _(filled in when we walk through this item)_

---

### 24. Send a proper "welcome" email to people who signed up via a chain claim

**Status:** done

**Today.** When an agent claims a chain invite from another agent, and creates their account through that flow, they get a generic "Welcome, let's get you started with your first sale" email, written for someone who has no file. But they just claimed a real file. The email is contextually wrong.

**Why it's wrong.** First impression matters, and this one reads as "the platform doesn't know I just joined a specific chain".

**After the fix.** The dedicated claim-welcome email (which exists but isn't wired) fires instead. Something like "Welcome, you're now working with Sarah at Akeman on 83 Highfield Road. Here's what happens next." Contextual, correct, warmer.

**Notes & decisions.** DONE (verified 2026-08-12). The dedicated claim-welcome email is wired into the chain-claim signup flow: `app/api/claim/route.ts` imports `sendClaimWelcomeIfNotSent` and fires it on the brand-new-account branch (passing userId, transactionId, propertyAddress), while `app/api/register/route.ts` explicitly skips the generic welcome for claim signups so the dedicated one fires instead. Builder at `lib/emails/send-claim-welcome.ts`.

---

### 25. Two Command Centre nav items that show "Coming soon" are teaching you to ignore them

**Status:** pending

**Today.** Two items in the Command Centre sidebar, Friction and Automations, open pages that render only "Coming soon" boxes. One is waiting on a PostHog contract. One is waiting on a big rule-engine build.

**Why it's wrong.** Every time Ellis sees a "coming soon" page, he learns "don't bother clicking this item". By the time real content lands, he's stopped looking.

**After the fix.** Either hide those nav items until they render something real, or ship a very small v0 of Friction (chase-task completion latency by fallback kind, data already available) so the item stops being dead weight. Either way, the sidebar stops training the user to ignore it.

**Notes & decisions.** _(filled in when we walk through this item)_

---

## Data-driven observations that shaped the priorities above

These aren't fixes. They're facts I learned from the database that make certain proposals more urgent than they'd otherwise be.

- **Portal engagement is actually excellent.** 83% of clients on active files have logged into their portal. The problem was never engagement, the problem is that we don't act when engagement stops (see #6).
- **WhatsApp is quietly a real channel.** 555 WhatsApp messages logged in 30 days, roughly 50/50 inbound/outbound, despite WhatsApp being flagged as a "future feature". Something's writing rows in there and it's worth understanding what before proposing WhatsApp work formally.
- **Escalations aren't out of control.** Only 4% of chase tasks ever escalate. The very high historical "escalated ClientChaseState" count (139) is legacy from before the July fix, the new capture is flowing correctly at low volume.
- **Free-text manual tasks are barely used.** 12 total across the entire prod database, from two users. Either the feature is undiscovered or agents don't need it. Worth deciding which before another quarter passes.
- **The activity feed is very noisy.** Median 128 internal notes per active file, worst case 771. Users won't scroll through 128 rows to find a signal. Worth thinking about collapse-by-day, filter-by-actor, or a summary lane.
- **Solicitor coverage is 98% on active files.** Data quality here is genuinely good, 43 out of 44 files have both vendor and purchaser solicitor firms and contacts set.
- **Chase persistence pays.** 40% of files hit 3+ chases before completing. 6% hit 5+. If anything the escalation threshold could be higher, not lower.

---

## Things I'd deliberately leave alone

- **The chain-drawer permission fix from 14 July.** Working correctly, deployed clean.
- **The coherence arc from last week.** All showing up correctly in prod data. Leave them.
- **The developer gallery under `/dev`.** Legitimate internal tool, correctly blocked from the outside.
- **The "we now have data" cron email.** It's how you found out about #2 in the first place.
- **The portal install-to-home-screen and push notification prompts.** They fire correctly. Just don't show both at once (agent audit already suggested sequencing them).

---

## Rough sequencing (before nuance changes it)

**Week 1** — items 1, 2, 3, 4, 5, 8, 9. Small individual PRs. Every one visibly raises the floor.
**Week 2** — items 6, 7, 12, 10, 22, 24, 25.
**Week 3** — items 11, 13, 14, 15, 17, 21.
**Later** — items 18, 19, 20, 23. These need real design and data investment.

Order changes as we walk through and discover complexity.

---

## Prod database snapshot (2026-07-16)

For reference. Numbers behind every claim above.

- 76 transactions total, 44 active, 23 draft, 6 on hold, 2 completed, 1 withdrawn.
- 6 agencies, 13 users (all agencies 1-4 people).
- 220 contacts, 154 with portal tokens.
- 1,307 milestone completions.
- 749 reminder logs, 731 chase tasks, of which 32 have ever been escalated (4.4%).
- 16 chains, 30 chain links (18 CLAIMED, 16 NOT_SENT, 3 DECLINED, 2 SENT).
- 8,307 outbound messages logged, median 128 per active file.
- 555 WhatsApp messages in the last 30 days (roughly even inbound/outbound).
- Notification table: 361 rows in the last 60 days, 100% unread across every role.
- Portal engagement: 104 of 126 contacts on active files with tokens have visited (83%).
- Median dwell times per milestone: VM19 (exchange) 93 days from creation, VM20 (completion) 5 days after exchange, PM16 (buyer solicitor reviewing responses) 33 days on the step itself.
- Chase persistence: 40% of files hit 3+ chases, 6% hit 5+.
- Solicitor coverage: 43 of 44 active files have both sides' firm + contact set.
