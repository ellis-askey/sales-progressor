# Content & Personal Brand — Command Centre area

**Status:** Phases 1-3 complete (Thoughts, Brand memory, Inbox, Creation flow, Overview; Opportunities, Pillars+balance, Strategy+review; Composer, AI-tell detector, Voice learning). Phases 4-6 in progress. Spec created 2026-09-09.

**Phase 4-6 slice plan** (built on the same seams; parts that need real publishing/analytics integrations ship as honest "not connected" states until Ellis wires them, surfaced in ELLIS_MANUAL_TODO):
- **P4.1** Platform adaptation: one core post → LinkedIn (fullest) / Instagram (recommended visual treatment + caption) / Facebook (adapted, not cloned). `PostAdaptation` model, AI adapt endpoint, composer "Adapt for platforms".
- **P4.2** Media treatment suggestions: for a post, recommend the visual treatment and hand off to the existing image generator (text card / chart / screenshot / AI image).
- **P5.1** Calendar + pipeline: `DraftPost` gets a schedule status + scheduledFor; a calendar view with reschedule; "Scheduled" = prepared + a daily reminder digest (no auto-publish; Vercel Hobby-safe cron).
- **P5.2** Proposed weekly schedule + autopilot levels: AI proposes a week from inbox/opportunities/balance for wholesale approval; autopilot settings (manual → assisted → trusted → autopilot) + per-category approval, with the hard guardrails. Autopilot cannot publish until an integration exists (honest gate).
- **P6.1** Publishing seam + UTM: a publishing-provider abstraction with a "not connected" state (manual setup in ELLIS_MANUAL_TODO), and UTM tagging on any links so future attribution works.
- **P6.2** Performance + attribution: per-post performance view reusing `ContentEngagement`, audience-quality read, and PostHog-based "which posts drive the right visitors" with honest empty states until data exists.
**Surface:** Command Centre (`superadmin` only), routes under `app/command/(protected)/`.
**Owner decision:** Extend & absorb the existing content system · Phase 1 = Inbox + Brand Memory + Thoughts + creation flow · scheduling is "prepared + copy + reminder" until publishing APIs are wired (all confirmed by Ellis 2026-09-09).

---

## 1. What this is (and is not)

This is Ellis's **always-on personal PR / brand / content consultant** inside the Command Centre. Not a social scheduler, not an "AI writes a LinkedIn post" button.

The job, in order:
1. Continuously surface **real things worth talking about** (sourced from TSP data, product changes, customer questions, Ellis's own saved thoughts, industry events).
2. Help Ellis articulate **what he genuinely thinks** about them.
3. Turn those thoughts into **high-quality, recognisably-his** content.
4. Remove almost all the admin of publishing consistently.
5. Over time, deliberately build **Ellis Askey as a recognisable personal brand** and feed a learning flywheel.

**Success criterion.** Opening the page should feel like *"there are already several genuinely worthwhile things I could say — I just need to pick which one I agree is worth publishing."* Never *"I need to think of something for LinkedIn today."*

**Non-negotiables (carried into every phase):**
- **Source-first, never prompt-first.** The AI never invents substance. It identifies, shapes, and communicates substance that came from somewhere real.
- **Never invent Ellis's opinions, experiences, or beliefs.** The system may *suggest* a possible opinion but must never attribute it to Ellis until he approves it.
- **Claim honesty.** Every factual claim is classified: verified fact / Ellis opinion / inference / unverified. Data-backed claims retain their source (query, date range, sample size, figures). No TSP-data finding is extrapolated to "the whole UK market" without independent evidence.
- **No fake precision** ("AI predicts 9,700 impressions" is banned). Reach/engagement/authority signals are qualitative guidance with a stated reason.
- **No fake buttons.** Anything shipped works against real or typed-mock services (Law 13). "Scheduled" means *prepared + reminded* until real publishing exists.
- **Voice = Ellis's.** Plain English, direct, specific, occasionally funny, "I" for personal / "we" for TSP. The anti-AI banned-phrase list (see §6) is enforced.

---

## 2. What already exists (reuse map)

A working content subsystem already ships, hidden from the CC sidebar ("hide, not remove"). Phase work **extends and absorbs** it.

**Reuse directly:**
- 2-variant AI drafter, voice-calibrated — `lib/command/content/prompts/*`, `app/api/command/content/generate/route.ts` (Haiku).
- Voice corpus + 6-question intake — `VoiceSample`, `content/voice`, `lib/command/content/voice-questions.ts`.
- Tone/channel registries — `lib/command/content/{tones,channels}.ts`.
- Topic queue + AI topic generation from TSP milestone/pipeline data — `ContentTopic`, `app/api/cron/content-topics/route.ts` (currently **unscheduled**).
- Media generation: text cards, live-metric charts, AI images w/ budget cap + moderation — `ImageGenerator.tsx`, `app/api/command/content/images/*`, `GeneratedImage`, `image-budget.ts`.
- Manual engagement capture w/ paste-parser — `ContentEngagement`, `EngagementForm.tsx`.
- **Signal engine** + living-signal lifecycle + a `content-performance` detector — `lib/services/signals/*`, `Signal` model. Feeds daily/weekly briefs (`lib/services/insight/*`).
- Approval-first "AI proposes → human approves/dismisses" inbox pattern, proven for milestones — `MilestoneProposal`, `ProposalReview`, `app/actions/proposals.ts`. Template for the Content Inbox.
- CC UI kit — `components/command/ui/primitives.tsx` (`Section`, `KpiCard`, `TableShell`, `CardEmpty`, `TrackingDisabled`, `InsightCard`, `ParamTabs`…), `InfoTip`, superadmin gating (`hasSuperAdminPowers` / `assertSuperadmin`).

**Greenfield (this project builds):**
- Brand Memory + positioning model (structured, never-invented persona).
- Strategist / PR-consultant layer (what to be known for, overused/underused themes, breakout themes, Brand Opportunities).
- Content Inbox as a *place* (signal/topic/thought/manual → enriched item → Explore/Save/Dismiss/Not-me/Already-said).
- Source → Purpose → Angle → Format → Post creation flow.
- Evidence / claim inspector.
- Voice-learning-from-edits loop.
- Cross-platform adaptation (one idea → LinkedIn/IG/FB expressions), campaigns, calendar.
- Autopilot levels (manual → assisted → trusted → autopilot).
- Real publishing + performance pull + commercial attribution.

**Hard integration gaps (need Ellis's manual setup, tracked in `docs/active/ELLIS_MANUAL_TODO.md`):**
- No LinkedIn / Meta / Instagram / Facebook / Buffer / Ayrshare integration exists. Publishing today = "mark as posted" + email digest.
- Vercel **Hobby** plan → daily-cron limit; sub-daily/hourly scheduling needs Pro or an external cron hitting the route with `CRON_SECRET`.
- Replicate token still unset (AI images); voice samples still placeholder; Anthropic `web_search` tool not yet enabled on the org.

---

## 3. Information architecture

The area lives under `/command/content` as the umbrella, with the existing drafter re-homed into **Create**. Sidebar section **"Content"** (re-surfaced when Phase 1 ships), sub-items:

- **Overview** — compact operational summary + "Create something" CTA + top opportunities. (`/command/content`)
- **Inbox** — things worth talking about. (`/command/content/inbox`)
- **Thoughts** — "Things Ellis thinks", low-friction capture + global quick-add. (`/command/content/thoughts`)
- **Brand** — positioning + Brand Memory. (`/command/content/brand`)
- **Create** — Source → Purpose → Angle → Format → Post; wraps the existing drafter. (`/command/content/create`)
- **Voice** — existing voice corpus (kept). (`/command/content/voice`)
- **Calendar** — drafts / ready / approved / scheduled / published (Phase 5). (`/command/content/calendar`)
- **Strategy**, **Performance** — later phases.

---

## 4. Phase plan

Each phase ships something real and usable on its own. One concern per PR (Law 5); migrations to staging first (Law 3).

### Phase 1 — the "worth opening" spine (IN PROGRESS)
Delivers the success criterion without any external integration.

- **P1.1 — Thoughts + area shell.** `EllisThought` model + service; Thoughts page; global quick-capture available across the CC; re-surface the "Content" nav section. *No AI, no external deps.*
- **P1.2 — Brand Memory + Positioning.** `BrandProfile` + `BrandMemory` models + service; Brand page (editable positioning; memory entries classified fact/opinion/inference/unverified with suggested→approved lifecycle; add/edit/remove; "topics Ellis won't discuss"). Never-invent backbone.
- **P1.3 — Content Inbox.** `ContentInboxItem` model + builder service sourcing from the signal engine + `content-topics` + thoughts + manual; AI enrichment (why interesting / possible angles / likely audience / qualitative reach reason) via the Anthropic wrapper, with claim classification. Inbox UI: observation · why · source · evidence · audiences · freshness · Explore/Save/Dismiss/Not-me/Already-said. "Not me" / "Already said" teach Brand Memory. Schedule the inbox-refresh cron (Hobby-safe).
- **P1.4 — Creation flow.** Source → Purpose → Angle → Format → Post, guided; genuinely-different angles via AI; format recommendation; hands off to the existing drafter to produce the post; evidence/claim inspector seam alongside the draft.
- **P1.5 — Overview.** Operational summary (published this week / scheduled / ready / ideas available / posting consistency / next post) + "Create something" + top 3 opportunities.

### Phase 2 — Strategist / PR consultant
The higher-level layer that reviews Ellis's positioning like a good PR consultant. Sequenced so the most valuable, data-independent piece ships first (pre-launch there is no published history yet).

- **P2.1 — Brand Opportunities.** Reputation-building moves *beyond* individual posts: a position to establish, an article/series worth starting, a case study, a press/podcast angle, a debate to comment on. AI-generated from Ellis's positioning + approved memory + what he's recently posted + open thoughts (not raw per-agency signals, Law 20). Human pursue/dismiss; comment/article kinds hand off to the creation flow. Works now; doesn't need posting history.
- **P2.2 — Content pillars + balance.** Pillars as balance controls (not a rigid calendar). `DraftPost.pillar` set at compose time from purpose+angle; a balance view of the recent mix with a repetition warning ("4 of the last 6 referenced the product; publish something useful next"). Honest "not enough posts yet" state until history exists.
- **P2.3 — Rolling strategy + brand review.** A Strategy page: what to be known for this quarter (editable + AI-suggested), lean-into / overused / breakout / underused-expertise, and a periodic brand review. Grows richer as published + performance data accumulates.

### Phase 3 — Composer + voice learning
Premium calm composer; steering controls (Audience, Angle, Goal, Platform, Voice, Promotional intensity low→high); AI actions (More like me, More specific, Make the point stronger, Less polished, Shorter, Add evidence, Remove the sales pitch, Try another opening, Explain what changed); AI-tell detector; voice-learning from AI-draft→Ellis-final diffs (`VoiceSample.sampleType = "draft_edit_diff"` already exists) with anti-overfit + an inspectable/correctable learned profile.

### Phase 4 — Platform adaptation + media
One idea → LinkedIn (fullest) / Instagram (choose static/carousel/screenshot/data-graphic/short-video) / Facebook (adapted, not cloned). Deeper integration with TSP visual identity in `images/*`.

### Phase 5 — Calendar + autopilot (prepared/remind)
Draft/Ready/Approved/Scheduled/Published; drag/reschedule; proposed weekly schedule Ellis approves wholesale or edits; autopilot **levels** (manual → assisted → trusted → autopilot) with hard guardrails (never auto-publish unsupported claims, sensitive topics, unapproved new opinions/personal stories, major announcements). Until publishing APIs exist, "Scheduled" = prepared + reminder.

### Phase 6 — Publishing + performance + attribution (gated on Ellis's setup)
Real platform publishing (LinkedIn/Meta or Ayrshare-style broker), performance pull, audience-quality intelligence, experimentation ledger, UTM + PostHog commercial attribution (which posts → visitors → accounts → demos). Blocked until the integrations in §2 are set up; surfaced in ELLIS_MANUAL_TODO.

---

## 5. Data model (Phase 1)

New models (final field lists confirmed in migration). All Command-Centre-owned, no `agencyId`.

- **`EllisThought`** — `id, createdAt, updatedAt, body (raw), topic?, source ("manual"|"global_capture"|"inbox_notme"), status ("open"|"used"|"archived"), usedInDraftId?, relatedEvidence Json?`.
- **`BrandProfile`** — singleton-ish positioning doc: `id, updatedAt, primaryIdentity, credibility, personality, associations, targetAudiences Json, desiredReputation, editable free-text sections`. One active row.
- **`BrandMemory`** — `id, createdAt, updatedAt, kind (opinion|belief|anecdote|phrase_used|phrase_disliked|expertise|passion|position_change|frustration|humour|avoid_topic|successful_post|rejected_idea), body, claimClass (verified_fact|ellis_opinion|inference|unverified), status (suggested|approved|rejected), evidenceRef Json?, source ("manual"|"edit_learning"|"inbox_action"|"performance")`.
- **`ContentInboxItem`** — `id, createdAt, sourceType (product_data|customer_behaviour|recurring_issue|product_dev|saved_thought|customer_question|feedback|milestone|revisit|industry_news|manual), observation, whyInteresting, brandFit?, likelyAudience Json?, evidence Json? (dataset/query/sample/date-range for numeric claims), freshnessAt, suggestedAngles Json?, reachReason?, status (new|saved|dismissed|explored|already_said|not_me), decidedAt?, sourceSignalId?, sourceThoughtId?, draftPostId?`.

Reused: `DraftPost`, `VoiceSample`, `ContentTopic`, `ContentEngagement`, `GeneratedImage`, `Signal`, `ContentBatch`.

---

## 6. Voice & anti-AI rules (enforced by the drafter + AI-tell detector)

Voice: plain English; conversational but intelligent; sounds like someone inside UK property sales progression; direct not performatively controversial; specific not vague; natural occasional humour; doesn't over-explain basic property to agents; doesn't sound like a SaaS marketing dept; doesn't manufacture inspirational lessons; not every post is a list; not every post has a CTA; "I" personal / "we" company; never implies Ellis personally experienced something that's actually aggregated data.

Banned phrases/structures (detected + warned/rewritten): "Here's the thing", "Let that sink in", "Game changer", "In today's fast-paced…", "It's not X. It's Y.", "I learned an important lesson today", "Nobody talks about this", "Unpopular opinion", "Read that again", "Agree?", artificial cliff-hanger line breaks, one-sentence-per-paragraph-for-drama, unnecessary emojis, irrelevant hashtags, forced three-item lists, generic motivational conclusions, fake vulnerability, fake storytelling, fabricated quotes, made-up customer conversations. (No em-dashes — repo Law 21.)

---

## 7. Guardrails & enforcement

- Superadmin-only: every action/route calls `assertSuperadmin()` / `hasSuperAdminPowers` (commandDb is full-access; the DB layer won't protect you).
- Multi-tenant: content models are CC-owned, no agency scope; any read of TSP data for the inbox uses **anonymised aggregates** (platform-wide `DailyMetric`/`Signal`, never named-agency/customer data in user-facing copy — Law 20).
- Migrations: staging first, verify, then prod (Law 3).
- Voice gate: no em-dashes; VOICE.md rules on all user-facing strings (Law 21).
- No auto-publish anything until Ellis explicitly enables it; autopilot guardrails in Phase 5.
