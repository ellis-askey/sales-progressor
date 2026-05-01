# ADMIN_05 — LinkedIn Automation

**Audience:** Claude Code + you (decisions required before build)
**Status:** Draft — requires your decisions in §3 and §10 before implementation
**Depends on:** ADMIN_02 (`OutboundMessage`), ADMIN_04 (Outbound Log shows posts)
**Implements:** the `/command/content` tab + the publishing pipeline

---

## 1. Goals

You said: modes 2 and 3 to start, with a toggle to enable mode 4. Translating:

- **Mode 2 — Draft only:** AI drafts a post. You review and post manually. The system records the draft.
- **Mode 3 — Draft + scheduled approval:** AI drafts a post, schedules it for a future slot, you receive an approval prompt. On approval, the system publishes via API. On rejection or no action, it does not publish.
- **Mode 4 — Fully automated:** AI drafts and publishes on schedule, no human in the loop. Toggle-on per content stream.

All modes write to `OutboundMessage` (channel `linkedin`) so everything appears in the Outbound Log (ADMIN_04).

The non-goals are equally important:

- Not a multi-platform scheduler (Twitter/X may come later but is not in scope)
- Not a content management system (no rich-text editor, no image library beyond what each post needs)
- Not an analytics platform (basic engagement only — impressions, reactions, comments — pulled from LinkedIn's API)

---

## 2. Three modes, one pipeline

The pipeline shape is the same for all three modes. What differs is which steps are automated vs gated on human action.

```
1. Trigger        → 2. Draft generated → 3. Scheduled?       → 4. Approval gate?    → 5. Publish        → 6. Track
   (cron / manual)    (Claude prompt)      (set scheduledFor    (yes for mode 3,        (LinkedIn API       (poll for
                                            or null)              skip for 2 and 4)      or "manual" sink)   engagement)
```

| Step | Mode 2 (draft only) | Mode 3 (approval) | Mode 4 (automated) |
|---|---|---|---|
| 1. Trigger | Manual ("draft me a post") | Cron schedule | Cron schedule |
| 2. Draft | Claude generates | Claude generates | Claude generates |
| 3. Schedule | None | Slot picked from your posting calendar | Slot picked from your posting calendar |
| 4. Approval | Implicit — you publish manually | Required, alert sent N hours before scheduled time | Skipped |
| 5. Publish | Manual via LinkedIn directly | LinkedIn API (after approval) | LinkedIn API (no human) |
| 6. Track | You record manually if you want engagement data | Auto-pulled | Auto-pulled |

Mode 4 is the toggle. Default off. Enabled per "content stream" (see §6) so you can automate one type of post (e.g. weekly product updates) while keeping another (e.g. founder commentary) on approval gating.

---

## 3. LinkedIn API decision `[DECISION REQUIRED]`

This is the single biggest decision in the doc. Three viable paths:

### Path A — LinkedIn's official Marketing API (Posts API)

- Direct API access, official channel
- Requires creating a LinkedIn App, requesting `w_member_social` scope, OAuth 2.0 user authorization
- App may need to go through LinkedIn's review process for some scopes (read-only is easier; posting on behalf is more scrutinised)
- Lead time: weeks (review can be slow)
- Cost: free
- Long-term most reliable

### Path B — Third-party scheduler API (Buffer, Hootsuite, Publer, Postiz, etc.)

- Treat the third-party as the publishing layer; we just push drafts and schedules to them
- They've already done the LinkedIn auth dance
- Faster to ship: days, not weeks
- Cost: monthly subscription per provider, varies (£10–£50/mo typical)
- Trade-off: another vendor in the data path; webhook dependence for status; brand limitation — you're using their pipes
- **Postiz** is open-source and self-hostable if vendor lock-in is a concern

### Path C — Browser automation (Playwright headless against linkedin.com)

- No API, you log in as you and post
- Brittle (LinkedIn changes UI, breaks the scraper)
- Against LinkedIn's ToS
- **Don't.**

**My recommendation:** Path A for the long term. Path B for the first 90 days while LinkedIn app review is in progress.

The data model is identical for both — `OutboundMessage` with `channel = linkedin` and a `providerMessageId` that's either a LinkedIn URN (Path A) or a Buffer/Postiz update ID (Path B). Switching providers later is a config change, not a schema change.

<!-- decision needed from you -->

The rest of this doc assumes the abstraction holds and refers to the publishing layer as "the publisher." Implementation in `lib/command/publishers/{linkedin,buffer,postiz}.ts` — one interface, multiple implementations.

---

## 4. The draft generation flow

Same pattern as the existing chase generation (per DATA_PROCESSING_OVERVIEW.md §7 Flow 1) — Claude Haiku 4.5 via Anthropic API.

### Inputs to the draft prompt

- Content stream (see §6) — defines tone, length, audience
- Topic seed — either user-provided or auto-derived from recent activity (see §5)
- Last N posts published in this stream (for variety / not repeating yourself)
- Recent product activity worth talking about (e.g. "exchanged 12 properties this week" — only included if the stream is "milestone-marketing" type)
- Any explicit founder voice notes you've stored as part of the stream config

### Prompt template

Stored in `lib/command/prompts/linkedin-draft.ts`, version-tagged. When the prompt changes, the version increments. Every generated draft records `aiPromptVersion` on `OutboundMessage` so you can later analyse "which prompt version did better."

### Output

A single LinkedIn post body (plain text + `\n\n` paragraph breaks; LinkedIn doesn't render markdown). 600-token cap. Written to `OutboundMessage`:

```
{
  channel: 'linkedin',
  status: 'draft' | 'scheduled' | 'queued',
  body: <generated text>,
  isAiGenerated: true,
  aiModel: 'claude-haiku-4-5-20251001',
  aiPromptVersion: 'v3',
  aiTokensInput, aiTokensOutput,
  requiresApproval: <depends on mode>,
  scheduledFor: <if mode 3 or 4>,
}
```

### Safety

A short post-generation safety check (regex + simple LLM-as-judge) before any auto-publish (mode 4):

- No claims about specific people unless explicitly named in source
- No financial advice patterns
- No discriminatory language
- No external URLs not in an allow-list
- No content longer than 3,000 characters (LinkedIn limit)

If safety check fails: drop into approval queue regardless of mode. Surfaces as "auto-publish blocked, needs review" badge in the UI.

---

## 5. Topic sourcing

Mode 4 needs topics without you typing them every time. Three sources, in priority order:

### 5a. Topic queue (manual)

You add topic seeds in advance. Plain text, optionally with a target stream and target date.

```
"Why we built the exchange-day reconciliation flow" → product-stories → next Tue
"Three things every progressor wishes solicitors knew" → industry-pov → no date
```

The system pulls from this queue first when generating drafts.

### 5b. Data-derived content pipeline

A daily job scans `Event`, `DailyMetric`, `WeeklyCohort`, and `Signal` (from ADMIN_07) for content-worthy patterns. When a pattern is detected, the system doesn't just surface a topic — it generates **a full content artefact**: post, hook, visual idea, scripts.

Example pattern detection: "average time from listing to exchange across the platform = 112 days."

Generated artefacts:

```
Insight: Average time to exchange = 112 days
─────────────────────────────────────────────
[ LinkedIn post ]
"112 days. That's how long the average UK property sale takes
right now from offer accepted to exchanged. Here's what's actually
happening in those four months..."
[full draft, ~150 words]

[ Hook variants for testing ]
1. "112 days. Most people have no idea."
2. "Why does it take 112 days to exchange a house?"
3. "Here's where 112 days goes when you sell your home."

[ Visual idea ]
Stacked-bar timeline showing typical phases:
- Offer to memorandum: 7 days
- Memo to draft contracts: 21 days
- Searches: 28 days
- Enquiries: 35 days
- Mortgage offer: 14 days
- Exchange ready: 7 days
Tool suggestion: Figma or Canva, brand colours from theme.

[ TikTok / Reel script (30s) ]
[Hook 0-3s]: "Buying a house takes 112 days. Here's why."
[Body 3-25s]: ...
[CTA 25-30s]: ...
```

Pattern detectors that fire content generation:

- Volume milestones (100th transaction, 500th, 1000th exchange, etc.)
- Time-based aggregates (avg time to exchange, fastest exchange, longest stuck)
- Anomalies worth talking about (unusual region performance, seasonal trends)
- Aggregate cohort patterns (e.g. "agencies onboarding in spring close 22% faster")
- Customer-facing product launches (from `Deployment.releaseNotes`)
- Featured insight from ADMIN_07's weekly review

Each generated artefact lands in your approval queue tagged with the source pattern and a confidence score. Mode 4 auto-publishes only if confidence is high AND the source pattern is in your approved-for-auto list.

**Privacy guard:** No data-derived content may name a specific agency, transaction, or person. The detector outputs aggregate patterns only. Content generation prompt is constrained to use aggregate language ("UK property sales typically..." not "Smith & Co Estate Agents typically..."). Violation in generated output → reject and regenerate.

### 5c. Industry signal monitoring (out of scope v1)

Flagged but not built. Would consume RSS / news feeds to surface industry events. Don't build until v1 has been in use for a quarter.

---

## 6. Content streams

A "stream" is a named recurring posting pattern. Each stream has:

```ts
type ContentStream = {
  id: string
  name: string                          // "Founder commentary"
  description: string
  cadence: 'daily' | 'weekly' | 'twice_weekly' | 'monthly' | 'on_demand'
  preferredSlots: WeeklySlot[]          // e.g. [{day: 'tue', hour: 9}, {day: 'thu', hour: 14}]
  voice: string                         // free-text style instructions fed into prompt
  targetLength: 'short' | 'medium' | 'long'  // 50 / 150 / 300 words approx
  publisherAccount: string              // which LinkedIn account (you, company page, etc.)
  mode: 'draft_only' | 'approval' | 'automated'
  topicSourcePriority: TopicSource[]    // ordered list of where topics come from
  active: boolean
}
```

Stored in a new `ContentStream` Prisma model. You can have multiple streams running in parallel — one might be daily founder takes (mode 3 approval), another weekly product updates (mode 4 automated).

Each stream tracks its own performance in the Content tab (see §8).

---

## 7. Scheduling and the publishing job

A cron job runs every 5 minutes. For each `OutboundMessage` with `channel = linkedin AND status = scheduled AND scheduledFor <= now()`:

1. Lock the row (`status = queued`)
2. If `requiresApproval = true AND approvedAt IS NULL`: skip, leave queued. (An approval reminder job runs separately — see below.)
3. If approved or no approval needed: hand to the publisher implementation
4. Publisher returns `providerMessageId`, sets `status = sent`, `sentAt = now()`
5. On failure: `status = failed`, `failureReason` populated, `failedAt = now()`. Retry policy: 1 retry after 5 min, then human-review.

### Approval reminder job

A separate job, every 15 minutes:

- Find scheduled posts with approval required, scheduled within next 4 hours, not yet approved
- Send an in-app + email notification (to you) with link to approve/reject
- Send a final reminder 30 min before scheduled time
- If still not approved at scheduled time: status stays `queued`, no publish happens, surfaces in UI as "missed window — review and reschedule"

---

## 8. The Content & Social tab UI

Three sections:

### 8.1 Stream control panel

A card per content stream, showing:

- Name, mode (with a clear visual indicator and a switch)
- Cadence + next scheduled slot
- Posts published this week / last week
- Average engagement (likes + comments + shares per post, last 30d)
- Active/paused toggle
- "Generate now" button (manual draft)

The mode 4 toggle on each stream has a confirmation dialog: *"Automated posts will publish without your review. Are you sure?"* — this is the kind of decision easy to fat-finger.

### 8.2 Approval queue

List of drafts awaiting your review. Each row:

- Scheduled time (with "in N hours" relative)
- Stream name
- First 200 chars of body
- Buttons: Approve / Edit / Reject / Reschedule

Click → full preview with edit-in-place. Edits update `body`, set `isAiGenerated = true` and a new column `editedByHuman = true` so you can later analyse "do my edits perform better than raw AI output."

### 8.3 Performance

A table of every post published in last 90 days:

- Stream
- Published at
- Body excerpt
- AI / human-written / AI-edited
- Impressions, reactions, comments, shares (pulled from LinkedIn API)
- Engagement rate

Sortable. Clickable to drill into the post (links to the live LinkedIn URL + the `OutboundMessage` record).

Plus a chart: posts published per stream per week, overlaid with engagement.

---

## 9. Topic queue UI

Simple. A list view inside the Content tab:

```
[Add topic]
─────────────────────────────────────
"Why we built ..."     → product-stories      | next Tue 09:00 | [edit] [delete]
"Three things ..."     → industry-pov         | (any slot)      | [edit] [delete]
```

Drag to reorder priority. Each topic is consumed when used — moves to a "used" archive with a link to the resulting post.

---

## 10. Decisions required from you `[DECISION REQUIRED]`

Before this gets built:

- [ ] **Path A vs Path B vs both** — which publisher to ship first
- [ ] **LinkedIn account(s)** — your personal page only? A company page too? Both?
- [ ] **Posting cadence ceiling** — what's the maximum you want to publish per week per account? (LinkedIn algorithmic punishes spam)
- [ ] **Default posting times** — when does your audience read? Default suggestion: Tue/Thu 09:00 + 14:00 London
- [ ] **Initial streams** — list 2–4 stream names + cadences to seed
- [ ] **Voice samples** — paste 5–10 of your best existing LinkedIn posts (or written voice samples) for the prompt to ingest as style reference
- [ ] **Anthropic prompt approval** — review the draft prompt template before first generation goes live
- [ ] **Mode 4 auto-publish budget** — max number of automated posts per week before pausing for review (sanity cap)
- [ ] **Reaction to safety-check failures** — should auto-publish blocked posts ping you immediately or batch nightly?

---

## 11. Out of scope for v1

- Twitter/X publishing (same shape, different API, defer)
- Image generation for posts (text-only initially)
- Carousel posts (single-image LinkedIn carousels are a separate API path)
- Comment / reply automation (do not build, ever — LinkedIn ToS hostile)
- Cross-posting from blog / RSS (defer)
- A/B testing prompt variants (the data is captured via `aiPromptVersion` for later analysis; live A/B harness is post-v1)
- Detailed audience analytics (LinkedIn's API for this is heavily restricted)
