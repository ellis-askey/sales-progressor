# Ellis — Manual TODO

**This file tracks every manual task that requires Ellis (the founder) personally — things Claude Code cannot do. Tasks are added by CC during builds whenever a manual step is needed. Tasks get struck through as completed (don't delete; we want a record of what's been done).**

**Maintenance rule:** When CC ships a PR that requires founder action, CC must add the action to this file. When Ellis completes a task, strike it through with `~~` markdown but leave it visible.

Last updated: 2026-05-22

---

## Client-chase arc — flag flip + manual re-subscribe ops

The client-chase cron (`/api/cron/client-chase`, daily 08:30 UTC) is registered and tsc-clean but **flag-gated to a no-op** until you explicitly enable it.

### Step 1 — enable the flag once you've walked it on staging

Set `CLIENT_CHASE_ENABLED=true` in the Vercel environment for **staging first**, walk through the next morning's cron output (route logs + `ClientChaseState` DB rows + drained `OutboundEmailQueue` rows), then enable on production. Until the flag is `"true"`, the cron route returns `{ ok: true, skipped: "flag_disabled" }` and nothing is enqueued.

### Step 2 — manual re-subscribe path (no UI for v1)

If a contact unsubscribes and then asks their agent to re-enable update reminders, **the agent has no UI for this** — it's a manual DB op handled by you:

```sql
UPDATE "Contact" SET "unsubscribedAt" = NULL WHERE id = '<contact-id>';
```

Volume should be near-zero pre-launch. If/when manual ops becomes a regular task, build the UI then. The copy on the unsubscribe page and the respond-page opt-out banner correctly tells contacts to "tell your agent" — works whether the flip is DB or a future toggle.

### Step 3 — escalation review (no SLA, sanity check only)

When the cron escalates a `ClientChaseState` row (chase-count cap of 2 OR 14 days of silence, whichever fires first), `status` flips to `"escalated"`. Spot-check `SELECT * FROM "ClientChaseState" WHERE status = 'escalated'` periodically — disproportionately many escalations might mean cadence is too aggressive for real-world response patterns. Pre-launch with ~5 users this is mostly a sanity check.

---

## Medians-ready email — manual swap when it arrives

A new daily cron `/api/cron/medians-ready-check` watches the platform's accumulated completion data. The moment ≥50 distinct transactions have at least one non-reconciled completed milestone, the cron sends a one-shot email (`MEDIANS_READY`) to every superadmin with a per-milestone comparison table: current hardcoded value vs computed median vs sample size, tagged as **Ready** (≥30 samples), **Low sample** (10–29), or **Insufficient** (<10).

**The email will NOT re-fire.** A `SystemNotification` row keyed `medians_ready` is written after enqueueing, and subsequent cron runs short-circuit on its presence. To re-test (staging only), delete the row directly.

### When the email arrives, do this:

1. **Read the per-milestone table.** Decide which rows to action (the body suggests two paths: action only the ≥30 rows, OR wait until 100 transactions for higher per-row confidence).
2. **Edit [lib/services/fees.ts:77](lib/services/fees.ts#L77)** — replace the hardcoded `MILESTONE_DURATION_MEDIANS` values with the computed medians for the codes you're confident about. Leave the others on hardcoded values.
3. **Edit [lib/services/milestone-staleness.ts](lib/services/milestone-staleness.ts)** — flip `export const MEDIANS_READY = false;` to `true`. This re-activates platform-wide:
   - The slowness badge (Change 3 of the visibility pass): per-milestone "X days slower than typical" pills.
   - The predicted-exchange band (Change 2 of the visibility pass): "Around mid June" / "~mid Jun" on sidebar, portal, and chain LinkCards.
4. **Commit + deploy as a single PR**, e.g. `"fees: swap MILESTONE_DURATION_MEDIANS for learned values; MEDIANS_READY=true"`.
5. **Verify** that the slowness badges + exchange bands now render on real files. The staleness badge (Change 5) was always on — it doesn't depend on the flag.

### If you want to skip the email and use this signal yourself before it fires:

Query the DB directly: `SELECT COUNT(DISTINCT "transactionId") FROM "MilestoneCompletion" WHERE state = 'complete' AND "reconciledAtClaim" = false;`. When that hits 50 in production, the cron will fire on the next 09:00 UTC run.

### Staging steps (run before merging Change 6 to production)

```bash
# Migration already applied to staging by CC on 2026-05-21.
# Verify the table exists:
DATABASE_URL="<staging-direct-url>" psql -c '\d "SystemNotification"'

# To force-fire the cron on staging without waiting for 50 real transactions:
# (a) Lower TRANSACTION_THRESHOLD in app/api/cron/medians-ready-check/route.ts to your current count.
# (b) Hit the route with the staging CRON_SECRET:
curl -H "Authorization: Bearer <STAGING_CRON_SECRET>" https://<staging-deploy>.vercel.app/api/cron/medians-ready-check

# Confirm the OutboundEmailQueue got the row, then either wait for the daily
# drain (09:00 UTC) or run it manually:
curl -H "Authorization: Bearer <STAGING_CRON_SECRET>" https://<staging-deploy>.vercel.app/api/cron/drain-outbound-email

# Confirm the SystemNotification row was written:
DATABASE_URL="<staging-direct-url>" psql -c 'SELECT * FROM "SystemNotification";'

# Reset for re-test:
DATABASE_URL="<staging-direct-url>" psql -c 'DELETE FROM "SystemNotification" WHERE key = '\''medians_ready'\'';'
DATABASE_URL="<staging-direct-url>" psql -c 'DELETE FROM "OutboundEmailQueue" WHERE "emailType" = '\''MEDIANS_READY'\'';'

# Confirm EMAIL_SANDBOX_MODE=true on staging so sandbox-mode is on for the
# test send (no real email goes out — SendGrid validates but doesn't deliver).
```

### Production migration

Once staging walk is approved:

```bash
DATABASE_URL="<production-direct-url>" npx prisma migrate deploy
```

Then deploy the Change 6 code via `vercel --prod` from the visibility-pass arc's final approved commit.

---

## Founder Brief / Weekly Review — internal-account exclusion

Migration: `prisma/migrations/20260521150000_add_is_internal_flag/migration.sql`

Adds `isInternal Boolean default false` to `Agency` and `User`. The migration backfills:
- Every user with `role IN ('admin', 'sales_progressor', 'superadmin')` → `isInternal = true`
- The `Zero Progressor` agency → `isInternal = true`
- Every user under an internal agency → `isInternal = true`

After this lands, the metric rollup ([lib/services/metrics-rollup.ts](lib/services/metrics-rollup.ts)) and every signal detector under [lib/services/signals/detectors/](lib/services/signals/detectors/) skip internal activity, so the Founder Brief and Weekly Review only reflect real customer agencies.

### Staging steps (run first)

```bash
# Apply migration to staging
DATABASE_URL="<staging-direct-url>" npx prisma migrate deploy

# Verify backfill landed correctly
DATABASE_URL="<staging-direct-url>" psql -c 'SELECT email, role, "isInternal" FROM "User" ORDER BY email;'
DATABASE_URL="<staging-direct-url>" psql -c 'SELECT name, "isInternal" FROM "Agency" ORDER BY name;'
```

Then manually trigger the crons against staging:
- `POST /api/cron/rollup-metrics` with `Authorization: Bearer <CRON_SECRET>`
- `POST /api/cron/signals` (same header)
- `POST /api/cron/weekly-review` (same header) — eyeball the email; numbers should reflect the 4 real customer agencies only.

### Production steps (after staging looks clean)

1. **Delete Natalie Mills first.** She and any associated agency/transactions should be removed entirely, not flagged. Run in the Supabase SQL editor against project `gmkfustgwipgihpmpjpr`:

   ```sql
   -- Preview what's tied to her
   SELECT id, email, "agencyId", role FROM "User" WHERE email = 'ellisaskey+natalie@googlemail.com';

   -- For the agencyId returned above, check what else is in that agency
   SELECT COUNT(*) FROM "PropertyTransaction" WHERE "agencyId" = '<her-agency-id>';
   SELECT COUNT(*) FROM "User" WHERE "agencyId" = '<her-agency-id>';
   ```

   If the agency only contains Natalie and no real-customer data:
   ```sql
   DELETE FROM "Agency" WHERE id = '<her-agency-id>';
   -- Prisma cascade rules on User/Agency will clean up dependent rows.
   ```
   Otherwise delete just her User row.

2. **Deploy the migration to production.** Same `prisma migrate deploy` command, but with the production DATABASE_URL.

3. **Wipe historical rollup + signal data** so the next nightly cron starts from a clean slate (those rows reference the "51 sales in a week" test-data era). In the Supabase SQL editor:

   ```sql
   TRUNCATE "Signal", "DailyMetric" RESTART IDENTITY;
   ```

4. The 02:00 UTC `/api/cron/rollup-metrics` and 03:00 UTC `/api/cron/signals` jobs will rebuild from real customer activity only. Monday's Weekly Review should then reflect the genuine 4-customer baseline.

### Rollback plan

The migration is additive (one new column on two tables). If the brief starts hiding real activity (i.e. someone is wrongly flagged as internal), reverse with:
```sql
UPDATE "User" SET "isInternal" = false WHERE email = '<wrongly-flagged-email>';
```

---

## 🚨 BLOCKER — Email Arc production launch gate

**`drain-outbound-email` cron MUST run at least hourly before the Email Arc goes live in production. Currently set to daily (`0 9 * * *`) as a temporary workaround for Vercel Hobby plan's daily-cron limitation. Daily drain delays exchange/completion/celebration emails by up to 23 hours from the milestone event, defeating the operational purpose of the arc.**

Decision required before any production deploy of the Email Arc. Options:

- **(a) Upgrade Vercel to Pro (~$20/mo)** — revert both crons in `vercel.json` to `0 * * * *`. Cleanest, native solution. **Recommended.**
- **(b) External hourly cron service** (cron-job.org, EasyCron, or a GitHub Actions scheduled workflow) hitting `https://portal.thesalesprogressor.co.uk/api/cron/drain-outbound-email` with `Authorization: Bearer <CRON_SECRET>` once per hour. Free but adds an external dependency to a critical email pipeline.
- **(c) Accept daily latency** — NOT recommended. A vendor exchanging contracts at 10am Monday wouldn't get their chain mates notified until 9am Tuesday. The arc's "operational visibility" promise is broken.

This is a hard gate on the Email Arc going live in production, not a soft optimization. Withdrawal emails are unaffected (they fire synchronously at withdrawal time — the queue is only a fallback for them). Decline notifications are unaffected (also synchronous). Only exchange / completion / celebration emails are degraded by daily drain — and those are the most consequential of the six email types.

---

## Email Arc — schema migration (apply before Commit 2 deploys)

Migration file: `prisma/migrations/20260520000001_email_arc_schema/migration.sql`

Adds four things: `User.emailUnsubscribedAt`, `ChainLink.inviteUnsubscribedAt`, `PropertyChain.celebrationSentAt`, and the new `OutboundEmailQueue` table. All additive, no data loss risk.

```bash
# Set DATABASE_URL to STAGING direct connection URL (not pooler)
DATABASE_URL="postgres://postgres:..." npx prisma migrate deploy
```

Verify on staging:
- [ ] `User` table has `emailUnsubscribedAt` column (nullable, no default)
- [ ] `ChainLink` table has `inviteUnsubscribedAt` column (nullable, no default)
- [ ] `PropertyChain` table has `celebrationSentAt` column (nullable, no default)
- [ ] `OutboundEmailQueue` table exists with correct columns and indexes
- [ ] No errors in Supabase SQL editor after running

Once verified on staging, apply to production:
```bash
# Set DATABASE_URL to PRODUCTION direct connection URL
DATABASE_URL="postgres://postgres:..." npx prisma migrate deploy
```

---

## Email Arc — manual setup required before Stage 2 deploys

These must be in place before Stage 2 (implementation) starts. Stage 2 references the SendGrid group ID and DNS records.

- [ ] **SendGrid unsubscribe group** — log in to SendGrid → Email API → Unsubscribe Groups → Create Group. Name it "Sales Progressor chain emails". Copy the numeric Group ID and add it here: `SENDGRID_UNSUBSCRIBE_GROUP_ID=______`. Stage 2 needs this value as an env var.
- [ ] **Authenticated sending domain (`mail.thesalesprogressor.co.uk`)** — in SendGrid: Settings → Sender Authentication → Authenticate a Domain → enter `mail.thesalesprogressor.co.uk`. SendGrid generates three CNAME records. Add all three at your DNS registrar.
- [ ] **SPF record** — add `include:sendgrid.net` to the SPF record on `mail.thesalesprogressor.co.uk` (SendGrid's domain auth wizard generates the exact record).
- [ ] **DMARC record** — add a TXT record to `_dmarc.thesalesprogressor.co.uk`: `v=DMARC1; p=none; rua=mailto:dmarc@thesalesprogressor.co.uk`. Also ensure `dmarc@thesalesprogressor.co.uk` routes to a monitored inbox (can be the same as `support@` initially). After 4 weeks of clean reports, escalate to `p=quarantine`.
- [ ] **`UNSUBSCRIBE_SECRET` env var** — generate a random 32-byte secret (`openssl rand -base64 32`) and add as `UNSUBSCRIBE_SECRET` in Vercel production + staging + local `.env`. Stage 2 needs this for token signing.
- [ ] **DNS propagation check** — after adding records, verify with `dig TXT _dmarc.thesalesprogressor.co.uk` and SendGrid's built-in domain verification. Do not deploy Stage 2 before SendGrid confirms domain authentication is active.

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

- [ ] **EPC API credentials** — EPC data shows "currently unavailable" on all property files because `EPC_API_EMAIL` and `EPC_API_KEY` are not set. Register a free account at https://epc.opendatacommunities.org/ → then go to Settings → API access to get your email and key. Add both as Vercel environment variables (Production + Preview), redeploy. Also add to local `.env` for dev. Once set, the EPC section on every property file will start showing the certificate data, rating badge, and a direct "View on GOV.UK" link to the actual certificate.
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

## Email gaps to address (product decisions)

- [ ] **No instant welcome email** — `activation_day_1` fires at 09:00 UTC the day *after* signup. Someone who signs up at 10am hears nothing until the next morning. Decide: add an immediate trigger on account creation, or accept the delay?

- [ ] **Morning digest excludes negotiators** — role filter is `["admin", "sales_progressor", "director"]`. Negotiators only get the Monday brief. Decide: should negotiators get the daily morning digest too?

- [ ] **No onboarding email sequence** — one activation email, one stuck-day-3 nudge, then silence until 30 days. No "here's how to get the most out of the platform" flow. Decide: worth building a day 3/7/14 sequence, or is the in-app checklist enough?

- [ ] **`send_to_us_drop_21d` is outsourced-tier only** — self-managed users who go quiet for 21 days get nothing until the `quiet_30d` email. Decide: should self-managed users get their own 21-day check-in?

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

## Payments — Stripe account + pricing disclosure copy (PR 6 blockers)

The payments build plan (`docs/active/payments-build-plan.md`) is mid-rollout — PRs 1–5 shipped (schema, trial stamp, exchange snapshot, reversal handler, accrual cron + director-facing running total). PR 6 is **Stripe Elements card capture + the pricing-acknowledgement gate** and needs two things from you before it can ship.

### Step 1 — Stripe account + API keys (test mode only for PR 6)

PR 6 captures cards but does not charge — test-mode keys are sufficient. Live-mode keys come in PR 7 (real charging + failed-payment block).

1. **Create a Stripe account at https://stripe.com** if one doesn't already exist for The Sales Progressor. Use the company email; complete the basic business profile (you can finish "Activate your account" — the live-mode bits — later when PR 7 needs them).
2. In the Stripe dashboard, **toggle to "Test mode"** (top right).
3. From **Developers → API keys**, copy:
   - **Publishable key** (starts `pk_test_...`)
   - **Secret key** (starts `sk_test_...`)
4. Add to **Vercel → Settings → Environment Variables** for the **staging** environment:
   - `STRIPE_PUBLISHABLE_KEY` = the `pk_test_...` value
   - `STRIPE_SECRET_KEY` = the `sk_test_...` value
5. Repeat for **production** (same test-mode keys for now — we are NOT charging in production until PR 7. CC will swap to live-mode keys as part of PR 7 once you've activated the Stripe account properly).
6. Tell CC when done — PR 6's `lib/stripe.ts` initialiser will read these on next deploy.

### Step 2 — Pricing disclosure copy (the legal-weight screen)

PR 6 builds the acknowledgement gate that records "the director agreed to v1 of the terms" before card capture is allowed. The actual disclosure text is **not invented by CC** — it's a design/voice deliverable from you, since this is the one screen with legal weight in the whole flow.

The gate is built to read whatever's in the `TermsVersion` table. PR 6 ships the table empty; until you supply real copy and insert a row, the card-capture form is blocked behind a clear "Payment setup is not yet available — pricing disclosure pending" message. **No placeholder wording will be seeded.**

1. Draft the disclosure copy. It needs to cover:
   - What we charge (£59 in-house per exchange; £250/£300/£350 outsourced by exchange-confirmed sale price)
   - When we charge (monthly, on exchange — never before, never on fall-through)
   - The 7-day free trial (first 7 days of files are free-on-exchange forever)
   - Failed-payment behaviour (existing files keep running; new file creation blocks after ~14 days of failed payment until the card is updated)
   - The director-only billing scope (negotiators don't see prices)
   - VAT status (not VAT-registered today; the disclosure should note this and that pricing is inclusive)
2. Send CC the final text + the version tag you want recorded (suggested `"2026-05-payments-v1"`, bump when terms change).
3. CC will insert it as a single row into `TermsVersion`. After insert, the gate becomes operational with no code change required.

Until both steps are done, PR 6 is shippable as code but the card form will refuse to render — by design.

### Step 3 — PR 7 deliverables: webhook secret + endpoint registration + live keys for prod

PR 7 (real charging + failed-payment block) needs three things from you before it can flip to live in production. None of these are needed for staging — the staging deploy works against test-mode keys and there's no real charging on staging.

**3a — Register the Stripe webhook endpoint.**
- Go to Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
- Do this twice: once in **Test mode** (for the staging deploy), once in **Live mode** (for production). They produce different signing secrets.
- Endpoint URL:
  - Staging test-mode: `https://salesprogressor-git-staging-ellis-askeys-projects.vercel.app/api/webhooks/stripe`
  - Production live-mode: `https://portal.thesalesprogressor.co.uk/api/webhooks/stripe`
- Events to send: `invoice.payment_succeeded`, `invoice.payment_failed`. (Add more later if PR 7+ extends to other event types.)
- After saving each endpoint, Stripe shows a **signing secret** (starts `whsec_...`).
- Add to Vercel env:
  - `STRIPE_WEBHOOK_SECRET` on **staging** = the test-mode whsec
  - `STRIPE_WEBHOOK_SECRET` on **production** = the live-mode whsec
- Tell CC when both are set.

**3b — Swap production STRIPE_*_KEY env vars from test-mode to live-mode keys.**

This is the moment real charging becomes possible on production — only do it when you're ready for that and have completed Stripe account activation.
- In Stripe Dashboard, toggle to **Live mode**.
- From Developers → API keys, copy the **Live** publishable key (`pk_live_...`) and secret key (`sk_live_...`).
- In Vercel **production** env, replace:
  - `STRIPE_PUBLISHABLE_KEY` → the live `pk_live_...`
  - `STRIPE_SECRET_KEY` → the live `sk_live_...`
- Staging stays on test-mode keys. Do NOT put live keys in the staging environment — staging should never charge real cards.
- After swap, the first real exchange in a new billing month on production will charge real money on the 1st of the following month. The accrual cron is already scheduled; PR 7 adds the issuance cron that does the actual Stripe charge.

**3c — Insert the 2026-05-payments-v1 TermsVersion row on production.**

This is the "PR 6 goes live" moment. CC will provide a small one-shot script with the same hard prod guard (validates project ID) as the staging insert. Only run it after Steps 1–3a above are done, and you've walked the full staging arc clean.

Once all three steps complete, PR 6 + PR 7 are both fully live in production.

---

## Future, deferred, not urgent

- [ ] **Settings polish pass — consider tabbed layout once card count crosses ~8.** The notification-toggles work (shipped) pushes `/agent/settings` from 5 cards to 7. Polish pass should audit whether a tabbed layout (Profile / Notifications / Branch / Team / Account) becomes warranted; current single-column stack still scans fine. New cards used the existing ThemePicker glass-card pattern so they refit cleanly into tabs without code changes.
- [ ] External penetration test or security review (pre-launch, requires human security firm)
- [ ] Engage with industry communities (Property Industry Eye, The Negotiator, Propertymark LinkedIn groups) — 30 min/day
- [ ] Decide on Vercel Pro upgrade ($20/mo) when you want sub-hourly cron granularity (`/api/cron/metrics-5min` is built but unwired pending this)
- [ ] Decide whether to enable strict RLS in Supabase (currently bypass policies in place; full activation = future sprint per `docs/active/TODO.md`)

---

## Known issues

- **Stale session FK violations on transaction creation** — If a user's session JWT contains an `agencyId` that no longer exists in the database (e.g. agency was deleted, or test data rotated), creating a new transaction triggers a `PropertyTransaction_agencyId_fkey` foreign key violation and shows the "Something went wrong" error boundary. Workaround: sign out and back in. Long-term fix: validate `session.user.agencyId` against the Agency table on session refresh, force re-auth if invalid. *(Discovered 2026-05-05 on local dev — production unaffected.)*

---

## How this file works

- Every time CC builds something requiring founder action, CC adds the task here with enough detail that Ellis can do it without asking for clarification
- Tasks include: where to go (URL or location), what to do, why it matters, what env var to set or what action to take afterwards
- When Ellis completes a task, strike through with `~~` markdown — keep visible for record
- When a category becomes empty, leave the heading; new tasks of that category may arrive later
- This file replaces ad-hoc "manual task appendices" surfaced at end of build runs
