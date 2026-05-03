# Ellis — Manual TODO

**This file tracks every manual task that requires Ellis (the founder) personally — things Claude Code cannot do. Tasks are added by CC during builds whenever a manual step is needed. Tasks get struck through as completed (don't delete; we want a record of what's been done).**

**Maintenance rule:** When CC ships a PR that requires founder action, CC must add the action to this file. When Ellis completes a task, strike it through with `~~` markdown but leave it visible.

Last updated: 2026-05-03

---

## Quick wins (under 10 minutes each)

- [ ] **TOTP activation** — visit `/command/setup-2fa`, scan QR with authenticator app, enter code. Without this, `/command/*` is unreachable.
- [ ] **Replicate signup + API token** — sign up at replicate.com, create an API token, add `REPLICATE_API_TOKEN` to Vercel production env vars. Unblocks AI image generation in `/command/content`.
- [ ] **Verify the test email actually arrived** — check `inbox@thesalesprogressor.co.uk` for the SendGrid-delivered batch email from 2026-05-03 08:11 UTC. SendGrid says delivered; confirm it actually reached the inbox.

---

## Account signups + DPAs (~30 minutes total)

- [ ] **PostHog (EU instance)**
  - Sign up at `eu.posthog.com`
  - Create project named `salesprogressor`
  - **Sign DPA in Settings → Project → Compliance** (this is the legal requirement)
  - Copy Project API Key (starts `phc_`)
  - Add to Vercel production env: `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`

- [ ] **Upstash Redis (free tier)**
  - Sign up at upstash.com
  - Create database in eu-west-1 region
  - Copy REST URL and token
  - Add to Vercel production env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - Optional: set `RATE_LIMIT_ENABLED=true` to activate (default: disabled)

- [ ] **Vercel deploy webhook**
  - Vercel project → Settings → Webhooks (or Deploy Hooks for newer projects)
  - Add webhook to `https://portal.thesalesprogressor.co.uk/api/webhooks/vercel-deploy`
  - Event: "Deployment Succeeded"
  - Copy signing secret → add to Vercel production env as `VERCEL_WEBHOOK_SECRET`
  - Unblocks the Health tab's deployments section in `/command`

- [ ] **SendGrid verified sender**
  - Confirm `updates@thesalesprogressor.co.uk` is verified
  - Confirm `inbox@thesalesprogressor.co.uk` forwards correctly to your inbox
  - Verify the daily content batch email actually reaches you

---

## Legal — DPAs to sign (1–2 hours, can be batched)

- [ ] **Anthropic** — sign DPA via Anthropic console, request zero-data-retention agreement for the API account if available
- [ ] **SendGrid (Twilio)** — sign DPA via SendGrid account / Twilio legal records
- [ ] **Vercel** — sign DPA via account settings
- [ ] **Supabase** — sign DPA via Supabase dashboard (Settings → Compliance)
- [ ] **PostHog** — done as part of PostHog signup above
- [ ] **Replicate** — confirm if DPA available; depends on data sent (image prompts only, no PII expected)
- [ ] **Upstash** — confirm DPA available; rate-limit counters only, no PII

---

## Decisions and reviews (1–2 hours, founder thinking time)

- [ ] **Voice samples — write in your actual voice**
  - Currently filled with ChatGPT-generated placeholder text
  - Visit `/command/content/voice` and rewrite all 6 question answers
  - Spend 60–90 minutes; write like you'd tell a friend over a pint, not polished prose
  - The quality of every drafter output for the next year depends on this

- [ ] **Post one drafted-edited LinkedIn post manually**
  - Generate a draft, edit heavily, post manually to LinkedIn
  - This is the experiment that tells us whether the bottleneck is voice/topic/distribution/something else
  - Don't expect engagement — just do it once to see how it feels

- [ ] **Privacy / cookie / terms pages — legal review**
  - PR 55 produced factual content with `<!-- LEGAL REVIEW REQUIRED -->` markers
  - Send `app/privacy/page.tsx`, `app/cookie-policy/page.tsx`, `app/terms/page.tsx` to a UK tech lawyer
  - Budget: £500–2000
  - The markers tell the lawyer which sections specifically need their input

- [ ] **Confirm "Talk to us" email destination** for the trial paywall (Package A1)
  - When trial ends and user hits paywall, the modal CTA opens an email link
  - Decide: `hello@thesalesprogressor.co.uk`? Different address?

- [ ] **Confirm welcome + warning email copy** before Package A1's trial emails go live
  - Welcome email (sent on signup)
  - Day 7 warning ("How's your trial going?")
  - Day 12 warning ("Your trial ends in 2 days")
  - Day 14 warning ("Your trial ends tonight")
  - CC will produce drafts; Ellis reviews and approves before they go live

- [ ] **Test the full Package A1 trial flow manually** when shipped
  - Sign up with a fresh email
  - Walk through the trial (or fast-forward via superadmin trial-end action)
  - Confirm paywall behaviour
  - Convert to paying via superadmin
  - Confirm paywall disappears

- [ ] **List your first 50 target estate agencies**
  - Real, named, specific (not "estate agencies in Manchester" — actual names)
  - Mix of sizes (10–50 sales/year, 50–200, 200+) so you can learn which segment converts
  - Source: Google Maps + Rightmove + your own judgement
  - When the outreach CRM ships, these become your initial prospect list

---

## Future, deferred, not urgent

- [ ] External penetration test or security review (pre-launch, requires human security firm)
- [ ] Engage with industry communities (Property Industry Eye, The Negotiator, Propertymark LinkedIn groups) — 30 min/day
- [ ] Decide on Vercel Pro upgrade ($20/mo) when you want sub-hourly cron granularity (`/api/cron/metrics-5min` is built but unwired pending this)
- [ ] Decide whether to enable strict RLS in Supabase (currently bypass policies in place; full activation = future sprint per `docs/TODO.md`)

---

## How this file works

- Every time CC builds something requiring founder action, CC adds the task here with enough detail that Ellis can do it without asking for clarification
- Tasks include: where to go (URL or location), what to do, why it matters, what env var to set or what action to take afterwards
- When Ellis completes a task, strike through with `~~` markdown — keep visible for record
- When a category becomes empty, leave the heading; new tasks of that category may arrive later
- This file replaces ad-hoc "manual task appendices" surfaced at end of build runs
