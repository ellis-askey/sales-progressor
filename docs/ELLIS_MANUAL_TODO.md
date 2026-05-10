# Ellis — Manual TODO

**This file tracks every manual task that requires Ellis (the founder) personally — things Claude Code cannot do. Tasks are added by CC during builds whenever a manual step is needed. Tasks get struck through as completed (don't delete; we want a record of what's been done).**

**Maintenance rule:** When CC ships a PR that requires founder action, CC must add the action to this file. When Ellis completes a task, strike it through with `~~` markdown but leave it visible.

Last updated: 2026-05-10

---

## Partners page & broker feature — two database migrations required

Apply **both** migrations in order (staging first, then production). Both are additive and non-breaking.

---

### Migration 1 of 2 — broker models

Migration file: `prisma/migrations/20260510000001_broker_models/migration.sql`

Adds: `BrokerFirm`, `BrokerContact`, `AgencyPreferredBroker` tables; four broker columns on `PropertyTransaction`.

```bash
# Set DATABASE_URL to the STAGING direct connection URL (not pooler)
DATABASE_URL="postgres://postgres:..." npx prisma migrate deploy
```

Verify on staging:
- [ ] `/agent/partners` loads without errors
- [ ] Director can add a preferred broker (full card: firm, contact, phone, email, website)
- [ ] New sale form Stage 2 "Solicitors & Broker" shows broker picker pre-filled from preference
- [ ] `brokerFirmId` column visible in Supabase table editor on `PropertyTransaction`

---

### Migration 2 of 2 — broker website + referral flag

Migration file: `prisma/migrations/20260510000002_broker_website_referral/migration.sql`

Adds: `website TEXT` on `BrokerFirm`; `purchaserBrokerReferral BOOLEAN DEFAULT FALSE` on `PropertyTransaction`.

```bash
# Same DATABASE_URL as above (still STAGING)
DATABASE_URL="postgres://postgres:..." npx prisma migrate deploy
```

Verify on staging (after both migrations applied):
- [ ] `/agent/partners` broker card shows website link when set
- [ ] New sale form — select Mortgage + pick a broker → "Purchaser referred to [broker name]?" checkbox appears
- [ ] Submit a mortgage transaction with the checkbox ticked → property file sidebar shows "Purchaser referred to broker" badge

### Production

Once both verified on staging:

```bash
# Set DATABASE_URL to the PRODUCTION direct connection URL
DATABASE_URL="postgres://postgres:..." npx prisma migrate deploy
```

---

## New sale flow v2 — staged rollout playbook (Phase E complete)

**Phase E is shipped. Mobile polish is done. The flow is production-ready behind the feature flag. Read this section before flipping the flag.**

### Staging rollout (do this first)

- [ ] **Enable on staging** — in Vercel dashboard → salesprogressor project → Settings → Environment Variables → staging environment: add `NEXT_PUBLIC_NEW_SALE_V2=true`. Redeploy staging (or trigger a redeployment from the Deployments tab).
- [ ] **Smoke test on staging** — run the full checklist below before touching production.

### Smoke test checklist (staging, then production)

Run these after each flag flip:

1. **MOS upload flow** — drop a real MOS PDF onto the hero zone. Confirm extraction runs (spinner shows), form fills with address/price/solicitors/contacts. Confirm no console errors.
2. **Submit from extracted path** — fill in Purchase Type (not on MOS), click "Create transaction". Confirm redirect to `/agent/transactions/[id]?mosConfirmed=1`. Confirm VM2 and PM2 are marked complete in the milestones panel.
3. **Submit from manual path** — click "Prefer to fill in manually", complete Stage 1, click Continue, fill in contacts and details, click "Create transaction". Confirm redirect with `?newFile=1`. Confirm milestones initialised (no VM2/PM2 auto-confirm).
4. **Outsourced validation** — in manual mode, select "Send to progressor", submit without contacts. Confirm error appears on the Vendors section. Fix and resubmit.
5. **Duplicate address** — create a transaction, then try to create another with the exact same address. Confirm the duplicate modal appears with "View existing file" and "Create anyway". Test both paths.
6. **Draft round-trip** — start filling in the form (manual path), click "Save draft", navigate away. Return to `/agent/transactions/new-v2`. Confirm draft appears in the panel. Load it. Confirm form pre-populated and advanced to Stage 2 if Stage 1 was complete.
7. **Draft auto-save on MOS** — upload a MOS. Confirm a draft appears in the panel immediately after extraction (before you fill in anything else). Navigate away and return — draft still there.
8. **Mobile contacts layout** — resize browser to 375px. Confirm Vendors and Purchasers stack vertically (not side by side). Confirm pill pickers, text inputs all legible.
9. **HEIC guard** — if you have an iPhone HEIC photo handy, try dropping it on the hero zone. Confirm the inline error "iPhone photos need to be saved as JPEG…" appears and the upload does not proceed.
10. **Old form still works** — visit `/agent/transactions/new` (old URL, no flag). Confirm it still loads and a transaction can be submitted normally.

### Production rollout

- [ ] **Enable on production** — add `NEXT_PUBLIC_NEW_SALE_V2=true` to Vercel production environment variables. Redeploy. Run smoke test checklist items 1–5 against production immediately after.

### Rollback procedure

If anything is wrong after flag flip: remove `NEXT_PUBLIC_NEW_SALE_V2` from the environment (or set it to `false`). No code deploy needed. The sidebar button reverts to the old form. Old form is untouched and fully functional.

### Burn-in period

Wait 4–6 weeks of zero production issues before the old form deletion PR. The deletion PR removes `/agent/transactions/new`, `NewTransactionForm.tsx`, the old route, and the feature flag itself.

---

---

## Schema migration needed — chain invite status

- [ ] **Add `NO_EMAIL` to `InviteStatus` enum** — `lib/services/chains.ts` line 305 has a tautology (`"NOT_SENT" : "NOT_SENT"`) because `NO_EMAIL` doesn't exist in the Prisma enum. To fix properly: add `NO_EMAIL` to the `InviteStatus` enum in `prisma/schema.prisma`, create a migration (`npx prisma migrate dev --name add_no_email_invite_status`), apply to staging first, verify, then apply to production. Then update line 305 of `chains.ts` to `stub.stubAgentEmail ? "NOT_SENT" : "NO_EMAIL"`. The chain invite UI can then distinguish "has email, invite pending" from "no email provided."

---

## Quick wins (under 10 minutes each)

- [ ] **TOTP activation** — visit `/command/setup-2fa`, scan QR with authenticator app, enter code. Without this, `/command/*` is unreachable.
- [ ] **Replicate signup + API token** — sign up at replicate.com, create an API token, add `REPLICATE_API_TOKEN` to Vercel production env vars. Unblocks AI image generation in `/command/content`.
- [ ] **Verify the test email actually arrived** — check `inbox@thesalesprogressor.co.uk` for the SendGrid-delivered batch email from 2026-05-03 08:11 UTC. SendGrid says delivered; confirm it actually reached the inbox.

---

## Negotiator invitation flow — run before deploying (2026-05-07)

**New migrations to apply in Supabase SQL editor (staging first, then production).**

- [ ] **Run migration SQL — two blocks, same session**

  Open Supabase SQL editor (`gmkfustgwipgihpmpjpr` for production, `etidawkbqctarmsdjoxp` for staging).
  Run the contents of `prisma/migrations/20260507000001_negotiator_invitation/migration.sql` verbatim.
  It contains: (1) `ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "ext_expires_in" INTEGER;` and (2) the full `NegotiatorInvitation` table creation with indexes and foreign keys.
  Both are idempotent (`IF NOT EXISTS`). Apply to staging first; verify no errors; then apply to production.

- [ ] **Add Google OAuth credentials to Vercel production environment**
  - Go to [console.cloud.google.com](https://console.cloud.google.com) → create OAuth 2.0 client ID (Web application)
  - Authorised redirect URI: `https://portal.thesalesprogressor.co.uk/api/auth/callback/google`
  - Copy `Client ID` and `Client Secret`
  - Add to Vercel production env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Add same values to staging env (use a separate OAuth client or the same one with staging redirect added)

- [ ] **Add Microsoft/Azure AD OAuth credentials to Vercel production environment**
  - Go to [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App registrations → New registration
  - Redirect URI: `https://portal.thesalesprogressor.co.uk/api/auth/callback/azure-ad`
  - After creating: Certificates & secrets → New client secret
  - Copy Application (client) ID, client secret value, and Directory (tenant) ID (or use `common` for multi-tenant)
  - Add to Vercel production env: `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`

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
