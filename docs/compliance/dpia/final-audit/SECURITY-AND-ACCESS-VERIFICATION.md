# Security & Access Verification

**Date:** 28 October 2026. Independent read-only. Evidence classes in brackets.

## Authentication
- **NextAuth, JWT sessions** (`lib/auth.ts`). Credentials + Google + Azure AD providers. Default 30-day JWT lifetime (not explicitly set) [VERIFIED-CODE].
- **Passwords:** bcrypt cost 12; shared policy minimum 10 + HaveIBeenPwned breach check on every server-side set path, no bypass [VERIFIED-CODE].
- **Password reset:** enumeration-safe, 1-hour token [VERIFIED-CODE].
- **Two-factor (staff):** optional TOTP; secret now **encrypted at rest** (AES-256-GCM) for new enrolments; login decrypts to verify [VERIFIED-CODE]. Edge case: a superadmin-role account enrolled via the Command Centre 2FA path uses a different (CBC) format the detector treats as plaintext → potential password-login lockout; pre-existing, narrow, needs a DB check (Q6).
- **Session revocation:** `sessionVersion` bump forces re-login; deactivation kills sessions on next refresh [VERIFIED-CODE].
- **Rate limiting:** code default off/fail-open; **OWNER-CONFIRMED live in production**.

## Authorisation & tenant isolation
- **Access-scope model** (`lib/security/access-scope.ts`): every multi-tenant read/write derives scope from the session and filters by it. Re-verified across the files touched by recent changes — **no cross-tenant holes found** [VERIFIED-CODE].
- **Buyer/seller portal:** strictly minimised — a buyer resolves to their own contact row only; cannot see the other party's contacts or internal notes [VERIFIED-CODE].
- **Solicitor access:** signed, 30-day, single-file token [VERIFIED-CODE].
- **Progression-business isolation:** files tagged by `progressionBusinessId`; TSP's "all" scope excludes external-business files [VERIFIED-CODE].
- **CI regression test:** now covers `app/api` and `app/actions`; a **regression tripwire, not a correctness proof** [VERIFIED-CODE].
- **Database-level RLS:** **NOT-VERIFIED** — isolation currently rests on application code; RLS as a second layer is a dashboard question (Q2).

## New Command Centre destructive tools (audited for safety)
- `/api/gdpr/contact` (erase a person by email), `/api/command/agencies/[id]/offboard` (close/purge). Both: **superadmin role + Command-Centre two-factor step-up (30-min) + required reason + audit log** — identical to the gold-standard `/api/gdpr/delete` [VERIFIED-CODE].
- **Correctly scoped:** erase-by-email filters on `transaction: { agencyId }` — cannot reach a same-email person in another agency. Purge scopes all deletes to the one `agencyId`. No cross-tenant over-deletion [VERIFIED-CODE].
- **Storage handled:** objects removed before DB rows (a DB cascade won't touch the bucket); best-effort so a storage miss can't abort erasure [VERIFIED-CODE].
- **Fail-closed:** absent/stale step-up → 403. The hybrid-superadmin (founder) sees the UI but the handlers require `role === "superadmin"` exactly, so his clicks 403 (a UX dead-end, not a hole) [VERIFIED-CODE].
- **No injection:** all Prisma (parameterised); inputs type-checked [VERIFIED-CODE].

## Documents, storage & webhooks
- `transaction-documents`, `whatsapp-media`, `form-uploads` are private, served via short-lived signed URLs after an ownership check [VERIFIED-CODE; private status OWNER-CONFIRMED]. `avatars`, `signatures`, `*-logos` are public by design (low-sensitivity).
- **Webhooks:** Stripe and WhatsApp are signature-verified; SendGrid inbound now shared-secret gated (live); all cron jobs require `CRON_SECRET` [VERIFIED-CODE + OWNER-CONFIRMED].

## Logging & monitoring
- **Sentry:** `sendDefaultPii:false`; error-only session replay. Explicit replay text/input masking **not set in code** (SDK defaults) — confirm on the dashboard (Q4) [PARTIALLY-VERIFIED].
- **PostHog (EU):** consent-gated, `mask_all_text`, no session recording, event/property allow-list, email stripped from events [VERIFIED-CODE].
- **New routes** (consent, gdpr/contact, offboard, agent explain-email) log **no personal data / no email bodies** [VERIFIED-CODE].

## Administrative privileges
- Command Centre is superadmin-only with IP-allowlist option and step-up. The **founder hybrid account bypasses step-up** (owner-accepted). Note the middleware and layout use different definitions of "hybrid"; confirm `hasSuperAdminPowers` can't be true for a non-superadmin except via the email allowlist [VERIFIED-CODE, owner-accepted].

## Items needing dashboard/env/contract confirmation
Supabase RLS + backups/restore (Q2); Sentry masking + region (Q4); cookie SameSite (Q7); superadmin 2FA format in prod (Q6); signed provider DPAs (Q3).
