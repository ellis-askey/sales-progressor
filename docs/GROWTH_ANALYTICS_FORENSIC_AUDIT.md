# Growth / Website Analytics — Forensic Pre-Build Audit
Prepared 2026-08-30. Read-only forensic pass across **both** codebases:
- `full` = Sales Progressor portal/app + Command Centre (`c:/Users/ellis/Downloads/Sales Prog App/full`)
- `marketing-site` = public marketing website (`c:/Users/ellis/Downloads/Sales Prog App/marketing-site`)

This supersedes `docs/audits/WEBSITE_ANALYTICS_AUDIT_2026-08-30.md`, which incorrectly assumed the marketing site could not be inspected and had no analytics. Both assumptions were wrong (see §6). Location note: this file lives in `full/docs/` because the Growth surface is built in `full`; marketing-site changes are called out explicitly per section.

---

## 1. Executive summary

**The good news: far more exists than the previous audit implied.**
- The marketing site **already has GA4 (Consent Mode v2), a compliant cookie banner, UTM capture/persistence, and reliable conversion events** (`generate_lead`, `book_demo`, `sign_up_click`). It is Next.js 16 (App Router) — fully instrumentable.
- The portal **already has PostHog fully wired** (EU, autocapture, pageviews, consent-gated, `identify()` with agency properties) — but **switched off** (no keys in env).
- The **Agency → transaction → exchange → TSP revenue join already exists in production** (`lib/command/revenue.ts`, `/command/revenue/[agencyId]`). We can already say "agency created 17, exchanged 9, generated £X".
- The **attribution columns already exist** on `Agency` (`signupSource/Medium/Campaign/Referrer/LandingPage`) and are already consumed by `/command/growth` — **but are never populated at signup** (only ever back-stamped by the Prospects match). This is the single biggest, cheapest win.
- A **Command Centre "Growth" nav group already exists with 9 pages** and rich reusable services.

**The core problems to solve:**
1. **Two different analytics tools that can't talk to each other:** marketing = GA4, portal = PostHog. GA4 person data cannot be stitched to PostHog identities or to our DB. To get one visitor→signup→sale→revenue funnel, we must **unify on one tool** (recommendation: PostHog everywhere).
2. **Cross-domain identity + attribution is not carried.** The marketing site forwards only the 5 `utm_*` keys to the portal — no tier interest, no CTA source, no anonymous visitor id, no first-touch/referrer. So every signup lands as "direct / unknown."
3. **Top-of-funnel + activation events are under-instrumented in the portal** (no `user_signed_up` on OAuth, no server emitter for `transaction_created`, no onboarding-complete event).
4. **No shared UI primitive kit** in the Command Centre — every page re-implements KPI cards/charts/tables locally.

**None of the highest-value work is blocked on external setup.** The DB-authoritative Growth story (signup→activation→retention→exchange→revenue, with real acquisition source) can be built entirely from engineering, deferring PostHog keys/DPA/consent decisions to the end (see §20).

---

## 2. Marketing-site architecture

- **Framework:** Next.js `^16.2.4`, React 19, TypeScript strict, App Router, Tailwind v4. `package.json:12-27`. Heavy visual deps (framer-motion, gsap, three/@react-three/fiber/ogl, next-mdx-remote, gray-matter). **No analytics/consent npm packages** — GA + consent are hand-rolled.
- **`next.config.ts` is empty** (`next.config.ts:1-5`) — no redirects/rewrites/headers. Redirects done in-page (`permanentRedirect`).
- **Root layout** `app/layout.tsx` renders globally: fonts (self-hosted), the **GA4 Consent-Mode-v2 bootstrap** (`layout.tsx:118-165`), `<UtmCapture/>` (`:171`), `<CookieBanner/>` (`:176`), and site-wide JSON-LD (`:178-179`). **No shared Nav/Footer in the layout** — each page mounts its own.
- **Portal/app URLs are hardcoded, not env-driven:** `lib/external-links.ts:5-6` (`APP_LOGIN_URL`, `APP_SIGNUP_URL` = `https://portal.thesalesprogressor.co.uk/{login,register}`). GA id is also hardcoded (`lib/analytics.ts:29`). There are **no `NEXT_PUBLIC_*` vars at all**; the only env var used is `SENDGRID_API_KEY` server-side (`lib/email.ts:177`).
- **Routes:** home, `/how-it-works`, `/pricing`, `/demo`, `/blog` + `/blog/[slug]` (SSG), `/contact`, `/careers`, `/security`, `/terms`, `/privacy`; noindex `/about`,`/changelog`,`/status`; redirect-only `/register`→signup, `/tour`→how-it-works; API `POST /api/demo`, `POST /api/contact`. Dev/test routes ship in the build: `/test/homepage-v2`, `/test/homepage-v3`, `/orb-lab`.

## 3. Actual website funnel

Two funnels, cleanly separated in code:

**Self-progress (£59, self-serve):**
`Marketing page → interest → pricing/how-it-works → "Get started" CTA → portal /register → signup (creates director+agency) → first sale → usage → exchange → £59 billed`
- The "Get started" CTAs route through `useSignupHref()` (`lib/signup.ts:16-25`) → `APP_SIGNUP_URL` + UTMs.

**Outsourced (£250-350, sales-led):**
`Marketing page → interest → pricing/service info → "Book a demo" → Calendly booking OR /demo message form → lead (email to inbox) → human onboarding → progressor-run file → exchange → £250-350 billed`
- Demo CTAs route to `/demo` (`components/demo/BookingCarousel.tsx`: Calendly embed + native form).

**Every funnel-entry CTA** (from Agent A1): self-serve "Get started" at `Nav.tsx:99` (`nav_cardnav`), `Hero.tsx:736` (`hero_primary`), `Footer.tsx:147` (`footer`), `PricingPreview.tsx:178` (`pricing_preview_self`), `PricingClient.tsx:232` (`pricing_page_self`); demo "Book a demo" at `Hero.tsx:783`, `PricingPreview.tsx:173`, `FooterCTA.tsx:86`, `PricingClient.tsx:279`, `steps-data.tsx:1141`. **Tier context is NOT preserved across the hop** — all self-serve buttons hit the identical `/register?utm_*` URL; the `cta_location` only goes to GA, never to the portal (`lib/signup.ts:16-25`, `lib/utm.ts:90-104`).

## 4. Website page / section / CTA inventory

**Homepage real section order** (`app/page.tsx:28-38`) with proposed stable analytics ids (note **FAQ before Pricing**):

| # | Section | Component | Proposed id | Trackable interactions |
|---|---|---|---|---|
| 1 | Hero | `components/home/Hero.tsx` | `hero` | "Get started" (`:736`), "Book a demo" (`:783`), scroll nudge (`:880`) |
| 2 | Tier choice | `TheChoice.tsx` | `tier_choice` | self/outsource toggle (`:224`), card swipe, dots (`:300`) — no CTA |
| 3 | Intelligence layer | `IntelligenceLayer.tsx` | `intelligence_layer` | dashboard mockup (hover) |
| 4 | Outsourced service | `ServiceSection.tsx` | `outsourced_service` | mockup — no CTA |
| 5 | Client portal | `PortalSection.tsx` | `client_portal` | phone mockup |
| 6 | Social proof | `ProofStrip.tsx` | `social_proof` | stats count-up, logo wall, testimonial carousel (`:291`) |
| 7 | FAQ | `FAQ.tsx` | `faq` | 8-item accordion (`:135`) |
| 8 | Pricing preview | `PricingPreview.tsx` | `pricing_preview` | "Get started" (`:178`), "Book a demo" (`:173`), "Full pricing" (`:214`) |
| 9 | Final CTA | `FooterCTA.tsx` | `final_cta` | "Book a demo" (`:86`), "See pricing" (`:111`) |

**Scroll-depth instrumentation** (to get "82% reached section 2 … 12% clicked CTA"): each section component is a discrete element, so an `IntersectionObserver` keyed to a stable `data-analytics-section="<id>"` attribute on each section wrapper is the clean approach — emit `mkt_section_viewed {section, max_scroll_pct}` once per section per session. This is a small, well-scoped addition to the 9 components above; no architectural change needed.

**Pricing page** (`PricingClient.tsx`): two cards (Self £59 ghost CTA `:232`; Outsourced "From £250" + band table `:260-267`, coral "Book a demo" `:279`), a live `PricingCalculator` (`components/pricing/PricingCalculator.tsx`, `:314`), a 3-col comparison table, and a 3-item FAQ. Numbers single-sourced from `lib/pricing.ts`.

**Blog:** local MDX in `content/blog/*.mdx` (6 posts), loaded by `lib/blog.ts` (gray-matter + reading-time). Frontmatter is rich and validated (`blog.ts:23-89`): `title, description, publishedAt, tier, targetKeyword, moneyPage, author`. `moneyPage` drives the post's footer CTA target. Per-post OG images + article JSON-LD. This means **blog→money-page attribution is trackable per slug**.

## 5. Forms and conversion points

| Form | File | Submits to | Success detectable? | Third party |
|---|---|---|---|---|
| **Demo message** | `components/demo/DemoForm.tsx` | `POST /api/demo` → `sendInbound()` → SendGrid email to `inbox@` (`lib/email.ts:176-213`). **No CRM/DB.** | **Yes** — `res.ok` → success panel + fires GA `generate_lead{form:'demo'}` (`DemoForm.tsx:36-44`) | SendGrid (server) |
| **Demo booking** | `components/demo/CalendlyBooking.tsx` | **Calendly** (`ellis-thesalesprogressor/sales-progressor-demo`, `:29`) | **Yes** — listens to Calendly `event_scheduled` postMessage → GA `book_demo{method:'calendly'}` (`:79-83`) | Calendly (US; sets own cookies; **not consent-gated** — `:127`) |
| **Contact** | `components/contact/ContactForm.tsx` | `POST /api/contact` → SendGrid email | **Yes** — success panel + `generate_lead{form:'contact'}` (`:32-36`) | SendGrid |
| **Careers** | `components/careers/ApplicationForm.tsx` | **NOTHING — mock** (`:23-29` `setTimeout` then success; data discarded, no send, no event) | n/a | none — **flag: broken/mock** |
| Newsletter | — | **Does not exist** | — | — |

- **Form fields:** demo = name, agency, email, phone, size(1-5/6-15/16-30/30+), message, honeypot. Contact = name, email, subject, message, honeypot.
- **Form-start / abandonment / per-field:** not currently emitted but **cleanly feasible** — all controlled inputs with discrete names; emit field-name-only events on first-focus/blur without capturing PII values.
- **Conversion points that already emit a GA event:** demo submit, contact submit, Calendly booking, and the 5 `sign_up_click` CTA locations. These are reliable today (post-consent).

## 6. Existing analytics in marketing-site  ← key correction

**Google Analytics 4 is live, consent-gated, hand-rolled.** (Agent A2, verbatim evidence.)
- Measurement ID `G-T8MP8MWWJP` hardcoded (`lib/analytics.ts:29`).
- **Consent Mode v2 (basic):** inline bootstrap `app/layout.tsx:118-165` sets all four consent types `denied` by default; `gtag.js` is **only injected after Accept** (`lib/analytics.ts:98-121`). **Zero network to Google before consent.**
- **Cookie banner:** `components/_internal/CookieBanner.tsx` — Reject first in tab order, equal prominence, no dismiss-without-choice; re-consent via Footer "Cookie choices" → `resetConsent()`.
- **UTM pipeline:** `lib/utm.ts` captures the 5 `utm_*` keys → `localStorage['sp-utm']` (30-day TTL), mounted site-wide (`UtmCapture` in `layout.tsx:171`), appended to signup + Calendly URLs. `/register` route forwards **all** incoming params (incl. `fbclid/gclid`) on redirect (`app/register/page.tsx:20-34`).
- **Events firing today:** `generate_lead` (demo/contact), `book_demo` (Calendly), `sign_up_click{cta_location}` (5 locations).
- **Storage:** `sp-consent` (12mo) + `sp-utm` (30d) localStorage; no sessionStorage; no first-party cookies set by our code (GA sets `_ga`/`_ga_*` only post-consent).
- **Definitively absent:** PostHog, GTM, Vercel Analytics, Meta Pixel, LinkedIn Insight, Plausible, Fathom, Segment, Mixpanel, Hotjar, Clarity, chat/maps/reCAPTCHA. Only third-party runtime scripts: GA (post-consent) + Calendly.
- **`document.referrer` is not captured client-side** (only server-side on form POST via the HTTP `referer` header, `lib/email.ts:219-238`).

## 7. Existing analytics in full (portal)

- **PostHog fully wired** (details §8). Provider at `app/layout.tsx:79`, wrapper `lib/analytics/posthog.ts`, server `lib/analytics/posthog-server.ts`, consent `lib/analytics/consent.ts`, taxonomy `lib/analytics/events.ts`.
- **Durable DB event stream (NOT PostHog):** `recordEvent(...)` writes an `Event` row + `FeatureEvent`/`DailyMetric` rollups. This is what the Command Centre Growth pages actually read today — it works regardless of PostHog being off. E.g. `agency_created` is written on every signup (`create-director-with-agency.ts:81-89`), and `DailyMetric` counts signups via `Agency.count` (`metrics-rollup.ts:239-246`).
- **Server events emitted:** `user_signed_up` (password only, `app/api/register/route.ts:56`), `user_signed_in`, milestone confirm/unconfirm, note added, portal visited/link sent/messages, full chain-invite funnel. **Gaps:** no `user_signed_up` on OAuth (`complete-oauth-signup.ts`), no server emitter for `transaction_created` or `onboarding_step_completed`.

## 8. PostHog readiness

**Fully implemented, correctly configured, currently OFF** (no keys in `.env`). Client init returns early when `NEXT_PUBLIC_POSTHOG_KEY` is empty (`posthog.ts:142`); server no-ops when `POSTHOG_API_KEY` unset (`posthog-server.ts:9-10`).
- **Config** (`posthog.ts:144-152`): `api_host="https://eu.i.posthog.com"` (EU), `autocapture:true`, `capture_pageview:true`, `disable_session_recording:true` (replay OFF, deliberate v1), `mask_all_text:true`, `person_profiles:"identified_only"` (anonymous visitors create no profile).
- **Consent:** opt-in; localStorage `cookie-consent` + cookie + `consent-updated` CustomEvent; PostHog never inits before Accept (`posthog.ts:142`). Internal staff see no banner and stay dormant client-side (`app/layout.tsx:80`).
- **identify():** one call (`PostHogProvider.tsx:41-46`) with DB `user.id` as distinct_id + person props `email, userRole, agencyId, agencyName`. posthog-js auto-merges the prior anonymous id on first identify. **`groups()` / agency group-analytics: NOT used** — agency is only a person property.
- **Read/query already built:** four detectors under `lib/services/signals/detectors/posthog-*.ts` query `https://eu.posthog.com/api/projects/{POSTHOG_PROJECT_ID}/…` with `Bearer POSTHOG_API_KEY` (rage-click, funnel-abandonment, session-friction, cost-drift). **This proves the CC can read PostHog server-side.** Caveat: `posthog-funnel-abandonment.ts:12-17` queries event names (`signup_started`, `milestone_progressed`) the app never emits — it's dead against current taxonomy.
- **Shared project?** Yes iff both surfaces use the same `phc_` project key + EU host. Nothing prevents it; purely a config decision. `POSTHOG_PROJECT_ID` is required by read paths but **missing from `.env.example`**.

## 9. Cross-domain identity / attribution design

Goal: carry `anonymous visitor → registered user → agency → transactions → exchange → revenue`, with first-touch source attached.

**Today:** only `utm_*` crosses the hop, into nothing (the portal ignores them). PostHog anon id does not cross. GA (marketing) and PostHog (portal) are different tools → no stitch possible.

**Proposed technical flow (unify on PostHog EU, one project):**

1. **Marketing site** (`marketing-site` changes):
   - Add PostHog (EU, same `phc_` key as portal), consent-gated by the existing banner. It auto-generates an anonymous `distinct_id` and captures pageviews/autocapture/section-scroll/CTA events.
   - On every outbound CTA to the portal (`useSignupHref()` in `lib/signup.ts`, and the Calendly URL), append: the PostHog **`distinct_id`**, the persisted **UTMs**, **first-touch** (`landing_page`, `referrer`, first-seen ts), **`tier`** (self|outsourced, derivable from the CTA), and **`cta_location`**. Extend `appendUtms()`/`useSignupHref()` to include these (they already build the URL — this is a small extension; `lib/utm.ts:90-104`, `lib/signup.ts:16-25`).
   - Persist first-touch in `localStorage` (like `sp-utm` already does) so it survives multi-visit journeys.

2. **Portal `/register`** (`full` changes):
   - Read those params on the register page (`app/register/page.tsx`) and pass them through `POST /api/register` into `createDirectorWithAgency`.
   - **Write them to the already-existing `Agency.signup*` columns** (`schema.prisma:70-76` — `signupSource/Medium/Campaign/Referrer/LandingPage`), which are currently only set by the Prospects match. This alone makes `/command/growth` "Acquisition sources" real (it already reads `signupSource`, `growth/page.tsx:112-117`).
   - Call `posthog.identify(user.id, …)` (already happens) — and because the marketing anon `distinct_id` was passed, bridge it (posthog alias/merge) so the pre-signup web journey attaches to the identified user.

3. **DB join (already exists):** `Agency.id → PropertyTransaction.agencyId → exchangedAt → InvoiceLine.totalPence` (§12). With `signupSource` now populated, revenue is attributable to source/campaign/landing page **in our own DB**, independent of PostHog.

**Net:** PostHog owns the anonymous→web-behaviour half; our DB owns the identified→agency→revenue half; the `distinct_id` handoff + the `signup*` columns are the two bridges. **The DB half works even if PostHog is never turned on** — that's the resilient design.

## 10. Signup → activation mapping

Creation: `app/register/page.tsx` → `POST /api/register` → `createDirectorWithAgency` (`lib/auth/create-director-with-agency.ts:33-77`) creates `Agency` (with `signupAt`) + `User` (director/negotiator, `agencyId` link). OAuth path: `complete-oauth-signup.ts:47` → same helper.

| Stage | Measurable today | Authoritative source | Gap/fix |
|---|---|---|---|
| Registration page reached | Only via PostHog pageview (if on) | — | add `mkt_outbound_to_portal` + PostHog `/register` pageview |
| Signup started | **No** | step-1→step-2 is client-only (`register/page.tsx:87`) | emit `signup_started` |
| Signup completed | **Yes** | `Event{type:"agency_created"}` (both paths, `create-director-with-agency.ts:82`); `Agency.signupAt`; `DailyMetric.signups` | fix: `user_signed_up` PostHog missing on OAuth (`route.ts:56` password-only) |
| Onboarding completed | **Weak** | no explicit event; `User.hasSeenAgentWelcome` (`schema.prisma:145`) is closest; `ONBOARDING_STEP_COMPLETED` defined but no emitter | define "activated" structurally (below) |
| First real sale (activation) | **Yes (structural)** | first non-demo `PropertyTransaction`; `DailyMetric.transactionsCreated`; `/command/activation` cohort funnel | `transaction_created` has no server emitter — add for PostHog parity |

**Recommended activation definition (from what's recorded):** an agency is **activated** when it creates its **first non-demo, non-migrated `PropertyTransaction`** (`Agency.firstSubmissionAt` already exists and drives the trial window, `trial.ts:44`). This is DB-authoritative and needs no new event.

## 11. Activation → retention mapping

Already modelled in `lib/command/retention.ts:65 getRetention` (returning-user rate, session-gap percentiles over `Event`, drift/churn list) and the cohort grid in `growth/page.tsx`.

**Recommended definitions (DB-authoritative):**
- **Nth-sale milestones:** count non-demo `PropertyTransaction` per agency; "2nd/5th/10th sale" = the Nth `createdAt`. Trivial `groupBy`/window.
- **Active agency:** has activity (`Event` or a new transaction/milestone) in the trailing 30 days (mirrors `retention.ts`). **Dormant:** activated but no activity in 30 days.
- **Returning usage:** `DailyMetric.uniqueActiveUsers` + session-gap percentiles already computed in `retention.ts`.
- **Demo vs real:** exclude `isDemo` (§18) — critical now that new users get a demo sale.

## 12. Exchange / revenue mapping (authoritative fields — verified)

| Concept | Authoritative source | Evidence |
|---|---|---|
| **Exchange** | `PropertyTransaction.exchangedAt` (stamped when milestone **VM19/PM26** completes) | `billing-trigger.ts:33,53-56`; `schema.prisma:457`. Status enum has no "exchanged" value — `exchangedAt` is the answer. |
| **Completion** | `PropertyTransaction.completionDate`; milestones **VM20/PM27** | `schema.prisma:328`; `milestones.ts:969-973` |
| **Transaction value** | `PropertyTransaction.purchasePrice` (pence); frozen to `priceAtExchange` at exchange | `schema.prisma:302,487`; `billing-trigger.ts:76` |
| **Agent's own fee (to their client)** | `agentFeeAmount / agentFeePercent / agentFeeIsVatInclusive` — informational, **not** TSP revenue | `schema.prisma:329-331` |
| **TSP revenue (banked)** | **`InvoiceLine.totalPence`** on issued/paid/failed invoices | `schema.prisma:3421`; `lib/billing/lifetime.ts:34-40`; `lib/command/revenue.ts:447-456` |
| **Fee computation** | `lib/billing/fee.ts computeFee` (single source): self £59 / outsourced £250·£300·£350 bands / legacy override | `fee.ts:21-26,75-100` |
| **When billed** | exchange stamps `billedAtExchange`; nightly `accrual.ts` writes `InvoiceLine` onto the monthly `Invoice` | `billing-trigger.ts:68-78`; `lib/billing/accrual.ts:131-146` |
| **Service tier** | `serviceType` (self_managed/outsourced) + `progressedBy` (agent/progressor) | `schema.prisma:276-295`; set at create `transactions.ts:915-916` |

**Can we say "agency arrived from Google Organic, registered after visiting Pricing, created 17 sales, exchanged 9, generated £X"?**
- **Created 17 / exchanged 9 / £X:** **YES, already** — `lib/command/revenue.ts` + `/command/revenue/[agencyId]` do exactly this (`Agency → PropertyTransaction → exchangedAt → InvoiceLine.totalPence`).
- **"from Google Organic, after visiting Pricing":** **NOT YET** — needs §9 (populate `Agency.signupSource/LandingPage` at register). The columns exist and are consumed; they're just empty.
- **Caveats:** `freeOnExchange`/trial files exchange but bank £0 (tracked as "saved via trial", `lifetime.ts:59-67`); demo files never bill; VAT split is scaffolded but currently 0.

## 13. Command Centre integration opportunities

**A "Growth" nav group already exists** (`CommandSidebar.tsx:57-70`, 9 items). New work is an **extension**, not greenfield. Everything under `app/command/(protected)/` inherits superadmin gating, the dark shell, audit logging, and the scope filter (mode/agency) for free (`layout.tsx`).

**Reuse (zero/low work):**
- Nav: add a `NavItem` to `NAV_SECTIONS`; `soon:true` gives a free "not live" seam.
- Scope helpers `lib/command/scope.ts` (`parseMode/parseAgencies`, `serviceTypeScope`, `eventScope`).
- Pre-aggregated `DailyMetric` + `WeeklyCohort` rollups (`metrics-rollup.ts`) — cheapest trend/cohort source.
- Existing services to compose: `revenue.ts` (getRevenueDashboard / getAgencyRevenueDetail), `retention.ts` (getRetention), `adoption.ts`, `chain-invites.ts` (getLoopMetrics — viral loop), `prospects.ts` (getAcquisitionFunnel), `activation` page logic.
- Shared components: `InfoTip`, `AutoRefresh`, `WhatChanged` (`components/command/shared/*`).

**Genuinely new work:**
- **A shared CC UI primitive kit** (KPI card, stat tile, funnel bar, sparkline, bar chart, filter chip, table shell, period selector, empty state). Today every page redefines these locally (`revenue Kpi`, `activation StatCard/FunnelTable`, `adoption Stat/Funnel/GrowthChart`, `followup-usage Sparkline/pill/chip`). **This is the biggest reuse gap — extract to `components/command/ui/` first (Law 14: add to COMPONENT_LIBRARY_CATALOG before building).**
- A PostHog-read module in `lib/command/` for web-funnel numbers (pattern proven by the signal detectors).
- Any metric not in `DailyMetric` needs a rollup column + migration (staging-first, Law 3).

## 14. PostHog vs TSP responsibilities

Base division on what each system is authoritative for:

**PostHog owns (web behaviour, anonymous + pre-identify):**
- Pageviews, sessions, entry/exit pages, paths ("where next / where leave"), scroll-depth/section-viewed, CTA clicks, heatmaps, **session replay** (currently off — decision), funnels of on-site behaviour, **experiments/A-B**. It already has autocapture + pageview on.

**Command Centre / TSP DB owns (identified, money-bearing):**
- Signup→activation→cohort→retention, first/second/fifth/tenth sale, exchange, **revenue** (`InvoiceLine`), service tier, agency-level attribution, LTV/ARPA, growth alerts (signals). All DB-authoritative and already partly built.

**The Growth Command Centre composes both:** it reads DB directly for the money/agency half (fast, authoritative, works offline of PostHog) and reads **PostHog's query API** for the top-of-funnel web numbers (visitors, sources, on-site funnels) — joined on the `signup*` attribution columns rather than trying to reproduce PostHog's session engine. Do **not** rebuild pageview/session/heatmap infrastructure inside CC.

## 15. Event taxonomy recommendation

**Marketing-site (new, PostHog, consent-gated):** `mkt_page_viewed` (auto), `mkt_section_viewed{section,max_scroll_pct}`, `mkt_cta_clicked{label,location,destination,tier}`, `mkt_pricing_viewed`, `mkt_pricing_tier_selected{tier}`, `mkt_pricing_calculator_used`, `mkt_faq_opened{question}`, `mkt_demo_form_started/submitted`, `mkt_contact_form_started/submitted`, `mkt_calendly_booked`, `mkt_blog_post_read{slug,scroll,read_time}`, `mkt_outbound_to_portal{cta,tier,distinct_id,utms}`. (GA equivalents already exist for the submit/booking/CTA ones — reuse names or migrate.)

**Portal (fix/add to existing `ANALYTICS_EVENTS`):**
- Fix `user_signed_up` to also fire on the **OAuth** path (`complete-oauth-signup.ts`).
- Add server emitters for `signup_started`, `transaction_created`, and an explicit `activated` (first real sale) event.
- **Align the dead funnel detector** (`posthog-funnel-abandonment.ts:12-17`) to the real names, or update it to `user_signed_up → transaction_created → milestone_confirmed`.
- Add `posthog.group('agency', agencyId, {...})` if we want agency-level PostHog analytics (currently agency is only a person prop).

**Naming:** keep the existing `noun_verb` convention (`events.ts:4`); `mkt_` prefix for marketing-site events to keep the two funnels legible in one project.

## 16. Data availability matrix

| Question | Classification | Notes / source |
|---|---|---|
| How many visit? Where from? Landing pages? | **Requires small instrumentation** | GA has some now; PostHog pageviews once added + on |
| Where do they go next / leave? Scroll depth / sections seen? | **Requires small instrumentation** | `mkt_section_viewed` on the 9 homepage sections (§4) |
| Which CTAs clicked / which position/message best? | **Measurable after enabling** (partial now) | `sign_up_click{cta_location}` already fires in GA (5 locations) |
| Who visits pricing / starts registering / books demo? | **Measurable after enabling** | pricing pageview + `mkt_demo_form_started` + Calendly `book_demo` (already fires) |
| Where do people abandon forms? | **Requires small instrumentation** | add form_start + field-blur events (no PII) |
| Which blog posts generate useful traffic? | **Requires small instrumentation** | per-slug pageviews + `moneyPage` frontmatter already links intent |
| Which sources generate registrations? | **Requires small instrumentation** | populate `Agency.signupSource` at register (columns exist) |
| Which sources generate demos? | **Measurable after enabling** | UTMs already forwarded to Calendly (`CalendlyBooking.tsx:57`) |
| Which registrations create a first / 2nd / 5th / 10th sale? | **Already measurable** | `PropertyTransaction` count per agency (exclude demo) |
| Which agencies keep using it / eventually exchange? | **Already measurable** | `retention.ts`, `exchangedAt` |
| Revenue attributable to source/campaign/page? | **Requires small instrumentation** | revenue join exists; just needs `signup*` populated (§9,§12) |
| What's improving/deteriorating over time? | **Already measurable** | `DailyMetric`/`WeeklyCohort` + `WhatChanged` |
| Session replay / heatmaps | **Requires external/manual config** | PostHog replay is off by config; enabling is a decision (§17) |
| GA↔PostHog↔DB unified funnel | **Requires new implementation** | tool unification + cross-domain id (§9) |
| Careers applications | **Not reliably measurable** | form is a mock, discards data (`ApplicationForm.tsx:23-29`) |

## 17. GDPR / consent findings (engineering facts; legal decisions flagged)

- **Marketing site:** compliant-shaped consent already exists — Consent Mode v2 default-denied, no GA network before Accept, cookie banner with equal-weight Reject, re-consent link, privacy policy documenting `_ga` cookies (`app/privacy/page.tsx:338-376`). **Gaps to fix before more tracking:** the policy does **not** mention Calendly (US embed setting cookies, and its script currently loads **regardless of consent** — `CalendlyBooking.tsx:127`) or the `sp-utm`/`sp-consent` localStorage; company-number/registered-office are still `[placeholder]` (`privacy/page.tsx:110,398`).
- **Portal:** separate opt-in consent (`lib/analytics/consent.ts`, key `cookie-consent`), PostHog never inits pre-consent, replay off, text masking on. Internal staff get no banner (`app/layout.tsx:80`).
- **The two consent systems are independent** (different storage keys, different tools). Unifying on PostHog means the marketing site needs a consent path for PostHog too (its banner currently only gates GA).
- **Legal decisions for Ellis (separate from engineering):** DPA with PostHog (EU); whether to run **session replay** (higher-sensitivity processing — needs policy + masking review); whether to keep GA4 alongside PostHog or deprecate it; add Calendly + localStorage to the cookie policy; fill the company/registered-office placeholders.

## 18. Internal / demo / test exclusion

Canonical helpers: `lib/security/internal-accounts.ts`. Apply on every Growth query.

| Exclude | Field | Filter |
|---|---|---|
| Internal agency | `Agency.isInternal` (`schema.prisma:22`) | `{ isInternal:false }` / `excludeInternalAgency` (`internal-accounts.ts:15,21`) |
| Internal/TSP users | `User.isInternal` (`schema.prisma:146`); internal roles have `agencyId=null` | `excludeInternalUser`/`excludeInternalUserIds` (`internal-accounts.ts:18,26`) |
| Demo transactions | `PropertyTransaction.isDemo` (`schema.prisma:376`) | `{ isDemo:false }` (`metrics-rollup.ts:139`, `revenue.ts:368`) |
| Demo users | `User.isDemo` (`schema.prisma:150`) | `{ isDemo:false }` |
| Migrated/backdated | `PropertyTransaction.isMigrated` (`schema.prisma:369`) | `{ isMigrated:false }` |
| Free/trial files | `freeOnExchange` (`schema.prisma:453`), `Agency.feeTier="free"` | include as "exchanged £0" for volume; exclude from banked |
| Staging/localhost/test | no column — **environment/DB isolation** (separate staging Supabase) + the flags above | — |

**Important for the demo-sale era:** the new explore-a-demo feature creates `isDemo` self-managed files — these are already excluded by `isDemo:false` in the rollup/revenue queries, and (per earlier fix) no longer unlock self-progression nav. Growth reporting must apply the full recipe: `agency.isInternal=false AND isDemo=false AND isMigrated=false`.

## 19. Recommended architecture

```
MARKETING SITE (marketing-site, Next 16)
   • PostHog EU (consent-gated) — anonymous distinct_id, pageviews, section-scroll, CTA, form funnels, heatmaps, (replay optional)
   • persist first-touch (utm/referrer/landing/tier) in localStorage
        │  outbound CTA carries: distinct_id + utms + first-touch + tier + cta_location
        ▼
PORTAL /register (full)
   • read handoff params → write Agency.signup{Source,Medium,Campaign,Referrer,LandingPage}   ← columns already exist
   • posthog.identify(user.id) bridging the marketing anon distinct_id
        ▼
AGENCY (Agency.id)  ──1:N──►  PropertyTransaction (agencyId)
        │                          │  VM19/PM26 → exchangedAt (+ billedAtExchange, priceAtExchange)
        │                          ▼
        │                     nightly accrual → InvoiceLine.totalPence  ← authoritative TSP revenue
        ▼
GROWTH COMMAND CENTRE (full, /command/*)
   • DB half (authoritative): signup → activation(firstSubmissionAt) → cohorts/retention → exchange → revenue → attribution-by-signupSource
   • PostHog-read half (query API): visitors, sources, on-site funnels, paths, heatmaps
   • composes both; excludes internal/demo/migrated
```

**Authoritative ownership:** PostHog = web behaviour + experiments + replay/heatmaps. Our DB = identity, agency, transactions, exchange, revenue, tier, attribution columns. Command Centre = the join + presentation.

## 20. Implementation phases (engineering-first; manual last)

**Phase 0 — DB-authoritative Growth, no external deps (biggest value, zero keys):**
1. Extract a shared CC UI primitive kit (`components/command/ui/`) — catalog first (Law 14).
2. **Capture attribution at signup:** marketing-site forwards `utm/referrer/landing/tier/cta` on the outbound CTA; portal `/register` writes them into the existing `Agency.signup*` columns. Instantly makes `/command/growth` "Acquisition sources" real.
3. Fix `user_signed_up` on OAuth; add server emitters for `signup_started`/`transaction_created`/`activated`; align the funnel detector names.
4. Build the Growth CC pages that read DB only: acquisition-by-source, activation cohorts, Nth-sale, retention, exchange, revenue-by-source (compose `revenue.ts` + `retention.ts` + `metrics-rollup.ts` + the new `signup*` data). All works with PostHog off.

**Phase 1 — Unify web analytics on PostHog (engineering, still no manual):**
5. Add PostHog to `marketing-site` (EU, consent-gated by its existing banner), with the `mkt_*` taxonomy + section-scroll + form-funnel + cross-domain `distinct_id` handoff.
6. Add a `lib/command/` PostHog-read module; surface visitors/sources/on-site funnels in the Growth pages.
7. Optionally `posthog.group('agency', …)` for agency-level web analytics.

**Phase 2 — External/manual (latest sensible point):**
8. Populate PostHog keys in Vercel (both repos, same EU `phc_` project); add `POSTHOG_PROJECT_ID` (+ to `.env.example`).
9. DPA sign-off; consent/policy updates (Calendly + localStorage disclosure; company placeholders); GA4 keep-or-deprecate decision; session-replay decision.
10. Fix the careers mock form if lead capture there matters.

## 21. Risks / unknowns

- **Tool unification cost:** migrating marketing from GA4 to PostHog (or running both) is a real decision; GA history won't carry into PostHog. Running both temporarily is fine but double-instruments.
- **Cross-domain id fragility:** ad blockers / Safari ITP can break anon-id handoff; the DB `signup*` capture is the resilient fallback and should be primary.
- **PostHog dormant:** nothing is collected until keys are set — no historical baseline; plan for a clean start.
- **Funnel detector is currently dead** (wrong event names) — anything relying on it is misleading until fixed.
- **Calendly** loads pre-consent and isn't in the cookie policy — compliance snag to close before scaling paid traffic.
- **Careers form silently discards data** — not analytics, but a live lead leak.
- **Marketing portal URLs + GA id are hardcoded** — no env switch for staging vs prod analytics; consider env-driving them during Phase 1.
- **Attribution completeness:** only agencies that register via the marketing hop get source data; direct/word-of-mouth stays "unknown" (expected).

## 22. Ellis — manual actions eventually required (deferred to the end)

None of these block Phase 0. Do them at the Phase 2 point:
1. **Create/confirm the PostHog EU project** and provide the `phc_` project key + a personal API key + project id. Decide whether marketing + portal share one project (recommended).
2. **Add env vars in Vercel** (both projects): `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`, (optional `POSTHOG_HOST`).
3. **Sign the PostHog DPA**; decide on **session replay** (yes/no) and heatmaps.
4. **GA4 decision:** keep alongside PostHog, or deprecate `G-T8MP8MWWJP`.
5. **Cookie/privacy policy updates:** disclose Calendly + `sp-utm`/`sp-consent` localStorage; consent-gate the Calendly script; fill `[Company number]` / `[Registered office]` (`marketing-site app/privacy/page.tsx:110,398`).
6. Confirm whether **Calendly** exposes a booking→outcome webhook we should ingest for demo→won attribution.
7. Decide whether the **careers form** should actually capture/send (currently a mock).

---

### Evidence index (key files)
- Marketing: `app/layout.tsx`, `lib/analytics.ts`, `lib/utm.ts`, `lib/signup.ts`, `lib/external-links.ts`, `app/page.tsx`, `components/home/*`, `components/demo/*`, `components/contact/ContactForm.tsx`, `components/careers/ApplicationForm.tsx`, `app/privacy/page.tsx`, `lib/blog.ts`.
- Portal PostHog: `components/analytics/PostHogProvider.tsx`, `lib/analytics/{posthog.ts,posthog-server.ts,consent.ts,events.ts}`, `lib/services/signals/detectors/posthog-*.ts`.
- Signup/revenue: `lib/auth/create-director-with-agency.ts`, `app/api/register/route.ts`, `app/actions/complete-oauth-signup.ts`, `lib/services/billing-trigger.ts`, `lib/billing/{fee.ts,accrual.ts,lifetime.ts}`, `lib/command/revenue.ts`, `lib/services/trial.ts`, `prisma/schema.prisma` (Agency 13, PropertyTransaction 286, Invoice 3380, InvoiceLine 3409).
- Exclusion: `lib/security/internal-accounts.ts`, `lib/services/metrics-rollup.ts`.
- Command Centre: `components/command/CommandSidebar.tsx`, `app/command/(protected)/layout.tsx`, `lib/command/{scope.ts,revenue.ts,retention.ts,adoption.ts,chain-invites.ts,prospects.ts,feature-usage.ts}`, `components/command/shared/*`.
