# GDPR Compliance Gaps — categorised

**Date:** 28 October 2026. Separates what is a code issue, a policy gap, a contractual/provider confirmation, a business decision, or a legal-review matter. This is a factual gap list, not a compliance determination.

## 1. Technical issues (code)
- **Consent endpoint has no rate limit; `ConsentRecord` (IP + user-agent) has no purge.** [NOT-IMPLEMENTED] Low risk; recommended follow-up.
- **No automatic portal-link expiry** (manual reset only). [NOT-IMPLEMENTED by design]
- **No automated 7-year transaction/contact/document purge** (manual, owner-confirmed). [NOT-IMPLEMENTED by decision]
- **Two-factor format edge case** for a superadmin enrolled via the Command Centre path. [PARTIALLY-VERIFIED] Needs a DB check (Q6).
- **Resolved during this audit:** AI off-switch now enforced; stale password hints aligned; Microsoft added to DPA table.

## 2. Missing / incomplete policies & notices
- **Portal privacy notice** is only in the Settings tab, not the main portal view. [PARTIALLY-VERIFIED]
- **No standalone `/sub-processors` or `/security` page** (lists are inline in privacy/DPA). [NOT-IMPLEMENTED]
- **Breach-response runbook exists** (`docs/compliance/BREACH-RESPONSE-RUNBOOK.md`) and the owner confirms the procedure has been reviewed/tested. [DOCUMENT + OWNER-CONFIRMED]

## 3. Missing contractual / provider evidence (NOT-VERIFIED)
- **Anthropic / OpenAI**: no-training and retention/zero-retention terms (Q1). **Material.**
- **Signed DPAs / SCCs / UK IDTA** for each US sub-processor (Anthropic, OpenAI, SendGrid, Stripe, Google, Meta, Vercel, Microsoft) (Q3).

## 4. Provider / dashboard verification required (NOT-VERIFIED)
- **Supabase**: row-level security on/off; backups/PITR enabled + test-restored (Q2). Region EU is OWNER-CONFIRMED.
- **Sentry**: replay text/input masking; DSN region (Q4).
- **Upstash / Railway** regions (Q5).
- **Cookie SameSite** on the session + step-up cookies (Q7).

## 5. Business decisions (owner to confirm/own)
- Retention operated manually (confirmed). 
- Founder two-factor step-up bypass retained (accepted).
- Public avatar/signature buckets (accepted).
- No on-screen AI input warning (accepted).
- Self-service data-subject rights for portal contacts are **not** provided; requests are handled via the agency (controller) and executed by superadmin tooling — confirm this is the intended processor-model posture.

## 6. Matters for qualified legal review
- Whether the current transfer safeguards (SCCs/IDTA) for US AI providers are adequate given unminimised third-party personal data in some features.
- Lawful-basis mapping (Article 6) and whether any processing of potentially special-category data in free text/documents needs an Article 9 condition.
- Whether the residual risk profile requires ICO prior consultation (current assessment: no, as no residual risk is High-and-unmitigable once Q1/Q2 are resolved — but this is a legal judgement).
