# ADMIN_10 — Friction Detection (PostHog)

**Audience:** Claude Code + you
**Status:** Draft
**Depends on:** ADMIN_02 (`Event` table for cross-correlation), ADMIN_07 (signals can ingest friction patterns)
**Implements:** the friction signals on `/command/activity` and `/command/insights` + the PostHog instrumentation layer

---

## 1. What this is

Detection of behavioural friction inside the product: rage clicks, dead clicks, abandon points in flows, long pauses, back-and-forth navigation. The kind of "users tried to do X and gave up" signal that doesn't show up in completion metrics — because a user who gives up doesn't generate a completion event at all.

This is the layer that turns "40% drop at Add Solicitor" from a number into "and here's what they actually did before giving up — they clicked the dropdown 5 times, scrolled up and down, clicked Cancel."

---

## 2. The decision: PostHog (cloud, EU region)

The choice was between:

| Option | Why not |
|---|---|
| Plausible | Page-view analytics. Doesn't capture clicks, sessions, or behavioural events. Wrong shape for friction detection. |
| Self-build | Real friction detection (rage click clustering, abandon-point analysis, session reconstruction) is months of work for a solved problem. Don't reinvent. |
| Vercel Analytics | Aggregate web vitals only. Same wrong-shape problem as Plausible. |
| FullStory / Hotjar | Full session replay. Heavy on PII risk. Pricier. Overkill for v1. |

**PostHog (EU cloud region)** wins for three reasons:

1. **Right shape.** Native rage-click detection, session recordings (toggleable, not required), funnel analysis, retention cohorts, autocapture of clicks/forms/inputs.
2. **EU region keeps the data story clean.** Per DATA_PROCESSING_OVERVIEW.md the Supabase region is TO CONFIRM but likely EU. Adding PostHog EU keeps everything in-region. PostHog has a UK/EU DPA available and is GDPR-compliant out of the box.
3. **Self-hosting escape hatch.** If costs balloon or you want to bring it in-house later, PostHog is open-source. Switching is config, not migration.

PostHog is added to the data processing record as a new subprocessor. Update DATA_PROCESSING_OVERVIEW.md §11 when this ships:

| Subprocessor | Purpose | Personal data involved | DPA signed? |
|---|---|---|---|
| PostHog (EU cloud) | Behavioural analytics + session recording | User IDs, click events, page paths, optionally session recordings | NEEDS DPA SIGNED before ship |

---

## 3. What gets captured

### 3.1 Autocapture (default)

PostHog's autocapture script records:
- Page views with path
- Clicks on every element (with selector + text)
- Form submissions
- Input focus / blur (without input contents — see §6 PII)

Drop-in via `posthog-js` SDK in the root layout. Identified to the same `userId` as the application uses, with `agencyId` as a person property. SP/PM operating mode as a person property.

### 3.2 Custom events (selective instrumentation)

Some events benefit from explicit tracking even with autocapture:

| Event | When fired | Why explicit |
|---|---|---|
| `funnel.add_solicitor.started` | User opens the Add Solicitor modal | Anchors funnel measurement |
| `funnel.add_solicitor.completed` | Solicitor saved | Pair with .started for drop-off rate |
| `funnel.add_solicitor.abandoned` | Modal closed without save | Explicit abandon signal |
| `friction.field_corrected_3x` | Same field edited 3+ times | Indicates confusion |
| `friction.scroll_thrash` | 5+ rapid scroll direction changes | Lost / scanning |

Custom events are also written to the application's `Event` table (per ADMIN_02 §3) so cross-correlation in the command centre doesn't require a PostHog query for everything.

### 3.3 Session recording — opt-in only, off by default

Session recording is the highest-PII feature PostHog offers. Default: **disabled**. Can be enabled later per these constraints:

- Sample rate ≤ 5%, never 100%
- Inputs masked (`<input>` contents never captured)
- Specific elements masked via `ph-no-capture` class on anything showing PII (property addresses, contact names, financial figures)
- Recordings deleted after 30 days
- Customer-facing privacy notice updated to mention recordings before enabling
- Audit log entry for any admin who watches a recording

When enabled (post v1), the `Audit` tab logs every recording view.

---

## 4. What surfaces in the command centre

The command centre doesn't replace the PostHog UI — PostHog has its own (good) interface. What we surface is the small set of friction signals that should drive Insight Engine recommendations:

### 4.1 Friction summary card on Overview

```
┌─ Friction signals (last 7d) ─────────────────────────────┐
│ 12 rage-click clusters detected on /transactions/[id]    │
│ 47% abandon rate at Add Solicitor (n=83)                  │
│ 23 sessions with scroll thrash on milestone list          │
│ → View in PostHog                                          │
└──────────────────────────────────────────────────────────┘
```

All four are computed via PostHog's API, cached for 5 minutes. Click → opens PostHog in a new tab to the relevant insight.

### 4.2 Friction signals fed into Insight Engine

PostHog API queries run as part of Insight Engine signal detection (ADMIN_07 §3). New signal types:

- `rage_click_cluster` — recurring rage clicks on the same element
- `funnel_abandonment` — drop-off rate at a tracked funnel step exceeds threshold
- `session_friction` — sessions with multiple friction indicators (rage clicks + scroll thrash + form errors)

These appear in the daily brief alongside the deterministic signals. Confidence scoring uses sample sizes from PostHog.

### 4.3 Drop-off chain on Activation tab

ADMIN_03 §4.1 already specifies a funnel. PostHog data lets us go beyond counts to "what users did at the abandoned step":

```
Add Solicitor (started)        ─── 100
  └─ Field "firm name" focused ─── 94
      └─ Typed > 3 chars       ─── 71
          └─ Field corrected 2+x ─ 28
              └─ Saved          ─── 18
              └─ Cancelled      ─── 53
```

This level of detail is what makes "40% drop at Add Solicitor" actionable.

---

## 5. Performance and cost guardrails

PostHog is event-billed. Cost can spiral if uncontrolled.

- Autocapture set to **conservative** mode — clicks and form events only, not every mouseover
- Session recording **disabled** in v1
- Sample autocapture at 100% in dev / 100% in prod (low traffic for now); revisit if monthly events exceed PostHog's free / paid tier thresholds
- A budget alert in PostHog itself: warn at 80% of monthly tier
- A `posthog.spend.tracking` signal in Insight Engine flags overage trends

The PostHog SDK is loaded async with `defer` so it doesn't block first paint. If PostHog's CDN is unreachable, the app continues to work — analytics is best-effort, never load-bearing.

---

## 6. PII discipline

This is the single biggest area to get right.

### 6.1 Never sent to PostHog

- Email content
- Property addresses
- Contact names (any field value)
- Financial figures (sale prices, fees)
- Document file names if they contain PII
- Anything from `OutboundMessage.body`
- Any input value typed into a form

### 6.2 Sent to PostHog as IDs only

- `userId`
- `agencyId`
- `transactionId` (as event property when relevant — the ID, not the address)

### 6.3 Sent to PostHog as low-cardinality categorical

- `serviceType` (sp / pm) — for transaction-scoped events; `modeProfile` for agency-scoped
- `userRole` (admin / progressor / agent / etc.)
- `signupSource`
- Page path templates (`/transactions/[id]`, not `/transactions/abc123`)

### 6.4 Implementation enforcement

A wrapper module `lib/analytics/posthog.ts`. The application calls this wrapper, not PostHog directly. The wrapper has a strict allow-list of event property names. Any property not on the list is dropped with a warning.

ESLint rule: `no-direct-posthog-import` fails CI if any file outside `lib/analytics/` imports from `posthog-js`.

A nightly check job hits PostHog's API to scan for high-cardinality property values that look like leaked PII (long strings, email-shaped strings, postcode-shaped strings) and alerts in `AdminAuditLog` if any are found.

---

## 7. Cookie / consent

Per DATA_PROCESSING_OVERVIEW §16, no cookie notice currently exists. PostHog requires either:

- (a) Consent before tracking — implement a cookie banner, gate PostHog initialisation on consent
- (b) Legitimate interest basis with transparent privacy notice — possible for B2B SaaS but legally risky without DPO sign-off

**Recommendation:** path (a). Cookie banner + consent. Slight friction at signup, but it makes the GDPR posture defensible. Banner gates PostHog only — application functionality works regardless of consent. Defaults to "essential cookies only" until user opts in.

This also unblocks any future analytics or personalisation work — consent infrastructure becomes available for everything, not just PostHog.

---

## 8. The PostHog config (concrete)

```ts
// lib/analytics/posthog.ts (sketch)

import posthog from 'posthog-js'

const ALLOWED_EVENT_NAMES = new Set([
  'funnel.add_solicitor.started',
  'funnel.add_solicitor.completed',
  'funnel.add_solicitor.abandoned',
  'friction.field_corrected_3x',
  'friction.scroll_thrash',
  // ...
])

const ALLOWED_PROPS = new Set([
  'agencyId', 'transactionId', 'serviceType', 'userRole',
  'signupSource', 'pagePath', 'fieldName',
])

export function init(consent: boolean) {
  if (!consent) return
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: 'https://eu.i.posthog.com',
    autocapture: true,
    capture_pageview: true,
    disable_session_recording: true,        // off in v1
    mask_all_text: true,
    mask_all_element_attributes: true,
    person_profiles: 'identified_only',
  })
}

export function identify(userId: string, props: Record<string, unknown>) {
  if (!posthog.__loaded) return
  posthog.identify(userId, sanitize(props))
}

export function track(event: string, props: Record<string, unknown> = {}) {
  if (!posthog.__loaded) return
  if (!ALLOWED_EVENT_NAMES.has(event)) {
    console.warn('Disallowed PostHog event:', event)
    return
  }
  posthog.capture(event, sanitize(props))
}

function sanitize(props: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (!ALLOWED_PROPS.has(k)) continue
    out[k] = v
  }
  return out
}
```

The shape matters more than the literal code. The point is: a single chokepoint, an allow-list, no direct SDK access from application code.

---

## 9. Decisions required from you

- [ ] **Sign PostHog DPA** — before any production traffic hits PostHog. Required.
- [ ] **EU region confirmed** — `eu.i.posthog.com` not US. Locked above; just confirm you're happy.
- [ ] **Session recording in v1?** — recommend no. Confirm.
- [ ] **Cookie banner copy** — needed before launch. Can be drafted by you or a quick template provided.
- [ ] **Initial funnel definitions** — list 3–5 critical funnels to instrument first (recommend: signup, add first transaction, add solicitor, send first chase, complete first milestone).
- [ ] **Budget alert threshold** — default warn at 80% of paid tier. Adjust if you want earlier warning.

---

## 10. Out of scope for v1

- Session recording (defer; design supports turning on later)
- Heatmaps (PostHog supports but adds capture overhead — defer)
- A/B testing via PostHog (PostHog has feature flags + experiments — defer until ADMIN_08 needs them)
- Surveys via PostHog (use ADMIN_01 §15 feedback mechanism for now)
- Custom dashboards inside PostHog (use PostHog's UI for deep dives; command centre surfaces only top-level signals)
- Server-side event tracking (autocapture on client only in v1; server events go via the existing `Event` table)
