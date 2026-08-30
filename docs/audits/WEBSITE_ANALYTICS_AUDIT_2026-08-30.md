# Website analytics audit — The Sales Progressor
Prepared 2026-08-30. Purpose: hand to ChatGPT to produce a concrete tracking/instrumentation plan so we can measure acquisition, customer behaviour, and what's converting vs not.

---

## 0. TL;DR of current state
- **The marketing site (`thesalesprogressor.co.uk`) has effectively no behavioural analytics today.** It is a separate surface from the app; nothing in the product codebase instruments it.
- **PostHog (EU) is fully built into the *portal/app*** (`portal.thesalesprogressor.co.uk`) but appears **switched off** (no API key set; flagged internally as "pending DPA + key"). When on, it auto-captures pageviews + a defined event set — but **all existing events are product events (signup onward). There are zero marketing-funnel events.**
- Net: we cannot currently answer "how many visitors, from where, doing what, converting at what rate" for the website. This audit defines what to track to fix that.

---

## 1. Site map (live, verified 2026-08-30)

Marketing site: `www.thesalesprogressor.co.uk`

| Page | Path | Role in funnel | Primary conversion action |
|---|---|---|---|
| Home | `/` | Top of funnel / hero | "Get started", "Book a demo" |
| How it works | `/how-it-works` | Consideration | scroll → CTA |
| Pricing | `/pricing` | Consideration / intent | tier select → register / demo |
| Book a demo | `/demo` | **Lead capture (sales-led)** | demo form submit |
| Contact | `/contact` | **Lead capture** | contact form submit |
| Blog | `/blog` (+ posts) | SEO / content | read → CTA |
| Careers | `/careers` | Recruitment | (not a sales conversion) |
| Security | `/security` | Trust | — |
| Status | `/status` | Trust | — |
| Terms / Privacy | `/terms`, `/privacy` | Legal | — |
| Log in (external) | `portal.thesalesprogressor.co.uk/login` | Returning users | — |
| Register (external) | `portal.thesalesprogressor.co.uk/register` | **Signup conversion (self-serve)** | account created |
| Social | Instagram, LinkedIn | Off-site | — |

Homepage section order (for scroll-depth / section-engagement tracking): Hero ("The silence ends at offer accepted") → tier choice (Self-progress vs Outsourced) → features → "Sales progression is a people job" → "Your team just got bigger" → case study (14 Birchwood Avenue) → client-portal explainer → portal UI mockup → social-proof stats → testimonials (4 directors) → FAQ → pricing comparison → final CTA ("Every sale deserves to be seen through").

## 2. The two conversion paths (critical to the model)
The site deliberately splits by service tier, and the two tiers convert **differently** — track them as separate funnels:
- **Self-progress (£59/sale, self-serve):** Visitor → Pricing/How-it-works → **Register** (portal) → activate (first sale) → exchange (revenue).
- **Outsourced (£250–350/sale, sales-led):** Visitor → Pricing → **Book a demo / Contact** → (human sales) → onboarded → first sale → exchange.

Headline commercial framing on site: "No contracts. No setup fees. No monthly subscriptions. Pay on exchange." So the money event is **exchange**, which happens *inside the product*, weeks after signup — meaning full-funnel attribution has to stitch website → portal signup → first exchange.

---

## 3. What is tracked today (verified in code)
Existing PostHog taxonomy (`lib/analytics/events.ts`) — **product only**, and only live if PostHog is enabled:
- Auth/onboarding: `user_signed_up`, `user_signed_in/out`, `onboarding_step_completed`
- Product usage: `transaction_created/deleted/status_changed/viewed`, `milestone_confirmed/unconfirmed`, `note_added`
- Portal: `portal_link_sent`, `portal_visited`, `portal_message_sent_by_agent/contact`
- Invites/virality: director + negotiator invitations, chain-invite funnel (`chain_invite_sent/viewed`, `chain_claim_started/completed`, declined, nudged)
- In-app page views: `page_view_hub/analytics/work_queue/settings`; `analytics_period_changed/filter_changed`
- Automatic `capture_pageview` for any page the app's PostHog provider wraps (portal + public auth/legal pages in the app repo).

**Gaps vs the website:** no homepage/marketing pageview taxonomy, no CTA-click events, no scroll/section engagement, no demo-form funnel, no pricing interaction, no source/UTM capture, no cross-domain identity stitch. The marketing hero pages (separate codebase) are almost certainly uninstrumented entirely.

---

## 4. Behavioural questions we want answered (the "why")
Give these to ChatGPT as the outcomes the tracking must support.

**Acquisition — where do people come from?**
- Which channels/campaigns drive traffic and *quality* traffic (organic, LinkedIn, Instagram, referral, direct, paid)?
- Which blog posts / landing pages pull visitors, and do those visitors convert?

**Engagement — what do they actually do?**
- Which pages get visited, in what order, how deep do they scroll the homepage (which sections earn attention, which are skipped)?
- Where do people drop off? Bounce rate by entry page; time on key pages.
- Do they watch/expand the portal mockup, open the FAQ, read testimonials?

**Conversion — what's working?**
- Homepage → Pricing → (Register | Demo) funnel with drop-off at each step.
- Self-serve register conversion rate vs demo-request rate, split by tier interest.
- Which CTA wording/position converts (Get started vs Book a demo)?
- Demo form: start rate, completion rate, abandonment fields.

**Full-funnel / ROI (the big one):**
- Visitor → signup → **first exchange (paid)**. Attribute revenue back to the acquisition source. This needs cross-domain + identity stitching (website anon id → portal user → agency → first exchanged sale).

**Content & messaging:**
- Which value props / sections correlate with conversion?
- A/B testing capacity for hero copy, pricing presentation, CTA.

---

## 5. Recommended tracking framework (starter — for ChatGPT to refine)
A proposed event/property model. Not exhaustive; a scaffold.

**Global properties on every event:** `utm_source/medium/campaign/term/content`, `referrer`, `landing_page`, `device`, `is_returning`, `session_id`, plus a persistent `anon_distinct_id` that survives the cross-domain hop to the portal.

**Marketing-site events to add:**
- `mkt_page_viewed` (auto) — path, title, referrer, utms
- `mkt_section_viewed` — section name + % scrolled (hero, pricing, testimonials, faq, portal_mockup…)
- `mkt_cta_clicked` — label ("Get started" / "Book a demo" / "Log in"), location (hero/pricing/footer), destination, tier_context (self_progress | outsourced)
- `mkt_pricing_viewed` / `mkt_pricing_tier_selected` — tier
- `mkt_faq_opened` — question
- `mkt_demo_form_started` / `mkt_demo_form_submitted` — fields completed, tier interest, abandonment point
- `mkt_contact_form_started` / `mkt_contact_form_submitted`
- `mkt_blog_post_read` — slug, scroll depth, read time
- `mkt_outbound_to_portal` — which CTA sent them to `/register` or `/login` (the cross-domain handoff, carrying utms + anon id)

**Stitch to existing product events** (already defined): `user_signed_up` (attach the carried utms + anon id at signup), `transaction_created` (activation), `milestone_confirmed` where code = exchange (the revenue moment). That closes visitor → signup → paid.

**Funnels to define in the tool:**
1. Home → Pricing → CTA click → Register-page → `user_signed_up` (self-serve).
2. Home → Pricing → `mkt_demo_form_submitted` (sales-led).
3. `user_signed_up` → `transaction_created` → exchange (activation → revenue), segmented by acquisition source.

---

## 6. Cross-domain & identity (do not skip — this is where most setups break)
- The **marketing site and the portal are different subdomains/codebases**. A visitor's identity must persist across the hop (`www.` → `portal.`), or every signup looks like "direct/unknown" and the whole ROI story collapses.
- Needs: a shared analytics project, **cross-domain persistence** (shared cookie/domain config or passing the anon id on the outbound link), **UTM capture on first touch** stored and replayed at signup, and **identity resolution** (anon → user → agency) at `user_signed_up`.
- PostHog (already the chosen tool, EU cluster) supports cross-domain + identify(); the plan should specify the config.

## 7. Tooling decision & compliance
- **Tool:** PostHog EU is already selected and half-built (in the app). Options ChatGPT should weigh: extend PostHog to the marketing site (consistent, one funnel, session replay + heatmaps available), vs a lighter page-analytics tool (Plausible/Fathom/GA4) for traffic + PostHog for product. Recommendation leans PostHog-everywhere for end-to-end funnel.
- **Blockers to switch on:** PostHog API key + DPA (flagged internally as pending), and a **consent banner** (a cookie-policy page exists; consent gating is already coded in the app). GDPR: UK/EU, so consent-mode + EU data residency matter — PostHog EU already chosen for this reason.
- **Session replay + heatmaps:** PostHog offers both; valuable for "what's working on the page" beyond events. Decide if in scope.

## 8. Open questions to confirm before building
1. **What is the marketing site built in?** (Next.js / Webflow / Framer / other) — determines how tracking is added. It is a **separate codebase** from this product repo; I could not inspect it here.
2. **How does "Book a demo" work?** Native form, Calendly/SavvyCal embed, or email? The tracking for a third-party scheduler differs (need their conversion webhook/redirect).
3. **Is `/register` (self-serve signup) live and open, or invite-only?** Affects whether self-serve is a real funnel yet.
4. Are there any **paid campaigns / ad platforms** running now (Google/Meta/LinkedIn) that need conversion pixels + UTM discipline?
5. Newsletter / blog subscription — any email capture to instrument?
6. Do we want **A/B testing** capability from day one (affects tool choice + implementation)?

## 9. Gaps & risks
- Without cross-domain identity, revenue can't be attributed to source — the most valuable question stays unanswered.
- The money event (exchange) lives in the product and lands weeks after signup; the plan must tolerate long attribution windows.
- Consent/GDPR must be handled on the marketing site too (not only the app), or capture is non-compliant.
- If the marketing site is on a no-code platform, some events (scroll/section, form-field abandonment) may be harder — confirm platform first.
- PostHog being "pending DPA + key" means *nothing is being collected yet*; there is no historical baseline — plan for a clean start.

---

### One-paragraph brief you can paste above this for ChatGPT
"Here is an audit of our estate-agency SaaS website (marketing site `thesalesprogressor.co.uk`, separate from our product portal `portal.thesalesprogressor.co.uk`). We currently have almost no website behavioural analytics; PostHog is built into the product but switched off, and only tracks product events, not marketing. Using the audit below, produce a prioritised tracking/instrumentation plan: the exact events + properties to implement, the funnels and dashboards to build, the cross-domain + UTM + identity-stitching approach to attribute signups and first-exchange revenue back to acquisition source, the tool decision (extend PostHog vs add GA4/Plausible), consent/GDPR handling, and a phased rollout. Flag anything you need me to confirm."
