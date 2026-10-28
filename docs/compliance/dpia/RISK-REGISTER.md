# Privacy Risk Register — The Sales Progressor

**Companion to:** `DPIA.md` · **Date:** 27 October 2026 · **Owner:** Ellis Askey

## Methodology

Each risk is rated on **Likelihood** (how likely it is to happen) and **Severity** (how much harm it would cause an individual), each Low / Medium / High. The two combine into an overall rating:

| | Severity Low | Severity Medium | Severity High |
|---|---|---|---|
| **Likelihood High** | Medium | High | Critical |
| **Likelihood Medium** | Low | Medium | High |
| **Likelihood Low** | Low | Low | Medium |

"Risk to the individual" means harm to a person's privacy or rights, not commercial risk to the business. **Inherent** = the risk before controls. **Residual** = the risk with the controls now in place.

---

## Register

### R1 — Storage limitation / erasure of client records
- **What / evidence:** the 7-year retention after completion and the erasure of a client's records on request are operated as a **documented manual process** (owner: Ellis), rather than by an automated job. Inactive staff logins are additionally auto-anonymised after 3 years (`app/api/cron/data-retention`).
- **Harm if uncontrolled:** data kept longer than necessary; erasure requests unmet.
- **Likelihood High · Severity Medium · Inherent High**
- **Control (in place):** documented manual 7-year purge and erasure process, owned by the data-protection lead; automated staff-account anonymisation.
- **Residual: Medium** (a documented manual process is the control in place; a tooling enhancement is tracked on the internal checklist).

### R2 — Staff two-factor secrets at rest
- **Control (in place):** staff two-factor secrets are encrypted at rest (AES-256-GCM), matching the OAuth-token scheme; superadmin secrets already were.
- **Likelihood Low · Severity High · Inherent High · Residual: Low**

### R3 — Brute-force protection
- **Control (in place):** rate limiting is enabled in production (login, reset, portal, AI, invites), throttling repeated attempts.
- **Likelihood Medium · Severity Medium · Inherent High · Residual: Low**

### R4 — Portal link lifetime
- **Evidence:** `Contact.portalToken` is a strong random UUID (not guessable).
- **Control (in place):** a "revoke and reissue link" control lets a leaked or forwarded link be invalidated.
- **Likelihood Medium · Severity Medium · Inherent Medium · Residual: Low–Medium**

### R5 — Inbound-email endpoint
- **Control (in place):** the inbound-email endpoint is restricted (provider IP range / shared secret) in addition to the unguessable reply address.
- **Likelihood Low · Severity Medium · Inherent Medium · Residual: Low**

### R6 — AI "explain email" data handling
- **Evidence / controls (in place):** content is not stored by us and not used to train models (commercial API); the feature has an account-level off-switch in settings and is available in the agent app for staff to trial. The pasted text is sent to the provider to generate the explanation and is not minimised.
- **Decision:** no on-screen warning (owner-accepted).
- **Likelihood Medium · Severity Medium · Inherent Medium–High · Residual: Medium**

### R7 — Inadvertent special-category / criminal data
- **Controls:** contractually barred in the DPA; AI does not store content; no automated detection (owner-accepted residual).
- **Likelihood Medium · Severity Medium · Inherent Medium · Residual: Medium (accepted)**

### R8 — International transfers / sub-processor transparency
- **Controls (in place):** each US sub-processor is covered by a data-processing agreement incorporating SCCs / UK IDTA; OpenAI, Google and Meta (WhatsApp Cloud) are included in the published sub-processor list (privacy page and DPA Schedule B).
- **Likelihood High · Severity Medium · Inherent Medium–High · Residual: Low–Medium**

### R9 — Tenant isolation / recovery
- **Evidence / controls (in place):** tenant isolation is enforced in application code and verified across the transaction, contacts, documents, portal and solicitor surfaces; a CI test guards the access-scope helper; database backups are enabled.
- **Likelihood Low · Severity High · Inherent Medium · Residual: Low–Medium**

### R10 — Founder two-factor bypass (owner-accepted)
- **Evidence:** the founder account skips the Command Centre two-factor step (`middleware.ts`).
- **Decision:** **retained** (single-user founder convenience). Compensating controls: password + agent-side two-factor + optional IP allowlist.
- **Likelihood Low · Severity High · Inherent Medium · Residual: Medium (owner-accepted, documented)**

### R11 — Error-monitoring masking
- **Control (in place):** Sentry does not auto-capture personal data; error-replay text/input masking is enabled.
- **Likelihood Low · Severity Low–Medium · Inherent Low–Medium · Residual: Low**

### R12 — Portal transparency
- **Control (in place):** the client portal links to the privacy notice.
- **Likelihood High · Severity Low · Inherent Medium · Residual: Low**

### R13 — Public avatar / signature buckets (owner-accepted)
- **Decision:** accepted (low-sensitivity images).
- **Likelihood Low · Severity Low · Inherent Low · Residual: Low**

---

## Summary

No **Critical** residual risks. The highest residual risks are **Medium** (R1 retention, R6 AI, R7 special-category, R10 founder bypass), each with a control in place or a documented owner acceptance. With these controls in place, the platform's privacy posture is proportionate for onboarding the client.
