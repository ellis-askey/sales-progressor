# Marketing Site Audit — accuracy, opportunity, voice

**Audited:** 2026-05-30
**Scope:** Every page of `marketing-site/` against the salesprogressor app at HEAD of `staging`.
**Method:** Read each marketing page verbatim; mapped each claim to shipped feature evidence (file paths, cron schedules, env flags, `docs/active/*`). No site code or copy was changed. Every finding waits for explicit approval.

---

## TL;DR

**Verdict — does the site represent the product?** Mostly yes for shape (two tiers, milestone-driven progression, client portal, automated emails). But the site has three accuracy problems that need fixing before any paid traffic hits it: (a) the ProofStrip stats and agency badges and testimonials are placeholders presented as real, (b) the changelog is back-dated to 2024 for events that shipped in 2026 (or never shipped), (c) the FAQ describes the agent dashboard as "read-only" which is no longer true.

**Biggest accuracy gaps (one-liners):**
1. **ProofStrip stats** ("4,000+ sales since 2022, ~84 days avg, 94% completion") — no source, no paying customers per [CLAUDE.md](../../CLAUDE.md). Source code marks the testimonials `PLACEHOLDER` ([ProofStrip.tsx:5](../../../marketing-site/components/home/ProofStrip.tsx#L5)) but the stats and agency badges have no such marker and read as live claims.
2. **"Trusted by agencies including"** Akeman / Via / Oplah / Meldone — these read as customer logos. Confirm whether these are real customers; if not, this is the single most legally exposed claim on the site.
3. **Changelog dates** — every entry is dated 2024 / early 2025, but Package D (the access-scope helper that makes outsourced visibility work at all) didn't ship until 2026-05-03, and the marketing site itself wasn't built then. Some entries describe features that don't fully exist yet.
4. **Home FAQ #5** — "Agents have their own portal with a read-only view…" — directors and negotiators have full edit access to their agency's files today. This was true once. It's not now.
5. **"Pay on exchange"** as a present-tense business mechanic — Stripe accrual is wired; live charging on cards is **not** active yet (PR 6/7 blocked on pricing disclosure copy + live keys per [payments-build-plan.md](../active/payments-build-plan.md)). Today billing is operationally manual. The model claim is fine; if anyone reads "we charge on exchange" as "the system charges automatically today," that's not yet true.

**Most valuable missing features (the site doesn't mention them):**
- **AI chase drafting** ([app/api/ai/generate-chase/route.ts](../../app/api/ai/generate-chase/route.ts)) — six tones, email or WhatsApp channel, agent reviews and sends. Real differentiator. Completely absent from the site.
- **AI problem detection** ([lib/services/problem-detection.ts](../../lib/services/problem-detection.ts)) — 7 nightly detectors flag stuck files, the agent gets an explanation. Site shows a flagged item in a mockup but never explains the AI behind it.
- **Property chains across multiple files** ([lib/services/chains.ts](../../lib/services/chains.ts), [docs/chain-feature/](../chain-feature/)) — full chain notification arc on exchange/completion/withdrawal. The marketing site doesn't mention chain handling at all.
- **Land Registry price history on every file** (live, no auth) — useful, missing.
- **Weekly agent brief** (Monday 07:00 UTC), **morning digest**, **stuck-day-3 retention emails** — the cadence story (the founder shows up in inboxes proactively) is more interesting than the site lets on.
- **Solicitor directory + intel signals** (which firms drag, which are quick) — direct estate-agency pain. Absent.

**Three sharpest voice rewrites (full set in §6):**
- HOME / Software / row 1 body — **BEFORE:** "Status, days elapsed, task counts, pipeline value. Filterable, sortable, always current." **AFTER:** "Every live sale, who's doing what, how long it's been sitting. You stop opening five tabs to answer the director's morning question."
- HOME / Software / row 4 — **BEFORE:** "When you confirm a milestone, the right email goes to buyer, seller and agent. Personalised per recipient, in plain English. You don't write it." **AFTER:** "Tick a step done and the right email is already drafted and sent. To the buyer in their words. To the seller in theirs. The agent gets a one-liner. Nobody has to write the same update three times."
- HOME / TheChoice / self bullet — **BEFORE:** "Work queue surfaces which files need attention today" **AFTER:** "Every morning you open one screen and see the three files that need you today. Not forty."

---

## How to read this report

Every finding has: a number you can quote ("do 7, 12, 23"), the page, the type, a severity, the current verbatim text, and a recommendation. Severities:

- **🔴 High** — false claim, legal exposure, or directly contradicts shipped state. Fix before any paid traffic.
- **🟠 Medium** — misleading, stale, or voice that flattens the brand.
- **🟡 Low** — refinement, minor inaccuracy, opportunity.

Types: **stale**, **overclaim**, **missing**, **redundant**, **voice**.

---

## §1. Phase 1 reference — what the product actually does today

Treat this as the spine for §3 and §4. Full version in the supporting research; condensed here.

**Shipped & claimable (customer-facing):** Hub dashboard, files list, transaction detail, milestone engine (47 steps, bilateral pair gating, reconciliation), reminders engine + chase tasks, **AI chase drafting (6 tones, human sends)**, comms feed, to-do/manual-task threads, analytics page, completions view, solicitor directory + intel, partners, Land Registry price history, EPC (PARTIAL — see below), property chains across multiple files, account/profile/team, push notifications (portal side), welcome modal, help drawer, client portal (side-scoped milestones, progress page, updates timeline, respond, client self-confirm of permitted milestones, exchange + completion celebration screens), milestone-triggered client emails, weekly client check-in email (Sat 09:00), weekly agent brief (Mon 07:00), morning digest (weekdays 08:00, excludes negotiators), activation / stuck-day-3 / quiet-30d retention, **nightly AI problem detection**, chain notification email arc.

**Shipped internal-only (not a customer feature):** Internal dashboard for sales_progressor / admin / superadmin via Package D access scope ([lib/security/access-scope.ts](../../lib/security/access-scope.ts)). Command Centre. Weekly Opus insights. Content drafting. The marketing site must not claim these as customer features.

**Partial / flagged off / not live:**
- **New-sale v2** (MOS upload + AI extract) gated by `NEXT_PUBLIC_NEW_SALE_V2` — flag off.
- **EPC API** — credentials not set; silently returns null.
- **Stripe live charging on exchange** — accrual cron, invoice models, webhook handler all exist; card capture UI and live charging gated until pricing disclosure copy is supplied. **Live charging is not active.**
- **AI email parser** — disabled, returns 503.
- **Replicate FLUX** — token not set, image gen 500s.
- **PostHog** — key not provisioned, DPA pending.
- **Upstash rate limiting** — disabled by flag.
- **Google / Microsoft OAuth** — client IDs pending.
- **Client-chase cron** (gentle nudges to clients) — flag-gated off.
- **Onboarding tour** — deleted, throwaway.

**Not built:** Bulk chase, WhatsApp Business API (label only; agent copies text), SMS sending, two-way email sync, CRM integration (Reapit etc.), true threaded two-way portal messaging.

---

## §2. Site map & verbatim copy snapshot

For completeness — these are the surfaces audited and a one-line purpose for each. Verbatim copy quoted inline in §3.

| Route | Purpose | File |
|---|---|---|
| `/` | Home — hero + two-tier choice + software + service + portal + proof + pricing + FAQ + footer CTA | [app/page.tsx](../../../marketing-site/app/page.tsx) |
| `/how-it-works` | Stage-by-stage product walkthrough (8 steps) | [app/how-it-works/page.tsx](../../../marketing-site/app/how-it-works/page.tsx) |
| `/pricing` | Pricing detail + calculator + comparison + FAQ | [app/pricing/page.tsx](../../../marketing-site/app/pricing/page.tsx) |
| `/about` | Problem / what we built / vision / closing | [app/about/page.tsx](../../../marketing-site/app/about/page.tsx) |
| `/demo` | Demo booking form | [app/demo/page.tsx](../../../marketing-site/app/demo/page.tsx) |
| `/contact` | General enquiries form | [app/contact/page.tsx](../../../marketing-site/app/contact/page.tsx) |
| `/careers` | Open role + values + expression of interest form | [app/careers/page.tsx](../../../marketing-site/app/careers/page.tsx) |
| `/security` | Six sections: hosting, encryption, access, GDPR, payments, vuln disclosure | [app/security/page.tsx](../../../marketing-site/app/security/page.tsx) |
| `/changelog` | Eight back-dated entries 2024-04 to 2025-04 | [app/changelog/page.tsx](../../../marketing-site/app/changelog/page.tsx) |
| `/status` | Hard-coded "all systems operational" | [app/status/page.tsx](../../../marketing-site/app/status/page.tsx) |
| `/tour` | 302 → `/how-it-works` | [app/tour/page.tsx](../../../marketing-site/app/tour/page.tsx) |
| `/register` | 302 → `/demo` | [app/register/page.tsx](../../../marketing-site/app/register/page.tsx) |
| `/terms`, `/privacy` | Boilerplate; not audited for accuracy in this pass | — |

Nav: How it works, Pricing, About + Log in + Book a demo.
Footer columns: Product (How it works / Pricing / Changelog / Book a demo), Company (About / Careers / Contact), Legal (Terms / Privacy / Security).

---

## §3. Findings — page by page

### 3.1 Root metadata + Nav + Footer

**1. 🟡 voice — root metadata description has em dash and is matter-of-fact.**
Current ([app/layout.tsx:21](../../../marketing-site/app/layout.tsx#L21)): *"Give every sale a system. From offer accepted to keys in hand — structured progression, automated client updates, and real-time agent visibility."*
Recommend: *"Give every sale a system. From offer accepted to keys in hand. Structured steps, automatic client updates, agents in the picture without having to ask."* (Removes em dash, removes "structured progression" jargon, softens to estate-agent ear.)

**2. 🟡 voice — Footer tagline.**
Current ([Footer.tsx:66](../../../marketing-site/components/layout/Footer.tsx#L66)): *"Property transaction management for estate agencies. From offer accepted to keys in hand."*
Recommend: *"Sales progression for estate agencies. From offer accepted to keys in hand."* ("Property transaction management" is consultancy-speak; "sales progression" is what they call it in the office.)

---

### 3.2 Home — Hero ([Hero.tsx](../../../marketing-site/components/home/Hero.tsx))

**3. 🟢 keep — Headline.**
*"The silence ends at offer accepted."* — strong, customer-centric, voice-aligned. No change.

**4. 🟠 voice + 🟡 overclaim risk — Hero body.**
Current ([Hero.tsx:348](../../../marketing-site/components/home/Hero.tsx#L348)): *"A structured system for every transaction. Milestones tracked, clients updated automatically, agents in the picture without having to ask. Choose whether your team progresses each sale or hand it to ours. Pay on exchange."*
Issues: "transaction" / "milestones" violate VOICE_GUIDELINES translation table (use "sale" and "step"). "Pay on exchange" stated as a present mechanic — fine as positioning, but the system isn't actually charging cards yet (see #5 below).
Recommend: *"Every sale gets a structure. Steps tracked, clients told automatically, agents in the picture without having to ask. Choose whether your team handles each sale or ours does. Pay only when it exchanges."*

**5. 🟠 overclaim (positioning vs system) — "Pay on exchange" used four times across home page as system promise.**
Phase 1 confirmed Stripe live charging is gated on PR 6/7 + pricing disclosure copy. The intent is right, the model is right, but if the site is read as "the platform automatically charges on exchange today," that's not yet true. Lower-risk framing while you finish PR 6/7: keep "pay on exchange" as model, drop any implication that charging happens automatically inside the app today.
Action: agree positioning. If live charging is shipping imminently, leave as-is. If it's >4 weeks out, soften from "charged on exchange" to "invoiced on exchange" anywhere it implies system behaviour.

**6. 🟢 keep — Hero illustration labels.**
"£59 · You progress" / "From £250 · We progress" / "Your client's view, either way" — accurate, well-framed.

**7. 🟢 keep — Hero proof points.**
"No contracts · Pay on exchange · Your team or ours" — accurate, sharp.

---

### 3.3 Home — TheChoice ([TheChoice.tsx](../../../marketing-site/components/home/TheChoice.tsx))

**8. 🟢 keep — Section headline.**
*"Every sale, your call."* — voice-aligned. No change.

**9. 🟠 voice — self-tier bullet #2.**
Current ([TheChoice.tsx:8](../../../marketing-site/components/home/TheChoice.tsx#L8)): *"Milestone tracking across vendor and purchaser sides of every transaction"*
Recommend: *"Both sides of the sale tracked side by side, vendor and purchaser."*

**10. 🟠 voice — self-tier bullet #4 (Rule 1 violation: system self-reference).**
Current: *"Work queue surfaces which files need attention today"*
Recommend: *"Every morning, the three files that need you today are at the top. Not forty."*

**11. 🟡 voice — self-tier bullet #5.**
Current: *"Agent dashboard keeps everyone in the picture without calls"*
Recommend: *"Directors and negotiators can see where every sale stands without picking up the phone."*

**12. 🟢 keep — outsource bullet "Your team isn't pulled off viewings to chase solicitors."** Strong voice; pure customer-pain. Keep.

**13. 🟡 voice — outsource bullet #1.**
Current: *"Our in-house progression team handles the sale end-to-end"*
Recommend: *"Our progression team handles the file. Instruction to exchange."*

**14. 🟠 stale/redundant — "Either way you get" — Live agent dashboard.**
Current ([TheChoice.tsx:190](../../../marketing-site/components/home/TheChoice.tsx#L190)): *"Every file, every status, exchange forecast. Agents have the information when they need it, not just when someone picks up the phone."*
"Exchange forecast" reads as if there's a calculated predictive model. There isn't — there's an "exchanging soon" widget driven off the set exchange date. Same wording appears in /how-it-works step 6 ("a forecast of when exchanges are likely").
Recommend: drop "exchange forecast", replace with: *"Every file, every status, what's coming up this month. Agents have the information when they need it, not just when someone picks up the phone."*

**15. 🟢 keep — "Automated client updates" card.** Accurate. Pleasant voice.

**16. 🟢 keep — "Client portal, no app required" card.** Accurate.

**17. 🟡 missing — "Either way you get" doesn't mention chain handling.**
Property chains across multiple files is a real shipped differentiator and one of the harder features. Worth adding a fifth card: *"Chains, end to end / Linked sales talk to each other. When one party exchanges, the rest of the chain finds out the same day."* (Cross-ref [lib/services/chains.ts](../../lib/services/chains.ts).)

---

### 3.4 Home — SoftwareSection ([SoftwareSection.tsx](../../../marketing-site/components/home/SoftwareSection.tsx))

**18. 🟢 keep — Headline.**
*"A system where there was only a spreadsheet."* — sharp, brand-aligned. No change.

**19. 🟠 voice — Section body.**
Current ([SoftwareSection.tsx:178](../../../marketing-site/components/home/SoftwareSection.tsx#L178)): *"Every live sale in one place. Every chase logged. Every client automatically updated the moment something moves."*
Already good but flatter than the headline. Slight lift:
Recommend: *"Every live sale in one place. Every chase recorded. Every client told the moment something moves, without you having to write the email."*

**20. 🟠 voice — Feature row 1 body.**
Current: *"Status, days elapsed, task counts, pipeline value. Filterable, sortable, always current."*
Recommend: *"See every live sale at once. Who's doing what, how long it's been sitting, what the pipeline's worth this month. The answer is there before the director asks."*

**21. 🟠 voice — Feature row 2 title and body.**
Current: *"Milestone tracking, vendor and purchaser"* / *"Two parallel milestone chains per transaction. Confirm, reverse, or mark not-required. Dates captured for time-sensitive steps."*
Recommend title: *"Both sides of the sale, side by side"*
Recommend body: *"Vendor and purchaser tracked separately, the way conveyancing actually works. Tick a step done. Untick if it falls back. Skip the ones that don't apply. The record stays right, even when the sale doesn't behave."*
("Milestone chains per transaction" is the single most schema-coded phrase on the site.)

**22. 🟢 keep — Feature row 3 (work queue).** Accurate. Voice fine.

**23. 🟠 voice — Feature row 4 body.**
Current ([SoftwareSection.tsx:201](../../../marketing-site/components/home/SoftwareSection.tsx#L201)): *"When you confirm a milestone, the right email goes to buyer, seller and agent. Personalised per recipient, in plain English. You don't write it."*
Recommend: *"Tick a step done and the right email is already drafted and sent. To the buyer in their words. To the seller in theirs. The agent gets a one-liner. Nobody has to write the same update three times."*

**24. 🔴 missing — AI chase drafting (six tones).**
This is one of the strongest differentiators in the product and the marketing site doesn't mention it. The user reviews and clicks Send (so framing must be honest), but the drafting is real and lifts the chase quality dramatically. Cross-ref [app/api/ai/generate-chase/route.ts](../../app/api/ai/generate-chase/route.ts).
Recommend: add a fifth FeatureRow:
*"Chases drafted for you / When a solicitor's gone quiet, the chase is already written in six tones — firm, friendly, formal, escalation, whichever you want. You read it. You send it."*

**25. 🟠 missing — Problem detection (nightly).**
Seven detectors flag stuck files automatically and the agent gets a plain-English explanation. The AdminMockup in the section actually shows "Chase" badges, which implies this — but the copy never names it. Cross-ref [lib/services/problem-detection.ts](../../lib/services/problem-detection.ts), [/api/cron/detect-problems](../../app/api/cron/detect-problems/route.ts).
Recommend: small line in the section intro or a new FeatureRow:
*"The stuck files surface themselves / Every night, the system looks across every live sale and flags the ones drifting. You get the flag and the reason — 'no contact in 9 days', 'mortgage offer overdue' — first thing in the morning."*

---

### 3.5 Home — ServiceSection ([ServiceSection.tsx](../../../marketing-site/components/home/ServiceSection.tsx))

**26. 🟢 keep — Headline.** *"Hand it over. Stay in the picture."* — excellent.

**27. 🟢 keep — Process step 1, 2, 3.** Accurate. Voice fine. Slight nit on step 2 "logs every contact" — confirm whether comms log captures phone calls reliably or whether progressors still need to add notes manually. If manual, soften to "every contact recorded against the file" (passive but truer).

**28. 🟠 overclaim risk — Process step 4 — "Exchange happens. You pay."**
Current ([ServiceSection.tsx:191](../../../marketing-site/components/home/ServiceSection.tsx#L191)): *"Charged on exchange only: £250, £300, or £350 depending on the sale price band. Nothing up front."*
Same flag as #5 — Stripe live charging not active yet. If you intend to soft-launch outsourced without auto-charge, fine; just be aware the customer will expect a card-on-file flow that doesn't exist yet.

**29. 🟡 voice — Process step 2 body.**
Current: *"Our team chases, logs every contact, updates the milestone record, and sends automated updates to your buyers and sellers."*
Recommend: *"Our team chases solicitors, brokers, surveyors, everyone. Every call is on the file. Buyers and sellers get the updates automatically. You don't have to think about it."*

---

### 3.6 Home — PortalSection ([PortalSection.tsx](../../../marketing-site/components/home/PortalSection.tsx))

**30. 🟢 keep — Headline.** *"'No news is good news' is not good enough."* — best line on the site. Keep.

**31. 🟢 keep — Body.** Accurate and well-written.

**32. 🟢 keep — All four cards.** All four claims map to shipped features (portal page, next-step display, milestone emails per recipient, exchange/completion celebration). Voice is good.

**33. 🟡 missing — Client self-confirms certain steps.**
Buyers/sellers can tick available milestones on their own side (`portalCompleteMilestone` in [lib/services/portal.ts](../../lib/services/portal.ts)). That's unusual in this category. Worth a fifth card:
*"They can move it forward themselves / When their solicitor's done a thing the client knows about, the client can tick it off. The agent and our team see it instantly. Fewer phone calls about 'has X happened yet'."*

**34. 🟡 voice — Mobile-optimised body line.**
Current: *"Your buyers and sellers get a mobile-optimised portal showing exactly where their sale is, what's happening now, and what's coming next. No app download. No account creation. A link in their welcome email."*
Already serviceable. If lifting: *"Your buyers and sellers tap a link in their welcome email and see exactly where their sale is. What's happening now. What's next. No app to download. No password to remember."*

---

### 3.7 Home — ProofStrip ([ProofStrip.tsx](../../../marketing-site/components/home/ProofStrip.tsx)) — **highest-risk section on the site**

**35. 🔴 overclaim — Stats are unsourced and unverifiable.**
Current ([ProofStrip.tsx:7](../../../marketing-site/components/home/ProofStrip.tsx#L7)):
- "4,000+ Sales progressed since 2022"
- "~84 days Avg. days to exchange"
- "94% Completion rate"
Caption: *"Combined figures across sales progressed by our team since 2022."*
[CLAUDE.md](../../CLAUDE.md) states the current stage is pre-launch, ~5 test users, no paying customers. If these figures come from the founder's prior estate-agency / outsourced-progression business, that needs to be sourced and the phrasing needs to make clear it's prior-business data, not platform data.
Action: either remove until verifiable, or rephrase to make the source explicit, e.g. *"Across our team's progression work in UK estate agencies — combined since 2022."* And keep an evidence note for each figure in case challenged.

**36. 🔴 overclaim — Agency logo badges read as customer logos.**
Current: Akeman Residential / Via Properties / Oplah Estate Agents / Meldone Estates under header *"Trusted by agencies including"*.
If any of these are not live paying customers of Sales Progressor today, this is a false endorsement claim. Single biggest legal exposure on the site.
Action: confirm each is a real customer with their permission to display their name. Otherwise remove the entire block until launch customers are signed.

**37. 🔴 overclaim — Testimonials are marked PLACEHOLDER in source.**
Source comment ([ProofStrip.tsx:5](../../../marketing-site/components/home/ProofStrip.tsx#L5)): *"PLACEHOLDER — testimonials to be replaced with verified quotes before launch"*. The site is live or will be soon. Three made-up quotes attributed to "Director / Branch Manager" with initials shipping to production is the kind of thing that gets screenshotted.
Action: hide the entire TestimonialCarousel until at least one real quote is in hand. Or move to /demo "what early users say" once real users exist.

---

### 3.8 Home — PricingPreview ([PricingPreview.tsx](../../../marketing-site/components/home/PricingPreview.tsx))

**38. 🟢 keep — Headline.** *"Pay on exchange. Nothing else."* — sharp. (Subject to #5 framing.)

**39. 🟢 keep — Tier cards and feature lists.** Accurate.

**40. 🟡 redundant — Pricing on home and full pricing page repeat almost word-for-word.**
The home PricingPreview, the full /pricing tier cards, and the home TheChoice tier blocks all say roughly the same things three times. Consider letting home stay punchy (just the two prices + CTAs) and pushing the feature lists to /pricing only.

---

### 3.9 Home — FAQ ([FAQ.tsx](../../../marketing-site/components/home/FAQ.tsx))

**41. 🟢 keep — Q1, Q2, Q3, Q4.** Accurate, brand voice fine.

**42. 🔴 stale — Q5 "Can our agents see everything the progressor sees?"**
Current ([FAQ.tsx:25](../../../marketing-site/components/home/FAQ.tsx#L25)): *"Agents have their own portal with a read-only view of all milestone progress, contacts, reminders, and risk indicators on their transactions. They can raise requests to the progressor directly from within the app. Directors see all agency files; negotiators see only their own."*
Wrong on two counts: (a) directors and negotiators do not have a "portal" — they use the agent app at `/agent/*`; (b) the view is **not read-only** — they have full edit access including milestone confirmation, comms creation, reminder management. The read-only model was an early plan that was dropped.
Recommend: *"Yes. Directors and negotiators log in to the same agent app and can see and edit every file in their agency — milestones, contacts, chases, reminders, the flagged problems. If something needs progressing, they can raise it directly with the progressor. Directors see every file in the agency. Negotiators see only their own files."*

**43. 🟠 voice — Q6 "What do clients actually see?"** Accurate but reads like a feature inventory. Voice opportunity:
Current: *"…a progress ring, their next step, a plain-English timeline of confirmed milestones, and rotating tips relevant to their current stage. On exchange: a celebration banner with confetti. On completion: a second one."*
Recommend: *"…a progress ring, the next step in plain English, and a timeline of what's been done so far. Tips appear that match where they are now, not generic 'how moving works'. When exchange happens, the screen erupts in confetti. Same again on completion. For a lot of buyers, those are the first moments the move actually feels real."*

**44. 🟢 keep — Q7 (automated emails) and Q8 (setup fee).** Accurate.

---

### 3.10 Home — FooterCTA ([FooterCTA.tsx](../../../marketing-site/components/home/FooterCTA.tsx))

**45. 🟢 keep — Headline + body + buttons + bottom strip.** Voice fine. *"No pitch deck, no pressure. Just a conversation about how it fits."* is correctly calibrated for senior estate agency directors.

---

### 3.11 /how-it-works ([app/how-it-works/page.tsx](../../../marketing-site/app/how-it-works/page.tsx))

**46. 🟢 keep — Page header.** *"From offer accepted to keys in hand."* and subhead are well-pitched.

**47. 🟢 keep — Step 1 (Setup), Step 3 (Emails), Step 4 (Portal), Step 5 (Work queue), Step 7 (Exchange), Step 8 (Completion).** All map cleanly to shipped behaviour. Voice on steps 3, 7, 8 is some of the best on the site.

**48. 🟠 voice — Step 2 body.**
Current ([page.tsx:313](../../../marketing-site/app/how-it-works/page.tsx#L313)): *"Every sale follows two parallel chains: one for the vendor side, one for the purchaser. Confirm steps as they happen. Reverse one if something falls back. Mark as not-required where the sale differs from usual. The record stays accurate, even when things change."*
"Parallel chains" — even in marketing the word "chain" is going to confuse readers because property chains is a separate concept. The step UI here is good; copy needs a tweak.
Recommend: *"Every sale has two tracks: the vendor side and the purchaser side. Tick steps as they happen. Untick if something falls back. Skip the ones that don't apply. The record stays right, even when the sale doesn't behave."*

**49. 🟠 stale/overclaim — Step 6 body — "forecast" (same as #14).**
Current: *"…they can see every live transaction, how long each has been running, and a forecast of when exchanges are likely…"*
Recommend: *"…they can see every live sale, how long each has been running, and which ones are heading for exchange this month. Full step detail is a click away. If something needs chasing, they can raise it with the progressor without leaving the app."*

**50. 🟡 missing — How-it-works is the natural home for the AI chase drafting story.**
Add a step (or a sub-note on Step 5) that explains: when a chase is needed, the message is already drafted in the tone the agent picks; the agent reviews and sends. Most prospects don't know this kind of AI assistance exists in sales progression yet — it's a genuine differentiator and this page should not hide it.

**51. 🟡 missing — How-it-works doesn't show problem detection / morning brief.**
A clean addition between Step 5 and Step 6: every morning a digest lands in the inbox naming the files that drifted overnight (or aren't drifting). [/api/cron/morning-digest](../../app/api/cron/morning-digest/route.ts) + [/api/cron/agent-weekly-brief](../../app/api/cron/agent-weekly-brief/route.ts). This is the "you don't have to remember everything" pitch.

**52. 🟡 redundant — How-it-works bottom CTA stats (412 active files / 84 days / 74 exchanges).**
These are decorative product-screenshot numbers but presented in a stats-style block right before a CTA. Soften the framing or add a caption ("Illustrative — your numbers will look different") so it doesn't compound with the ProofStrip overclaim issue.

---

### 3.12 /pricing ([app/pricing/page.tsx](../../../marketing-site/app/pricing/page.tsx))

**53. 🟢 keep — Header, tier cards, feature lists, fine-print line about fall-throughs.** Accurate.

**54. 🟡 voice — Self-progress feature list (11 items).**
List is comprehensive but inventory-flat. Single voice lift example:
Current ([page.tsx:13](../../../marketing-site/app/pricing/page.tsx#L13)): *"Reminders triggered by milestone completions and elapsed time"*
Recommend: *"Reminders that fire when a step finishes, or when something's been sitting too long"*

**55. 🟢 keep — Calculator.** Useful, accurate.

**56. 🟠 voice — Comparison column "Status quo" item.**
Current ([page.tsx:208](../../../marketing-site/app/pricing/page.tsx#L208)): *"Fall-throughs noticed late, often avoidable"*
Sharper: *"Fall-throughs that nobody saw coming"*

**57. 🟢 keep — Pricing FAQ.** All six answers accurate.

---

### 3.13 /about ([app/about/page.tsx](../../../marketing-site/app/about/page.tsx))

**58. 🟢 keep — Entire page.** This is the strongest-written page on the site. The voice already lands ("Sales take longer than they should… nobody's holding the whole picture", "It's not complicated. It's what estate agencies have been asking for and never quite got"). No accuracy issues.

**59. 🟡 voice — One refinement.**
Current ([page.tsx:215](../../../marketing-site/app/about/page.tsx#L215)): *"Most of what slows sales down isn't legal complexity. It's information not reaching the people who need it."*
Already strong. If polishing: *"Most of what slows a sale down isn't the legal work. It's the information not reaching the people who need it."*

---

### 3.14 /demo and /contact

**60. 🟢 keep — Both pages.** Copy is well-pitched, forms are minimal, response-time promise on /contact is honest ("Usually within one business day").

---

### 3.15 /careers ([app/careers/page.tsx](../../../marketing-site/app/careers/page.tsx))

**61. 🟢 keep — Values + open role framing.** "Building talent pool" badge is honest. Role description matches what an outsourced progressor would do per Phase 1.

**62. 🟡 voice — Values "Small team, real ownership" body.**
Current: *"Everyone who works here owns a meaningful part of what we do. No layers, no approval chains. If you see something that needs fixing, you fix it."*
Already good; minor: *"Everyone here owns a piece of what we do. No layers. No approval chains. If something needs fixing, you fix it."*

---

### 3.16 /security ([app/security/page.tsx](../../../marketing-site/app/security/page.tsx))

**63. 🟠 overclaim risk — "Data hosting" + "Encryption" + "GDPR compliance" + "Payments".**
Each statement is the kind of thing a buyer's procurement team will challenge. Status today:
- "Hosted within UK and EEA" — Supabase EU region is configured (staging eu-west-1, prod region in CLAUDE.md). Verify production project region matches the claim.
- "TLS 1.2 or higher / AES-256 at rest" — Supabase default, fine.
- "Role-based access" — true via [lib/security/access-scope.ts](../../lib/security/access-scope.ts) for application layer. **But:** [docs/active/TODO.md](../active/TODO.md) records that RLS is enabled on 5 tables only; 18 still rely on app-layer agencyId checks. The claim is technically fine ("role-based" doesn't mandate RLS) but if a security questionnaire asks "is database-level row security enforced?", today's answer is "partial". Worth knowing what you'll say.
- "Payments processed by Stripe… Sales Progressor does not store card numbers" — true (no card data hits your servers), but card capture UI isn't actually live yet (#5). If a prospect asks "how do I add my card?" today the answer is "we'll handle that manually for now". Don't claim more than is wired.
- "We maintain a data processing agreement and can provide a copy on request." — ELLIS_MANUAL_TODO has DPA work outstanding (PostHog DPA pending). Confirm an agency-side DPA exists in draft.
Action: don't change voice; do a one-line verification on each before any prospect challenges them.

**64. 🟡 missing — Vulnerability disclosure section.** Implies a real triage process. If `security@thesalesprogressor.co.uk` doesn't have a monitored mailbox, set it up before this page sees traffic.

---

### 3.17 /changelog ([app/changelog/page.tsx](../../../marketing-site/app/changelog/page.tsx))

**65. 🔴 stale — Dates are wrong.**
Eight entries spanning "September 2024" to "April 2025". Reality per [CLAUDE.md](../../CLAUDE.md) and [docs/done/](../done/):
- "November 2024 — Outsourced progression service" — actually Package D shipped 2026-05-03.
- "February 2025 — Agent dashboard (read-only)" — agent dashboard exists and is NOT read-only (see #42). Also doesn't match the timeline.
- "October 2024 — Client portal" — portal exists today, but not in 2024.
- "April 2025 — Marketing site launched" — site is being launched in May/June 2026 per current state.
Either the changelog is intentional positioning ("we look established") in which case ship it knowing what it is and back the dates with a "founder's note" so an honest investor / customer can find the truth; or rewrite with real 2026 dates and let it look young. Honest changelog tends to read well in this category (it shows pace).
Recommend: rewrite as real 2026 dates and add 4–5 entries the site is currently missing — AI chase drafting, problem detection, chain notifications, weekly agent brief, outsourced workflow (Package D).

**66. 🟠 missing — None of the most distinctive shipped features are in the changelog.**
Missing: AI chase drafting (six tones), nightly AI problem detection, chain-wide notifications, weekly agent brief, morning digest, solicitor intel from Land Registry, partners referral capture. These are the things to crow about.

---

### 3.18 /status ([app/status/page.tsx](../../../marketing-site/app/status/page.tsx))

**67. 🟠 overclaim — "Real-time status" is hard-coded.**
Subhead ([page.tsx:62](../../../marketing-site/app/status/page.tsx#L62)): *"Real-time status of Sales Progressor services."*
The six "operational" badges are hard-coded `status: "operational"` in the source. There is no uptime monitor wired up. Calling this "real-time" is false.
Recommend until a real uptime monitor (BetterStack / UptimeRobot / similar) is connected: change copy to *"Current status of Sales Progressor services."* Or rip the page out until it's real.

**68. 🟡 redundant — /status with no monitoring may do more harm than good pre-launch.**
A blank-faced "all operational" page invites the question "but how do you know?" If you don't have an answer wired in, hide the route from nav/footer until you do.

---

### 3.19 /tour and /register

**69. 🟢 keep — Both redirect (tour → /how-it-works, register → /demo).** Sensible. No issues.

---

## §4. Cross-cutting accuracy gaps (across pages)

**70. 🔴 — "Read-only" claim about the agent dashboard appears in two places.** FAQ Q5 (#42) and Changelog "February 2025 — Agent dashboard (read-only)". Both stale for the same reason.

**71. 🟠 — "Exchange forecast" implies a predictive model.** Surfaces in TheChoice (#14) and how-it-works step 6 (#49). It's actually an exchanging-soon list. Soften consistently.

**72. 🟠 — "Pay on exchange" is the system's promise four times on the home page alone.** Hero copy, Hero proof points, TheChoice price labels, PricingPreview headline, ServiceSection step 4, FooterCTA bottom strip. Until Stripe live charging ships, audit each usage and decide which are positioning vs which are implying system behaviour.

**73. 🟡 — Schema vocabulary leaks ("milestone", "transaction") on most pages.** VOICE_GUIDELINES rule 2 says translate to "step" / "sale". The marketing voice is allowed warmer than UI but the translation table should still apply. Specific spots: Hero (#4), TheChoice self bullets (#9), SoftwareSection row 2 (#21), how-it-works step 2 (#48).

---

## §5. Missing features the site doesn't claim (consolidated)

Ranked by value to estate-agency buyers:

**74. 🟠 — AI chase drafting (six tones).** Strong differentiator. Add to SoftwareSection and to how-it-works step 5. See #24.

**75. 🟠 — Nightly AI problem detection (7 detectors).** Add to SoftwareSection. See #25.

**76. 🟠 — Property chains across multiple files.** Add card to TheChoice "Either way you get". See #17.

**77. 🟡 — Land Registry price history on every file.** Free, on by default, useful. Could go on /how-it-works or a dedicated "what else you get" strip.

**78. 🟡 — Weekly agent brief (Monday 07:00 UTC) + morning digest.** Add to how-it-works. See #51.

**79. 🟡 — Solicitor directory + intel signals (which firms drag).** This is direct estate-agency pain. Worth a "What else you'll notice" section on home, or a dedicated /how-it-works sub-page. The progression data the platform accumulates becomes a directory advantage — that's a real moat angle.

**80. 🟡 — Client self-confirms certain milestones.** Adds to portal section. See #33.

**81. 🟡 — Reminders, escalation, and chase-task auto-creation chain.** The mechanic that turns a quiet solicitor into a flagged file. Implicit in the work queue copy but never explicit.

**82. 🟡 — Push notifications to clients.** Web push exists for the portal — fine to call out as "they get pinged when a step is confirmed, not just an email."

---

## §6. Voice — the priority section

Estate agents read the site on a phone between viewings. The current copy is competent but matter-of-fact. The brand can carry warmer than this without losing professionalism. Rules drawn from [VOICE_GUIDELINES.md](../polish-pass/VOICE_GUIDELINES.md): no system self-reference, no schema nouns (milestone → step, transaction → sale), active and specific. Marketing tone allowed warmer than the in-app UI. No em dashes per task brief.

Voice rewrites, ranked by impact:

**83. HOME / Software / Row 1 body** (also #20)
- BEFORE: *"Status, days elapsed, task counts, pipeline value. Filterable, sortable, always current."*
- AFTER: *"See every live sale at once. Who's doing what, how long it's been sitting, what the pipeline's worth this month. The answer is there before the director asks."*

**84. HOME / Software / Row 4 body** (#23)
- BEFORE: *"When you confirm a milestone, the right email goes to buyer, seller and agent. Personalised per recipient, in plain English. You don't write it."*
- AFTER: *"Tick a step done and the right email is already drafted and sent. To the buyer in their words. To the seller in theirs. The agent gets a one-liner. Nobody writes the same update three times."*

**85. HOME / TheChoice / self bullet 4** (#10)
- BEFORE: *"Work queue surfaces which files need attention today"*
- AFTER: *"Every morning, the three files that need you today are at the top. Not forty."*

**86. HOME / Software / Row 2 title and body** (#21)
- BEFORE title: *"Milestone tracking, vendor and purchaser"*
- AFTER title: *"Both sides of the sale, side by side"*
- BEFORE body: *"Two parallel milestone chains per transaction. Confirm, reverse, or mark not-required. Dates captured for time-sensitive steps."*
- AFTER body: *"Vendor and purchaser tracked separately, the way conveyancing actually works. Tick a step done. Untick if it falls back. Skip the ones that don't apply. The record stays right, even when the sale doesn't."*

**87. HOME / Hero body** (#4)
- BEFORE: *"A structured system for every transaction. Milestones tracked, clients updated automatically, agents in the picture without having to ask. Choose whether your team progresses each sale or hand it to ours. Pay on exchange."*
- AFTER: *"Every sale gets a structure. Steps tracked, clients told automatically, agents in the picture without having to ask. Choose whether your team handles each sale or ours does. Pay only when it exchanges."*

**88. HOME / Software / section body** (#19)
- BEFORE: *"Every live sale in one place. Every chase logged. Every client automatically updated the moment something moves."*
- AFTER: *"Every live sale in one place. Every chase recorded. Every client told the moment something moves, without you having to write the email."*

**89. HOME / Service / Step 2 body** (#29)
- BEFORE: *"Our team chases, logs every contact, updates the milestone record, and sends automated updates to your buyers and sellers."*
- AFTER: *"Our team chases solicitors, brokers, surveyors, everyone. Every call is on the file. Buyers and sellers get the updates automatically. You don't have to think about it."*

**90. HOME / TheChoice / self bullet 5** (#11)
- BEFORE: *"Agent dashboard keeps everyone in the picture without calls"*
- AFTER: *"Directors and negotiators see where every sale stands without picking up the phone."*

**91. HOME / TheChoice / outsource bullet 1** (#13)
- BEFORE: *"Our in-house progression team handles the sale end-to-end"*
- AFTER: *"Our progression team handles the file. Instruction to exchange."*

**92. HOME / TheChoice / either-way card "Live agent dashboard"** (#14)
- BEFORE: *"Every file, every status, exchange forecast. Agents have the information when they need it, not just when someone picks up the phone."*
- AFTER: *"Every file, every status, what's coming up this month. Agents have the answer when they need it, not just when someone picks up the phone."*

**93. HOME / TheChoice / self bullet 2** (#9)
- BEFORE: *"Milestone tracking across vendor and purchaser sides of every transaction"*
- AFTER: *"Both sides of the sale tracked side by side. Vendor and purchaser."*

**94. HOME / FAQ / Q5 answer** (#42 — accuracy + voice)
- BEFORE: *"Agents have their own portal with a read-only view of all milestone progress, contacts, reminders, and risk indicators on their transactions. They can raise requests to the progressor directly from within the app. Directors see all agency files; negotiators see only their own."*
- AFTER: *"Yes. Directors and negotiators log in to the same agent app and can see and edit every file in their agency. Steps, contacts, chases, reminders, the flagged problems. If something needs progressing, they can raise it with the progressor without leaving the app. Directors see every file in the agency. Negotiators see only their own."*

**95. HOME / FAQ / Q6 answer** (#43)
- BEFORE: *"A mobile-optimised portal accessed via a link in their welcome email. No app download, no account creation. They see a progress ring, their next step, a plain-English timeline of confirmed milestones, and rotating tips relevant to their current stage. On exchange: a celebration banner with confetti. On completion: a second one."*
- AFTER: *"A link in their welcome email opens on their phone. No app to download. No account to create. They see a progress ring, the next step in plain English, and a timeline of what's been done so far. Tips appear that match where they are, not generic 'how moving works'. When exchange happens, the screen erupts in confetti. Same again on completion. For a lot of buyers, those are the first moments the move actually feels real."*

**96. HOW IT WORKS / Step 2 body** (#48)
- BEFORE: *"Every sale follows two parallel chains: one for the vendor side, one for the purchaser. Confirm steps as they happen. Reverse one if something falls back. Mark as not-required where the sale differs from usual. The record stays accurate, even when things change."*
- AFTER: *"Every sale has two tracks. The vendor side and the purchaser side. Tick steps as they happen. Untick if something falls back. Skip the ones that don't apply. The record stays right, even when the sale doesn't behave."*

**97. HOW IT WORKS / Step 6 body** (#49)
- BEFORE: *"Negotiators and directors get their own login. They can see every live transaction, how long each has been running, and a forecast of when exchanges are likely. Full milestone detail is a click away. If something needs chasing, they can raise a request to the progressor directly from the app."*
- AFTER: *"Negotiators and directors get their own login. They see every live sale, how long each has been running, and which ones are heading for exchange this month. Full step detail is a click away. If something needs chasing, they can raise it with the progressor without leaving the app."*

**98. SITE-WIDE / Root metadata description** (#1)
- BEFORE: *"Give every sale a system. From offer accepted to keys in hand — structured progression, automated client updates, and real-time agent visibility."*
- AFTER: *"Give every sale a system. From offer accepted to keys in hand. Structured steps, automatic client updates, agents in the picture without having to ask."*

**99. SITE-WIDE / Footer tagline** (#2)
- BEFORE: *"Property transaction management for estate agencies. From offer accepted to keys in hand."*
- AFTER: *"Sales progression for estate agencies. From offer accepted to keys in hand."*

---

## §7. Suggested order of operations

If approving in waves rather than all at once:

1. **Block 1 — credibility risk (do before any paid traffic):** #35, #36, #37, #42, #65, #67. (ProofStrip stats, agency logos, testimonials, read-only FAQ, changelog, status page.)
2. **Block 2 — overclaim alignment:** #5 / #28 / #72 (the "pay on exchange" wording sweep), #14 / #49 / #71 (the "forecast" wording sweep), #63 (security copy verification).
3. **Block 3 — voice rewrites:** #83–#99.
4. **Block 4 — missing features:** #24, #25, #17, #33, #51, #66, #79 (AI chase, problem detection, chains, portal self-confirm, weekly brief, changelog gaps, solicitor intel).
5. **Block 5 — minor refinements:** everything else.

---

## §8. What needs sign-off, separately

Two things in this report explicitly need your decision before any copy moves:

- **#5 (and follow-ons):** Decide whether the "pay on exchange" framing should be tightened until Stripe live charging is shipped, or left as positioning. The model is right. The system isn't quite there.
- **#65 (and #66):** Decide whether the changelog stays back-dated (positioning) or gets rewritten honestly. Both are defensible. Pick one deliberately.

End of report.
