# Outstanding Questions — items that must be resolved for a complete DPIA

**Date:** 28 October 2026. These cannot be established from code. Priority: 🔴 material to the assessment · 🟠 important · 🟡 good practice.

The owner answered most Phase-4 questions (recorded in `DPIA-SOURCE-PACK.md`). The items below remain **unresolved** and must be presented as such in the DPIA, not as verified facts.

---

## 🔴 Q1 — Anthropic & OpenAI data terms (UNRESOLVED — owner left blank)
**Need:** confirmation that (a) submitted data is contractually excluded from model training, and (b) any retention limit / zero-data-retention arrangement, for both Anthropic and OpenAI.
**Why it matters:** all AI processing goes to these US providers; several features send unminimised third-party personal data (pasted emails, uploaded documents, full client names). Training/retention terms are the single biggest driver of AI residual risk.
**Already verified:** integration is the commercial API with a server-side key (not consumer tools); TSP does not store the explain-email content itself.
**Resolving evidence:** the Anthropic and OpenAI account/commercial agreement data-usage terms, or a signed DPA/ZDR addendum.

## 🔴 Q2 — Supabase row-level security & backup testing (UNRESOLVED)
**Need:** is database row-level security (RLS) enabled as a second layer behind the application scoping? Are backups / point-in-time recovery enabled, and has a restore ever been tested?
**Why it matters:** tenant isolation is currently enforced **only** in application code (verified). RLS would be defence-in-depth. Untested backups are a recovery risk.
**Already verified:** Supabase production region is **EU** (owner-confirmed); document buckets are **private** (owner-confirmed).
**Resolving evidence:** Supabase dashboard (Auth → Policies / Database settings / Backups).

## 🟠 Q3 — Signed sub-processor DPAs / SCCs / IDTA (UNRESOLVED)
**Need:** confirmation that a DPA incorporating SCCs / UK IDTA is on file for each US sub-processor (Anthropic, OpenAI, SendGrid/Twilio, Stripe, Google, Meta, Vercel, Microsoft).
**Why it matters:** the privacy and DPA pages assert "US (SCCs + UK IDTA)"; this must be contractually true.
**Resolving evidence:** the executed/accepted DPA for each provider.

## 🟠 Q4 — Sentry error-replay masking (UNRESOLVED)
**Need:** confirm text/input masking is enabled on the Sentry project, and the DSN region.
**Why it matters:** error replays are captured at 100%; without masking, on-screen personal data could appear in a replay. Code sets no explicit masking (relies on SDK defaults).
**Already verified:** `sendDefaultPii: false`; session replay is error-only.
**Resolving evidence:** Sentry project → Replay settings; the DSN host (eu. vs us.).

## 🟠 Q5 — Upstash & Railway regions (UNRESOLVED)
**Need:** confirm the Upstash Redis and Railway (WhatsApp bridge) regions are EU/EEA as asserted.
**Resolving evidence:** the respective dashboards (the URLs are owner-supplied, opaque in code).

## 🟡 Q6 — Two-factor format edge case (UNRESOLVED — owner unsure)
**Need:** does any **real superadmin-role** account have Command-Centre 2FA enrolled (a 2-part CBC secret with `totpActivatedAt` set)? Are there legacy plaintext `User.totpSecret` rows?
**Why it matters:** such an account could be locked out of password login; legacy plaintext secrets remain until re-enrolment.
**Resolving evidence:** a one-line production DB read of `User.totpSecret` formats for superadmin-role rows. **Recommended action regardless:** re-enrol or confirm none exist.

## 🟡 Q7 — Cookie SameSite posture (UNRESOLVED)
**Need:** confirm the NextAuth session and `command_session` step-up cookies are `SameSite=Lax`/`Strict` (CSRF hardening for the destructive Command Centre POSTs). This is the framework default but not explicitly set in code.
**Resolving evidence:** inspect the cookie attributes on a production response.

---

## Already resolved (owner-confirmed — recorded for completeness)
- Inbound-email secret set in prod + SendGrid URL updated — **Yes**.
- Rate limiting live in prod — **Yes**.
- Supabase production region — **EU**.
- Document buckets private — **Yes**.
- 7-year retention & portal-contact erasure are **manual** processes — **Confirmed**.
- Data-protection lead formally appointed (the founder) and breach procedure reviewed/tested — **Yes**.
- AI off-switch should be enforced — **Yes, and done during this audit**.
