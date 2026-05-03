# Manual Task Appendix

Steps that require credentials, external service configuration, or deliberate
human action to activate. Listed in dependency order.

---

## Rate Limiting (PR 50) — NOT YET ACTIVE

Rate limiting is fully built and wired into the codebase but is **disabled by
default** via a feature flag. The code is a no-op until you complete all three
steps below.

### What is rate limited

| Limiter | Limit | Key | Applied to |
|---------|-------|-----|-----------|
| Auth login | 5 attempts / 15 min | IP | NextAuth credentials + `/api/auth/forgot-password` |
| Signup | 10 / hour | IP | `/api/register` |
| AI generation | 30 / hour, 200 / day | User ID | `/api/ai/generate-chase` |
| Email send | 50 / hour | User ID | `/api/chase/send-email` |
| Portal invite | 60 / 15 min | Portal token | `/api/portal/invite` |

All limiters use Upstash Redis sliding windows. If `RATE_LIMIT_ENABLED` is not
`"true"`, or if Upstash credentials are absent, every check returns
`{ success: true }` — no in-memory fallback.

### Activation steps

**Step 1 — Create an Upstash Redis database**

1. Go to <https://console.upstash.com> → Create Database
2. Choose region closest to your Vercel deployment (e.g. `eu-west-1`)
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from the
   REST API panel

**Step 2 — Add environment variables in Vercel**

In your Vercel project → Settings → Environment Variables, add:

```
UPSTASH_REDIS_REST_URL      = https://XXX.upstash.io
UPSTASH_REDIS_REST_TOKEN    = AXXXxxx...
RATE_LIMIT_ENABLED          = true
```

Add all three to **Production**, **Preview**, and **Development** environments.

> The `RATE_LIMIT_ENABLED=true` flag is the master switch. The code reads
> credentials but will not enforce limits unless this flag is exactly `"true"`.

**Step 3 — Redeploy**

Trigger a new deployment after saving the env vars. Rate limiting activates on
the first request after the new function instances start.

### Verification

After deploying:

```bash
# Trigger the signup limiter (11 requests = one 429)
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://your-domain.com/api/register \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","email":"t'$i'@x.com","password":"testpass123"}'
done
# Expected: first 10 → 409 (email taken or success), 11th → 429
```

Check the Upstash console for key activity under `rl:signup:*`.

### Rollback

To disable without redeploying: set `RATE_LIMIT_ENABLED=false` in Vercel env
vars and redeploy, or simply remove the variable (missing = disabled).

---

## Row-Level Security (PR 51) — Staging Infrastructure Only

> **Status:** Bypass policies are permanently active for now. Full strict-mode activation
> is a future sprint item (pre-Series-A). See `docs/TODO.md` for scope and effort estimate.
> Do not run the strict activation SQL below until the Prisma middleware and call-site
> wiring described in TODO.md is complete.

### Tables with RLS enabled

| Table | agencyId field | Policy name (bypass) |
|-------|---------------|---------------------|
| `PropertyTransaction` | `agencyId String` (required) | `rls_pt_staging_bypass` |
| `User` | `agencyId String?` (nullable for superadmin) | `rls_user_staging_bypass` |
| `Contact` | indirect (via `propertyTransactionId`) | `rls_contact_staging_bypass` |
| `ManualTask` | `agencyId String` (required) | `rls_mt_staging_bypass` |
| `SolicitorFirm` | `agencyId String` (required) | `rls_sf_staging_bypass` |

All five tables have `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`.
Current staging state: a PERMISSIVE `USING (true)` bypass policy is active on
each table — the app works identically to before. RLS infrastructure is in
place; enforcement is off.

### Current staging policy SQL (bypass — in migration file)

```sql
ALTER TABLE "PropertyTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PropertyTransaction" FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_pt_staging_bypass ON "PropertyTransaction"
  AS PERMISSIVE FOR ALL USING (true);

-- (same pattern for User, Contact, ManualTask, SolicitorFirm)
```

### Strict activation policy SQL (NOT YET RUN — production activation)

```sql
-- PropertyTransaction
DROP POLICY rls_pt_staging_bypass ON "PropertyTransaction";
CREATE POLICY rls_pt_agency ON "PropertyTransaction"
  AS RESTRICTIVE FOR ALL
  USING ("agencyId" = current_setting('app.current_agency_id', true));

-- User (superadmin agencyId IS NULL — allowed through)
DROP POLICY rls_user_staging_bypass ON "User";
CREATE POLICY rls_user_agency ON "User"
  AS RESTRICTIVE FOR ALL
  USING (
    "agencyId" = current_setting('app.current_agency_id', true)
    OR "agencyId" IS NULL
  );

-- Contact (joined via PropertyTransaction — inherits context)
DROP POLICY rls_contact_staging_bypass ON "Contact";
CREATE POLICY rls_contact_agency ON "Contact"
  AS RESTRICTIVE FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "PropertyTransaction" pt
      WHERE pt.id = "Contact"."propertyTransactionId"
        AND pt."agencyId" = current_setting('app.current_agency_id', true)
    )
  );

-- ManualTask
DROP POLICY rls_mt_staging_bypass ON "ManualTask";
CREATE POLICY rls_mt_agency ON "ManualTask"
  AS RESTRICTIVE FOR ALL
  USING ("agencyId" = current_setting('app.current_agency_id', true));

-- SolicitorFirm
DROP POLICY rls_sf_staging_bypass ON "SolicitorFirm";
CREATE POLICY rls_sf_agency ON "SolicitorFirm"
  AS RESTRICTIVE FOR ALL
  USING ("agencyId" = current_setting('app.current_agency_id', true));
```

### withAgencyRls wrapper (lib/prisma-rls.ts)

Every query that needs to be agency-scoped at the DB level must go through
`withAgencyRls(agencyId, (tx) => tx.model.operation(...))`. This:
1. Opens a Prisma `$transaction`
2. Runs `SELECT set_config('app.current_agency_id', agencyId, TRUE)` to scope
   the session variable for the duration of that transaction
3. Runs the caller's query inside the same transaction connection

### Test queries (run on staging with bypass policies active)

```bash
# Prerequisite: you need two agencies and their IDs. Get them:
# Agency A: AGENCY_A_ID
# Agency B: AGENCY_B_ID

# Test 1 — without RLS context (bypass active): both agencies visible
curl -s "https://staging.yourdomain.com/api/command/rls-test\
?agencyId=AGENCY_A_ID&probe=AGENCY_B_ID" \
  -H "Cookie: next-auth.session-token=<superadmin-session>"
# Expected (bypass active):
#   rlsEnforcing: false
#   countWithContext == countWithoutContext

# Test 2 — after activating strict policies (drop bypass, add strict):
# Run the strict SQL above in psql, then:
curl -s "https://staging.yourdomain.com/api/command/rls-test\
?agencyId=AGENCY_A_ID&probe=AGENCY_B_ID" \
  -H "Cookie: next-auth.session-token=<superadmin-session>"
# Expected (strict active):
#   rlsEnforcing: true
#   countWithContext: 0      ← agency B has 0 rows visible with agency A context
#   countWithoutContext: N   ← N is agency B's actual transaction count

# Test 3 — correct context matches probe:
curl -s "https://staging.yourdomain.com/api/command/rls-test\
?agencyId=AGENCY_B_ID&probe=AGENCY_B_ID" \
  -H "Cookie: next-auth.session-token=<superadmin-session>"
# Expected (strict active):
#   rlsEnforcing: false
#   countWithContext == countWithoutContext  ← same agency, all rows visible
```

### Production activation — DEFERRED (see docs/TODO.md)

Strict RLS activation requires:
1. Prisma middleware wiring `app.current_agency_id` on every request
2. RLS policies on the 18 additional tables not covered by PR 51
3. Full call-site audit before dropping bypass policies

These are scheduled as a future sprint item. The strict activation SQL above is
preserved for reference. Do not run it until the TODO.md prerequisites are met.

---

## GDPR Routes (PR 53) — Superadmin + TOTP Required

The `/api/gdpr/export` and `/api/gdpr/delete` routes enforce:
1. Superadmin role (checked via session)
2. TOTP step-up cookie (same as command centre gate)

See Checkpoint B output for the full auth gate code before these routes
reach production.

---
