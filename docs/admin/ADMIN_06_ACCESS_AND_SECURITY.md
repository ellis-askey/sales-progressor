# ADMIN_06 — Access & Security

**Audience:** Claude Code
**Status:** Draft
**Depends on:** ADMIN_02 (`AdminAuditLog`)
**Implements:** Auth + audit + perf gates that protect every other admin doc

---

## 1. Why this doc exists

The command centre sees every agency, every transaction, every contact, every outbound message. It is, by a wide margin, the highest-blast-radius surface in the application. A successful attack on it leaks the entire customer base.

It is also single-user (you), which simplifies the access model — no role matrix, no permission grid. But "single user" is not the same as "secure by default." Single-user means the bar is "what would stop a determined attacker who knows the founder is the only target."

This doc covers what hardens that surface. Most of it is small in implementation, large in importance.

---

## 2. Authentication

### 2.1 Reuse the existing auth system, with extra gates

The command centre uses NextAuth (already in place per DATA_PROCESSING_OVERVIEW §3). The `superadmin` role does NOT currently exist in the codebase — ADMIN_02 §9 migration #1 adds it as a new value on the existing `UserRole` enum. Existing `admin` users keep their existing access; `superadmin` is a new tier sitting above `admin`, granted only to the founder.

The command centre logs in through the same NextAuth flow as everything else. Do NOT build a parallel auth system. One credential, one session, one place to revoke.

Additional gates layered on top:

### 2.2 Step-up authentication for `/command/*`

Even with a valid superadmin session, accessing any `/command/*` route requires a **fresh second factor within the last 30 minutes**.

- First request to `/command/*` after the threshold redirects to a step-up screen
- Step-up: TOTP code (Google Authenticator / 1Password / etc.). Not SMS.
- A separate cookie tracks step-up freshness, signed independently of the session JWT
- TOTP secret is stored on `User` table (new column, encrypted at rest using `NEXTAUTH_SECRET` as KEK — or a dedicated key, see §6)

This means: even if your session cookie leaks, the attacker still needs your TOTP device to access `/command`.

### 2.3 IP allowlist (optional but recommended)

Configurable env var `ADMIN_IP_ALLOWLIST` — comma-separated CIDR ranges. If set, every `/command/*` request rejects (404, not 403 — don't confirm the route exists) from IPs outside the list.

For you working from one or two locations: trivial to maintain and defangs most attack paths.

For travel: a "request temporary access from this IP" flow (sends an email to your address; you click to grant; expires in 4h).

### 2.4 Hard rate limit on `/command/*` auth

The DATA_PROCESSING_OVERVIEW notes there is no rate limiting today. Before `/command` ships, at minimum:

- 5 failed step-up attempts in 10 minutes from any single IP → 1h block, audit entry written
- 20 admin requests per minute per session → exceeded, log out and require re-auth

Implementation: Upstash Redis is the standard quick win for Vercel-hosted Next.js. If Redis is too much to add right now, an in-memory limiter on the function (per-instance, leaky but better than zero) is acceptable for v1 specifically because the user count is one.

### 2.5 Session lifetime

Per ADMIN_01, the command centre uses a shorter session than the rest of the app:

- Admin session expires after **8 hours of inactivity** (vs whatever NextAuth default is in use elsewhere)
- Hard maximum **24 hours** even with continuous activity, then re-auth required
- Step-up cookie always 30 min regardless of session length

---

## 3. Audit logging

Every meaningful admin action writes to `AdminAuditLog` (schema in ADMIN_02 §7). "Meaningful" means anything that:

- Reads data across agencies
- Modifies any record
- Triggers an outbound action (publishing a post, sending an email)
- Changes config (mode toggles, stream activation, env-managed settings)
- Logs in or out

The catalogue:

| Action | When |
|---|---|
| `admin.session.started` | On successful step-up |
| `admin.session.ended` | On logout or session expiry |
| `admin.session.step_up_failed` | On failed TOTP attempt |
| `admin.page.viewed` | Every admin page load — agency, tab, filter set captured |
| `admin.outbound_message.viewed` | Per ADMIN_04 §8 |
| `admin.transaction.viewed` | Drill-down into any specific transaction |
| `admin.user.impersonated` | (If impersonation is ever built — not in v1) |
| `admin.agency.mode_changed` | SP↔PM toggle |
| `admin.content_stream.created` / `updated` / `mode_changed` | ADMIN_05 |
| `admin.linkedin_post.approved` / `rejected` / `published_manually` | ADMIN_05 |
| `admin.data.exported` | If/when an export feature lands |
| `admin.setting.changed` | Any admin-controlled config |

The `admin.page.viewed` audit is high-volume but cheap, and the audit data is the only forensic record if anything ever goes wrong. Do not skip it.

### 3.1 Tamper resistance

`AdminAuditLog` is append-only at two levels:

**Application-level:** No service in `lib/` may import a delete/update method on `AdminAuditLog`. Enforced by a custom ESLint rule in `eslint-rules/no-admin-audit-mutation.js` that fails CI if any code imports `db.adminAuditLog.delete`, `.update`, `.deleteMany`, or `.updateMany`.

**Database-level:** A Postgres role for the application revokes UPDATE/DELETE on this table:

```sql
REVOKE UPDATE, DELETE ON "AdminAuditLog" FROM application_role;
```

Migrations run as a separate role with full privileges. Application connection runs as `application_role` with the revocation. This is defence in depth — even if the ESLint rule is bypassed, the database refuses.

### 3.2 Audit log access

The Audit tab itself is also audited — viewing the audit log writes `admin.audit.viewed` entries. Yes, this is recursive; it self-stabilises (one entry per page load).

---

## 4. Database access controls

Per the existing data processing review, multi-tenancy is enforced only in application code. The command centre is the one place where that enforcement is intentionally bypassed (you need to see across all agencies). This makes the bypass-by-bug failure mode worse for the command centre than for any other surface.

### 4.1 A separate Prisma client for admin queries

Create a second client `db.command` that's only imported from `lib/command/`. The standard `db` client used by the rest of the app remains agency-scoped (developers writing customer-facing code should not be one missed `where` clause from a cross-tenant leak — but the existing risk is out of scope for this doc; flag and proceed).

The admin client opts out of any future RLS configuration; the standard client opts in.

### 4.2 RLS recommendation

DATA_PROCESSING_OVERVIEW §14 flags Supabase RLS as not configured. The command centre is a good forcing function to fix this:

- Enable RLS on every table
- Add a policy keyed off a Postgres `app.current_agency_id` setting that the standard client sets at session start
- The admin client connects with a role that bypasses RLS (`bypassrls = true` on the role)

This is non-trivial but turns a single missed `agencyId` filter from "data leak" into "query returns zero rows." Strongly recommended before any new external user gets onto the platform, regardless of command centre work.

If RLS work is too large for this sprint, document it as a known gap and move on. Do not block the command centre on it. But the command centre is the right time to introduce the dual-client pattern (`db` vs `db.command`) so RLS is easier to layer on later.

---

## 5. Secrets and key management

The command centre introduces several new secrets:

| Secret | Where used | Storage |
|---|---|---|
| `ADMIN_TOTP_ENCRYPTION_KEY` | Encrypts TOTP secrets at rest | Vercel encrypted env vars |
| `ADMIN_AUDIT_HMAC_KEY` | (Optional) signs audit log rows for tamper detection | Vercel encrypted env vars |
| `ADMIN_IP_ALLOWLIST` | List of permitted CIDRs | Vercel encrypted env vars |
| `LINKEDIN_CLIENT_ID` / `SECRET` | LinkedIn OAuth app credentials | Vercel encrypted env vars |
| `LINKEDIN_ACCESS_TOKEN` | Long-lived OAuth token (refresh-managed) | Encrypted column on `ContentStream` (per-account) |
| `BUFFER_API_TOKEN` (or equivalent for chosen publisher) | Publisher API access | Vercel encrypted env vars |
| `ANTHROPIC_API_KEY` | Already exists | (existing) |

`LINKEDIN_ACCESS_TOKEN` is the only one stored in the database (because it's per-account and may be rotated by user action, not deploy). All others are environment variables.

Encryption-at-rest column type for `LINKEDIN_ACCESS_TOKEN`: AES-256-GCM with per-row IV, encryption key from `ADMIN_TOTP_ENCRYPTION_KEY` (reuse — fine because access patterns are similar). Helper: `lib/command/crypto.ts` exporting `encryptColumn` / `decryptColumn`.

---

## 6. Logging hygiene

Two related concerns.

### 6.1 No PII in logs

The command centre will be the chattiest part of the app. Make sure no log line ever includes:

- Email bodies
- Recipient email addresses
- Property addresses
- Contact names
- TOTP secrets or codes
- Session JWTs
- Webhook payloads

Use a structured logger with a redaction layer (e.g. pino with redact paths configured). Default deny: log line either uses an IDs-only payload or is explicitly approved by adding fields to a per-route allow-list.

### 6.2 Vercel log retention

Per DATA_PROCESSING_OVERVIEW §10, Vercel log retention is currently TO CONFIRM. The command centre's audit needs are **not satisfied by Vercel logs**. Audit lives in `AdminAuditLog` because:

- Vercel logs may be sampled or dropped
- They're not queryable from the application
- They're not under our retention control
- They're not tamper-resistant from the application side

Vercel logs remain useful for debugging. They are not the audit trail. Don't conflate.

---

## 7. Performance gate (CI)

ADMIN_01 §5.5 sets a load budget. Enforce it with a simple CI step:

- `npm run perf:admin` runs k6 / autocannon against `/command/overview` and `/command/outbound` with a seeded test database
- Asserts p95 under the budget
- Runs on PRs that touch `lib/command/*` or `app/command/*`

If the project doesn't currently have a perf testing rig, scope is small enough to add. If adding it doubles the doc's scope: defer, but write a manual checklist into the PR template that the next person must run before merge.

---

## 8. Defence-in-depth checklist before launching `/command`

You should be able to tick every one of these before the page is reachable in production:

- [ ] Step-up TOTP enforced on every `/command/*` route
- [ ] Step-up cookie expires after 30 min
- [ ] `ADMIN_IP_ALLOWLIST` configured (or explicit decision to leave open with rationale recorded)
- [ ] Auth rate limit in place (Upstash or in-memory)
- [ ] Admin session max 8h idle, 24h hard
- [ ] `AdminAuditLog` schema deployed and ESLint rule enforcing append-only
- [ ] Database role `application_role` revoked from UPDATE/DELETE on `AdminAuditLog`
- [ ] `db.command` client introduced; standard `db` client used everywhere outside `lib/command/`
- [ ] No code in `lib/command/` accessible from non-admin routes (App Router route handler check)
- [ ] All secrets in Vercel env, none committed
- [ ] Structured logger with redaction in place for admin routes
- [ ] First `/command/*` access on a fresh session redirects to step-up (verified manually)
- [ ] Failed step-up writes audit entry (verified manually)
- [ ] Logout of admin invalidates the step-up cookie

---

## 9. Future multi-user (out of scope for v1, design now to avoid pain later)

If the command centre ever opens to a second user (an ops hire, a co-founder), the surface that has to change:

- Audit `targetType = "admin_user"` actions become possible
- Permission scopes — at minimum read-only vs read-write split on each tab
- Per-user TOTP secrets (already supported by the `User` table change above)
- Per-user IP allowlists (current design is global; would need per-user)
- Outbound Log §8 redaction options become essential

The schema in ADMIN_02 supports this; the UI does not. Add a `permission_scope` field to `User` when expanding, and a permission check on every admin route handler. Don't pre-build the UI for it now.

---

## 10. Threat model (informal, one paragraph)

The realistic threats:

1. **Stolen session cookie** — mitigated by step-up TOTP
2. **Phishing of TOTP code** — mitigated by IP allowlist (TOTP without IP allowlist is the realistic gap to be aware of)
3. **Compromise of the founder's email** — gets attacker into password reset flow, then they can self-serve a TOTP setup. Mitigation: separate password-reset confirmation email + TOTP reset requires a longer cooldown (24h) with notification emails to a backup address. (Implement: optional, but recommended.)
4. **Insider threat** — N/A while single-user
5. **Supply-chain attack via npm package** — out of scope of this doc, but a regular `npm audit` in CI is the minimum
6. **Database compromise via Supabase** — RLS as defence-in-depth (§4.2), separate admin client is the in-app shim
7. **Application bug leaking cross-tenant data via the standard `db` client** — exists today; command centre doesn't worsen it (the command centre uses `db.command` deliberately)

The threats not on this list (state actors, novel zero-days, etc.) require a different security posture and a different tool. This doc covers the realistic set.
