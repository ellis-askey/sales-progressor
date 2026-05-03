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

## Row-Level Security (PR 51) — Staging Only

See Checkpoint B output for:
- Tables with RLS enabled
- Policy SQL
- Test query results confirming cross-agency isolation

Production RLS deploy is a **separate action** after staging walk-through passes.

---

## GDPR Routes (PR 53) — Superadmin + TOTP Required

The `/api/gdpr/export` and `/api/gdpr/delete` routes enforce:
1. Superadmin role (checked via session)
2. TOTP step-up cookie (same as command centre gate)

See Checkpoint B output for the full auth gate code before these routes
reach production.

---
