# Growth Analytics — Implementation Log
Companion to `docs/GROWTH_ANALYTICS_FORENSIC_AUDIT.md` (the spec). Tracks what is built, the rules, and what remains, so any session can continue safely.

Started 2026-08-30. Two repos: `full` (portal + Command Centre), `marketing-site` (public site).

---

## Status at a glance
| Slice | State |
|---|---|
| 1. Attribution at signup (marketing → Agency columns) | **DONE** (both repos, tested) |
| 2. Product analytics event gaps | **DONE** |
| 3. Shared Command Centre UI primitive kit | **DONE** (`components/command/ui/primitives.tsx`) |
| 4. Website & Growth page — DB-authoritative sections | **DONE** (`/command/website-growth`) |
| 5. marketing-site PostHog + `mkt_` taxonomy + section instrumentation + cross-domain id | not started |
| 6. PostHog read layer + web-behaviour/homepage/CTA sections + tracking-health | not started |

## Slice 3 — Shared CC UI primitives (DONE)
`components/command/ui/primitives.tsx`: `Section`, `KpiCard`, `DeltaPill`, `FunnelBars`, `ParamTabs` (URL-param tabs), `TableShell`/`Tr`/`Td`, `CardEmpty`, `TrackingDisabled` (the intentional not-connected state, never a fake 0), `InsightCard`, `fmtGBP/fmtInt/fmtPct`. Server-safe, CC dark styling. Existing Growth pages untouched (they keep their local copies).

## Slice 4 — Website & Growth page (DONE, DB-authoritative)
- Nav: added `Website & Growth` at the top of the existing Growth group (`CommandSidebar.tsx`) — the 9 existing pages unchanged.
- `lib/command/growth-analytics.ts` — one load (agencies + real txns + banked InvoiceLines), computes: Overview (signups/activated/activation-rate/exchanges/revenue + prev-period deltas), cohort Funnel (signup→activated→2nd→5th→exchanged + cohort revenue), Acquisition by classified source, CTA performance (from `signupCtaLocation`), Activation & adoption (all-time Nth-sale + avg days-to-first-sale), deterministic Insights, Tracking health. Period (7d/30d/90d/month/last-month/quarter) + tier (all/self/outsourced) via URL params.
- `app/command/(protected)/website-growth/page.tsx` — server component composing the sections with the Slice-3 primitives. Website-behaviour/homepage sections show the `TrackingDisabled` state until PostHog is connected (Slice 5-6).
- **Exclusions:** `agency.isInternal=false`, tx `isDemo=false`, `isMigrated=false`. **Revenue = `InvoiceLine.totalPence`** on banked (issued/paid/failed) invoices only; free/trial exchanges bank £0.
- Note: needs migrations `20260830010000` + `20260830010500` applied (columns/enum) before it renders live.

Nothing pushed yet — commits sit on `staging` (full) / the marketing-site working branch, awaiting Ellis's push.

---

## Slice 1 — Attribution at signup (DONE)

**Goal:** carry first-touch marketing attribution across the `www → portal` hop and persist it on the new Agency, DB-authoritative (works even if PostHog is off).

**marketing-site:**
- `lib/utm.ts` — rewritten to **first-touch** semantics. Captures utm_* + `referrer` (external host only) + `landing_page` + `first_seen` on the FIRST visit; never overwritten within the 30-day TTL (`sp-utm` localStorage). `appendUtms(url, {tier, cta})` now appends utm_* + `sp_ref`/`sp_landing`/`sp_fseen`/`sp_tier`/`sp_cta`. Legacy `{utms,...}` payloads still read.
- `lib/signup.ts` — `useSignupHref({tier, cta})` carries the CTA's tier + location into the outbound URL.
- CTA call sites updated to pass tier+cta: `Nav.tsx` (nav_cardnav), `Hero.tsx` (hero_primary), `Footer.tsx` (footer), `PricingPreview.tsx` (self/pricing_preview_self), `PricingClient.tsx` (self/pricing_page_self).

**full (portal):**
- `lib/analytics/attribution.ts` — pure module. `attributionFromParams`, `hasAttribution`, `parseAttributionCookie`, `classifySource` (Organic Search / Paid / LinkedIn / Instagram / Referral / Campaign / Direct-Unknown), cookie const `sp_attribution` (30-min).
- `app/register/page.tsx` — on mount, writes the `sp_attribution` cookie from the inbound utm_*/sp_* params (survives the OAuth round-trip).
- `app/api/register/route.ts` (password) and `app/actions/complete-oauth-signup.ts` (OAuth) — read the cookie, pass `attribution` to `createDirectorWithAgency`, then clear the cookie.
- `lib/auth/create-director-with-agency.ts` — writes attribution onto the new Agency at creation (first-touch safe, since the agency is brand new).
- Migration `20260830010000_agency_signup_attribution` — adds `Agency.signupTerm/signupContent/signupTier/signupCtaLocation` (source/medium/campaign/referrer/landingPage already existed).
- Tests: `__tests__/analytics/attribution.test.ts` (13 passing).

**Attribution rules:** raw values stored on Agency; classified at read time via `classifySource`. First-touch wins (marketing-site never overwrites within TTL; the Agency columns are set once at creation). The Prospects match still back-stamps `signupSource` for prospects that convert — a register-time value now takes precedence for self-serve signups.

**Effect:** `/command/growth` "Acquisition sources" (`app/command/(protected)/growth/page.tsx:112`) — which already reads `signupSource` — becomes real for any agency that registers via the marketing hop.

---

## Slice 2 — Product analytics event gaps (DONE)

- **`user_signed_up` on OAuth** — added in `complete-oauth-signup.ts` (was password-only). Parity across both signup paths.
- **`signup_started`** — new client event fired on the register step-1→step-2 advance (`app/register/page.tsx advanceToStep2`); added to `ANALYTICS_EVENTS` + the client allow-list (`lib/analytics/posthog.ts`).
- **`transaction_created`** — PostHog emitter added alongside the existing durable DB event in `lib/services/transactions.ts` (guarded `!isDemo`).
- **`activated`** — new event: fires once when an agency creates its **first real (non-demo, non-migrated) PropertyTransaction**. Writes a durable `Event{type:activated}` + a PostHog event. New `EventType.activated` enum value — migration `20260830010500_event_type_activated`.
- **Funnel detector fixed** — `lib/services/signals/detectors/posthog-funnel-abandonment.ts` now queries real event names: `signup_started → user_signed_up → transaction_created → milestone_confirmed` (was querying `signup_completed`/`milestone_progressed`, which are never emitted, so it was dead).

**Metric definitions:**
- **Activation** = agency's first real (non-demo, non-migrated) `PropertyTransaction`. (Structural; `Agency.firstSubmissionAt` also marks this.)
- **Signup completed** = `Event{type:agency_created}` (both paths) / `Agency.signupAt`.

---

## Migrations added (staging-first, not yet pushed)
- `20260830010000_agency_signup_attribution` — 4 Agency columns.
- `20260830010500_event_type_activated` — `EventType` enum value.

---

## Remaining work (Slices 3-6) — for the next session

**Slice 3 — Shared CC UI primitives** (`components/command/ui/`): KPI card, delta pill, sparkline, funnel bar, bar chart, chart wrapper, period selector, filter chip, table shell, empty state, **tracking-disabled state**, insight card. Add to `docs/reference/COMPONENT_LIBRARY_CATALOG.md` first (Law 14). Do NOT refactor existing Growth pages onto them.

**Slice 4 — Website & Growth page** (ONE new page in the existing Growth nav group; do not touch the 9 existing pages): sections A-K from the spec. Start DB-authoritative (Overview, Full funnel, Acquisition-by-source using the now-populated `signup*` columns + `classifySource`, Activation, Retention, Exchange/Revenue via `lib/command/revenue.ts`). Compose existing services: `revenue.ts`, `retention.ts`, `adoption.ts`, `chain-invites.ts` (getLoopMetrics), `prospects.ts` (getAcquisitionFunnel), `metrics-rollup` (`DailyMetric`/`WeeklyCohort`). Apply exclusions everywhere: `agency.isInternal=false AND isDemo=false AND isMigrated=false`; free/trial exchanges count as £0 (never banked). Revenue = `InvoiceLine.totalPence` only.

**Slice 5 — marketing-site PostHog**: add PostHog EU (same project key as portal) gated by the existing GA cookie banner (banner must also gate PostHog, currently GA-only); keep GA4 running alongside. Implement `mkt_*` taxonomy (section_viewed via IntersectionObserver on the 9 homepage sections with stable `data-analytics-section` ids from the audit; cta_clicked, pricing_viewed/tier_selected/calculator_used, faq_opened, demo/contact form start+submit, calendly_booked, blog_post_read, outbound_to_portal). Cross-domain: pass the PostHog anon `distinct_id` on the outbound signup URL; bridge/identify it on the portal at signup.

**Slice 6 — PostHog read layer + web sections + tracking-health**: a `lib/command/` PostHog query module (pattern: existing `signals/detectors/posthog-*.ts`, `Bearer POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`, host `https://eu.posthog.com`). Website-behaviour / homepage-performance / CTA-performance sections read it; DB reads the money half; compose server-side. Tracking-health panel (disabled/partial/connected states, last event, known vs unknown attribution %). Never render missing analytics as `0`.

---

## Ellis — manual actions (deferred to the very end; NOT needed for Slices 1-4)
1. PostHog EU project — provide `phc_` project key + personal API key + project id; decide shared project for marketing + portal (recommended).
2. Vercel env (both projects): `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID` (+ add `POSTHOG_PROJECT_ID` to `.env.example`).
3. PostHog DPA; session-replay + heatmap decision.
4. GA4 keep-or-deprecate decision.
5. Cookie/privacy policy: disclose Calendly + `sp-utm`/`sp-consent` localStorage; consent-gate the Calendly script; fill company/registered-office placeholders (`marketing-site/app/privacy/page.tsx:110,398`).
6. Confirm Calendly booking→outcome webhook for demo attribution.
7. Careers form is a mock (`marketing-site/components/careers/ApplicationForm.tsx`) — decide if it should capture/send.

## Separate issues discovered (not fixed — out of scope)
- Careers form silently discards submissions (mock).
- Calendly script loads pre-consent + is undisclosed in the cookie policy.
- Marketing GA id + portal URLs are hardcoded (no env switch).
