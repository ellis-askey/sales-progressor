# Remediation Verification — reconciliation of every prior finding

**Date:** 28 October 2026 · Independent read-only verification against current code + owner answers.
**Status values:** FIXED AND VERIFIED · PARTIALLY FIXED · NOT FIXED · NOT VERIFIED · NOT APPLICABLE.

For each item: the original finding, what changed, evidence, whether it is genuinely enforced, residual risk, and current status.

---

### R1 — Staff two-factor secrets stored in plaintext
- **Original (High):** agent/staff TOTP secrets stored unencrypted in `User.totpSecret`.
- **Change:** encrypt on enrolment (AES-256-GCM), decrypt on verify, with a 1/2/3-part format detector for lazy migration.
- **Evidence:** `app/actions/two-factor.ts:46` `encryptSecret(secret)`; `lib/auth.ts:130` `verifyTotp(decryptIfEncrypted(user.totpSecret), code)`; `lib/security/token-crypto.ts:41-57`.
- **Enforced?** Yes for the staff path (new enrolments encrypted; login decrypts).
- **Residual / new risk:** (a) legacy plaintext secrets are not re-encrypted until re-enrolment; (b) the detector treats the Command Centre's 2-part CBC format as "plaintext" and passes it through — a *real superadmin-role* account enrolled via `/command/setup-2fa` could fail password login. Pre-existing (the CBC string was never base32-verifiable), narrow (the founder uses the hybrid bypass). Needs a prod DB check.
- **Status:** **PARTIALLY FIXED** (staff path fixed and verified; CBC/legacy edge cases outstanding — see `OUTSTANDING-QUESTIONS.md` Q6).

### R2 — No brute-force protection (rate limiting off)
- **Original (High):** rate limiting gated behind `RATE_LIMIT_ENABLED` + Upstash, fail-open when off.
- **Change:** owner connected Upstash and enabled it.
- **Evidence:** code default remains off/fail-open (`lib/ratelimit.ts:18-23`); **OWNER-CONFIRMED live in production**.
- **Enforced?** Yes, per owner confirmation (not independently verifiable from code).
- **Status:** **FIXED AND VERIFIED** (VERIFIED-CODE wiring + OWNER-CONFIRMED prod state).

### R3 — Inbound-email endpoint unauthenticated
- **Original (Medium):** `sendgrid-inbound` accepted any POST.
- **Change:** shared-secret `?k=` gate; owner set `SENDGRID_INBOUND_SECRET` + updated the SendGrid URL.
- **Evidence:** `app/api/webhooks/sendgrid-inbound/route.ts:35-38` (fail-open only when the env var is unset); **OWNER-CONFIRMED env + URL set in production**.
- **Enforced?** Yes in production per owner. Note: the secret rides in the URL query string (SendGrid does not sign), a weaker guarantee than a signed header.
- **Status:** **FIXED AND VERIFIED**.

### R4 — Portal links never expire / not revocable
- **Original (Medium):** no way to invalidate a leaked portal link.
- **Change:** a "reset link" control rotates the token (old link dies immediately).
- **Evidence:** `app/actions/contacts.ts:180-204` (access-scoped `reissuePortalTokenAction`, mints `randomUUID()`); portal lookups are exact-match on the unique `portalToken`; UI at `components/contacts/ContactsSection.tsx`.
- **Enforced?** Yes — rotation genuinely invalidates. Links still have **no automatic expiry** (manual reset only).
- **Status:** **FIXED AND VERIFIED** (revocation); automatic expiry **NOT IMPLEMENTED** by design.

### R5 — AI "explain email" off-switch
- **Original (this audit):** the agency toggle hid the portal card but the API endpoint did not check the flag — a disabled agency's portal token could still call it.
- **Change (made during this audit):** the endpoint now resolves the responsible party (agency or progression business) and returns 403 when the flag is off.
- **Evidence:** `app/api/portal/explain-email/route.ts` — owner-flag check added after the contact lookup; mirrors `lib/services/portal.ts:366-374`.
- **Enforced?** Yes, now at the data-flow level.
- **Status:** **FIXED AND VERIFIED** (typecheck clean; pending deploy).

### R6 — US transfers / undisclosed sub-processors
- **Original (Medium-High):** OpenAI, Google, Meta used but not disclosed.
- **Change:** added to the privacy and DPA sub-processor tables; **Microsoft also added to the DPA table during this audit** (it was in the privacy page only).
- **Evidence:** `app/privacy/page.tsx` and `app/legal/dpa/page.tsx` sub-processor tables.
- **Enforced?** Disclosure is complete in code. Signed DPAs/SCCs/IDTA are **NOT-VERIFIED** (contractual).
- **Status:** **FIXED AND VERIFIED** (disclosure); transfer safeguards **NOT VERIFIED**.

### R7 — Tenant isolation is application-layer only; RLS unconfirmed
- **Original (Medium):** isolation enforced in app code, no confirmed RLS fallback.
- **Change:** access-scope CI test extended to cover server actions.
- **Evidence:** `__tests__/multi-tenant/access-scope-coverage.test.ts` walks both `app/api` and `app/actions`; isolation re-verified across the touched files (no holes). RLS status **NOT-VERIFIED**.
- **Enforced?** App-layer isolation verified. The CI test is a **regression signal, not a correctness proof**.
- **Status:** **PARTIALLY FIXED** (app-layer verified; RLS still NOT-VERIFIED — see Q2).

### R8 — Password policy weak (8 chars, no breach check)
- **Change:** shared validator, minimum 10 + HaveIBeenPwned k-anonymity check, on every server path.
- **Evidence:** `lib/auth/password-policy.ts`; called at register, reset, change, and all three invite-accept paths (no bypass). Client hints aligned to 10 (fixed during this audit).
- **Status:** **FIXED AND VERIFIED**. (Residual: HIBP fail-open during provider outage, by design.)

### R9 — Consent stored only on the device
- **Change:** `ConsentRecord` table + `/api/consent` endpoint + fire-and-forget from the banner.
- **Evidence:** `prisma/schema.prisma` model `ConsentRecord`; `app/api/consent/route.ts`; `lib/analytics/consent.ts`; migration present.
- **Enforced?** A server record is written. Note: enforcement of the choice remains **client-side (localStorage)**; the server record is audit-only and never read back. The endpoint has **no rate limit**, and the records (IP + UA) have **no purge**.
- **Status:** **PARTIALLY FIXED** (audit record exists; abuse-control and retention for the record itself outstanding).

### R10 — Privacy notice on the portal
- **Change:** a privacy-policy link added to the portal.
- **Evidence:** `components/portal/PortalMenuDrawer.tsx` (Settings-tab footer → `/privacy`).
- **Enforced?** Present, but only in the Settings tab, not the main portal view.
- **Status:** **PARTIALLY FIXED**.

### R11 — No tool to erase a client / offboard an agency
- **Change:** `/api/gdpr/contact` (erase a person by email in an agency) and `/api/command/agencies/[id]/offboard` (close / purge), with Command Centre UI.
- **Evidence:** both routes verified: superadmin + step-up + reason + audit; correctly scoped to one agency/email; storage removed before DB; no cross-tenant reach.
- **Status:** **FIXED AND VERIFIED** (manual superadmin tools; not automated).

### R12 — Founder two-factor step-up bypass
- **Original (owner-accepted):** the hybrid-superadmin email skips Command Centre step-up.
- **Change:** none (retained by decision).
- **Evidence:** `middleware.ts:38,45,75`; `app/command/(protected)/layout.tsx:36,45-57`; `lib/security/hybrid-emails.ts`. Note: middleware keys on the email allowlist, the layout keys on `role !== "superadmin"` — converges for the founder; confirm `hasSuperAdminPowers` can't be true for a non-superadmin except via the allowlist.
- **Status:** **NOT FIXED (owner-accepted)**.

### R13 — 7-year transaction retention not enforced
- **Change:** none in code; handled manually (owner-confirmed).
- **Evidence:** only automated job is 3-year staff-account anonymisation (`app/api/cron/data-retention`); no automated transaction/contact/document purge exists.
- **Status:** **NOT IMPLEMENTED (owner-confirmed as manual)** — the DPIA must state this truthfully.

### R14 — Public avatar/signature buckets
- **Status:** **NOT FIXED (owner-accepted)** — low-sensitivity images on public URLs, by decision.
