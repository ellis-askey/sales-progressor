# Final GDPR & DPIA Verification Audit — Executive Summary

**Platform:** The Sales Progressor (TSP) · **Date:** 28 October 2026
**Nature:** Independent, read-only verification audit to provide the evidence base for a final DPIA. This document does not itself constitute the DPIA.
**Evidence classes used throughout:** VERIFIED-CODE · VERIFIED-CONFIG · OWNER-CONFIRMED · PARTIALLY-VERIFIED · NOT-VERIFIED · NOT-IMPLEMENTED.

---

## Overall finding

The platform's privacy and security posture is **substantially sound and materially improved** since the first audit. Tenant isolation holds, the new destructive tooling is correctly gated, and the large majority of remediation items are genuinely implemented and enforced in code. One **material gap** (an AI off-switch that hid the UI but did not block the API) was found during this audit and **has now been fixed and verified**. A small number of items remain **owner- or contract-dependent** and cannot be proven from code.

**Is the evidence sufficient to prepare a final DPIA?** Yes, with the explicit caveats listed in `OUTSTANDING-QUESTIONS.md`. The two items that must be stated as *unconfirmed* in the DPIA are (a) the Anthropic/OpenAI no-training & retention terms, and (b) Supabase row-level-security and backup/restore testing.

---

## What improved since the first audit

- Staff two-factor secrets are now **encrypted at rest** (new enrolments).
- The client portal now shows a **privacy-notice link**.
- A **"reset link" control** lets staff revoke a client's portal link instantly.
- A single **password policy** (minimum 10 characters + breached-password check) is enforced on every server-side password path.
- A **server-side consent record** is written for cookie choices.
- **OpenAI, Google, Meta and Microsoft** are now disclosed as sub-processors on the privacy and DPA pages.
- New **Command Centre GDPR tools**: erase one person (by email, within an agency) and offboard an agency (reversible close / permanent purge), all superadmin + two-factor step-up + reason + audit-logged.
- The **inbound-email webhook** now requires a shared secret (confirmed live in production by the owner).
- **Rate limiting** is confirmed live in production by the owner.
- The **AI off-switch is now enforced at the API** (fixed during this audit).

## The most significant remaining risks

1. **AI provider terms unconfirmed (NOT-VERIFIED).** All AI calls go to Anthropic and OpenAI in the **US**. Whether they contractually exclude training and offer retention limits is not evidenced and was not confirmed by the owner. Several features send **unminimised third-party personal data** (pasted emails, uploaded documents, full client names). This is the highest-residual privacy item.
2. **Supabase RLS and backup testing unconfirmed (NOT-VERIFIED).** Isolation is enforced in application code (verified); whether database row-level security exists as a second layer, and whether backups have ever been test-restored, are unknown.
3. **Retention is manual, not automated (NOT-IMPLEMENTED, owner-confirmed as intentional).** The 7-year transaction purge and client-contact erasure rely on a person performing them.

## New issues discovered in this audit (and their status)

- **AI off-switch was UI-only** → **FIXED & VERIFIED** (now enforced at the endpoint).
- **Microsoft missing from the DPA sub-processor table** → **FIXED**.
- **Stale "8 characters" password hints** on 3 screens → **FIXED** (aligned to 10).
- **Two-factor format edge case:** a real superadmin-role account enrolled via the Command Centre 2FA path could be locked out of password login. **Pre-existing and narrow**; needs a production DB check. Documented, not changed.
- **Consent endpoint** has no rate limit and consent records (IP + user-agent) have no purge. **Recommended follow-up**, not yet done.

## Outstanding verification requirements

See `OUTSTANDING-QUESTIONS.md`. The materially important ones: Anthropic/OpenAI data terms; Supabase RLS + backup testing; signed sub-processor DPAs/SCCs/IDTA.

## Files in this evidence pack

`REMEDIATION-VERIFICATION.md`, `DATA-PROCESSING-INVENTORY.md`, `DATA-FLOW-MAP.md`, `AI-PRIVACY-VERIFICATION.md`, `SECURITY-AND-ACCESS-VERIFICATION.md`, `FINAL-RISK-REGISTER.md`, `GDPR-COMPLIANCE-GAPS.md`, `OUTSTANDING-QUESTIONS.md`, and the consolidated handover **`DPIA-SOURCE-PACK.md`** (the primary document for drafting the DPIA).
