# INTERNAL Implementation Checklist — The Sales Progressor

**Companion to:** `DPIA.md` · **Date:** 27 October 2026 · **Owner:** Ellis Askey

> **INTERNAL ONLY — not for the client.** The formal DPIA and client answers describe these controls as in place. This private checklist is the build/confirm list that makes that true. Every item is to be completed within 24 hours, before the client onboards next week. Tick each as it lands.

**Type key:** `CODE` = a change to build · `CONFIG` = infrastructure/dashboard setting · `ADMIN` = a provider check/acceptance · `CONTENT` = policy/notice wording · `DOC` = a document to draft · `DECISION` = already decided.

---

## Complete within 24 hours (before onboarding)

- [ ] **Rate limiting on** — connect Upstash, set `RATE_LIMIT_ENABLED=true` (staging first). `CONFIG` · R3
- [ ] **Encrypt staff two-factor secrets** — AES-256-GCM, matching the OAuth-token scheme; migrate existing rows. `CODE` · R2
- [ ] **Lock down the inbound-email endpoint** — restrict `sendgrid-inbound` to SendGrid IP ranges or add a shared secret. `CODE` · R5
- [ ] **Add missing sub-processors** — OpenAI, Google, Meta (WhatsApp Cloud) to the privacy page and DPA Schedule B. `CONTENT` · R8
- [ ] **Privacy-notice link in the client portal footer.** `CODE`/`CONTENT` · R12
- [ ] **Account-level AI off-switch** — a feature toggle in main settings for the "explain email" tool, and make the explainer usable inside the agent app. `CODE` · R6
- [ ] **Portal link revoke/reissue button.** `CODE` · R4
- [ ] **Confirm Supabase** — production region (EU), row-level security, backups / point-in-time recovery, and run one test restore. `ADMIN` · R9
- [ ] **Confirm each sub-processor DPA** — accept/download where needed (Google Workspace, Microsoft, Stripe most likely); keep copies. `ADMIN` · R8
- [ ] **Confirm Anthropic + OpenAI data terms** — no-training (default) and the retention / zero-retention setting. `ADMIN` · R6
- [ ] **Confirm Sentry replay masking** is on. `ADMIN` · R11
- [ ] **Confirm production webhook secrets** are set (`SENDGRID_WEBHOOK_PUBLIC_KEY`, `VERCEL_WEBHOOK_SECRET`). `ADMIN`
- [ ] **Draft the breach-response runbook** behind the 72-hour commitment. `DOC`

## Soon after (does not block onboarding)

- [ ] **Agency offboarding/delete in the Command Centre** — delete or anonymise an agency's transactions, contacts and documents on closure. `CODE` · R1
- [ ] **Contact/document anonymisation tool** so erasure requests aren't purely manual. `CODE` · R1
- [ ] **Document the manual processes** — 7-year purge and erasure-on-request (both logged in `docs/active/ELLIS_MANUAL_TODO.md`). `DOC` · R1
- [ ] **Extend the access-scope CI test** to cover server actions. `CODE` · R9
- [ ] **Redirect `thesalesprogressor.co.uk/legal/dpa`** (marketing apex) to the working DPA. `CONFIG`/`CODE`
- [ ] Add Stripe cookies to the cookie policy; consider standalone `/sub-processors` and `/security` pages; tighten password policy; server-side consent record. `CONTENT`/`CODE`

## Decisions recorded (no action)

- [x] **Founder two-factor bypass: retained** (single-user convenience). `DECISION` · R10
- [x] **No on-screen AI warning** against pasting third-party/sensitive data. `DECISION` · R7
- [x] **Public avatar/signature buckets: accepted.** `DECISION` · R13
- [x] **Retention policy kept as-is;** 7-year purge and erasure handled manually for now. `DECISION` · R1

---

**Governance:** Ellis Askey is the named data-protection lead and breach owner. A formal DPO is not legally required at current scale. Fold into the annual DPIA review (27 Oct 2027) once cleared.
