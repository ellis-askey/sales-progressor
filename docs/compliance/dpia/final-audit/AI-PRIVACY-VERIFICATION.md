# AI Privacy Verification

**Date:** 28 October 2026. Independent, evidence-backed. Every AI call in the current code goes to a **US** provider (Anthropic or OpenAI). Provider training/retention terms are **NOT-VERIFIED** (contractual — see `OUTSTANDING-QUESTIONS.md` Q1).

## Enforcement verdicts (the headline checks)

1. **Client "explain email" off-switch — NOW ENFORCED [VERIFIED-CODE, fixed this audit].** Previously the agency flag `aiExplainEmailEnabled` gated only the UI card, not the API. The route `app/api/portal/explain-email/route.ts` now resolves the responsible party (progression business if the file is theirs, else the agency) and returns **403** when the flag is off. A disabled agency's portal token can no longer obtain AI output.
2. **Staff "try it" endpoint `app/api/agent/explain-email/route.ts` [VERIFIED-CODE].** Auth = `getServerSession` → 401 if no session. Any authenticated staff role may call it; **no rate limit**; **stores nothing**.
3. **Shared prompt [VERIFIED-CODE].** Both routes use `lib/ai/explain-email-prompt.ts` (explain-only, "never give legal advice").
4. **Portal explain-email does not store content [VERIFIED-CODE].** Only a metadata marker is written (an `internal_note` recording that the feature was used, including the contact's name); the pasted email is never persisted or logged.
5. **No account-level off-switch for the other AI features [VERIFIED-CODE].** Chase, inbound-read (global env flag `EMAIL_AI_READ_ENABLED`), memo-parse and the rest have no per-agency toggle.
6. **Content does not reach Sentry/PostHog [VERIFIED-CODE].** `sendDefaultPii:false`; no AI bodies passed to capture functions; PostHog is masked/allow-listed.

## Full AI feature inventory (data sent, storage, minimisation)

All to Anthropic (US) unless marked. "Stored" = persisted by TSP.

| # | Feature (file) | Model | Data sent | 3rd-party PII? | Stored by TSP? |
|---|---|---|---|---|---|
| 1 | Portal explain-email (`app/api/portal/explain-email/route.ts`) | claude-haiku-4-5-20251001 | Full pasted solicitor email ≤8000 chars — **not minimised** | Yes | No (usage marker only) |
| 2 | Staff explain-email (`app/api/agent/explain-email/route.ts`) | claude-haiku-4-5 | Full pasted email ≤8000 | Yes | No |
| 3 | Chase generation (`app/api/ai/generate-chase/route.ts`) | claude-haiku-4-5 | **Minimised** (street-only, first name, role counts, codes) | First name | Output on send |
| 4 | Enquiry chase (`.../generate-enquiry-chase`) | claude-haiku-4-5 | Minimised | First name | On send |
| 5 | Refine email (`.../refine-email`) | claude-haiku-4-5 | **Full draft HTML ≤40,000** | Yes (draft-dependent) | On send |
| 6 | Draft-for-everyone (`.../draft-update`) | claude-haiku-4-5 | One typed fact, street-only, firm names | Firm names | On apply |
| 7 | Chase follow-up (`.../chase-followup`) | claude-haiku-4-5 | Sent chase text ≤4000, step/firm names | Firm names | On apply |
| 8 | Voice update plan (`.../extract-update`) | claude-haiku-4-5 | Transcript ≤4000 + **full seller/buyer names** | **Yes — full names** | Plan not auto-stored |
| 9 | Memo-of-sale parse (`app/api/agent/memo-parse`) | claude-sonnet-4-6 | **Entire uploaded PDF/image ≤10MB** | **Yes — names/phones/emails by design** | Original file stored to Storage |
| 10 | Inbound email AI read (`lib/services/email-read.ts`) | claude-haiku-4-5 | Cleaned inbound body ≤1500 chars + step lists | Yes | **Summary + suggestions stored** on the message (`providerWebhookData.read`) |
| 11 | Transaction summary (`app/actions/transaction-summary.ts`) | claude-haiku-4-5 | **Minimised + redacted**; founder-only allow-list | Redacted | No |
| 12 | Daily founder brief (`lib/services/insight/daily-brief.ts`) | claude-haiku-4-5 | Aggregated metrics | Possibly | OutboundMessage |
| 13 | Weekly review (`.../weekly-review.ts`) | claude-opus-4-8 | Aggregated insight | Possibly | Likely stored |
| 14 | Neighbour/chain chase (`lib/services/neighbour-chase.ts`) | claude-haiku-4-5 | Chain step context | Possibly | On send |
| 15 | Voice-profile distil (`lib/chase/voice-profile.ts`) | claude-haiku-4-5 | Chase pairs, **redacted** | Redacted | Style-only profile on User |
| 16 | Progression agent loop (`lib/agent/*`) | claude-haiku-4-5 | Transaction tool context | Likely | Audit run rows |
| 17 | Outreach strategist (`lib/outreach/ai/claude.ts`) | claude-opus-4-8 | Prospect research data | **Yes — prospect PII** | AiModelRun metadata |
| 18 | Outreach reviewer (`lib/outreach/ai/openai.ts`) | **OpenAI (US) gpt-5.5** | Prospect/campaign content | **Yes — prospect PII to OpenAI** | AiModelRun metadata |
| 19 | Prospect research (`lib/prospects/research.ts`) | claude-sonnet-5 | Prospect/web data | Yes | Research results stored |
| 20 | Command Centre content (`lib/command/content/*`) | Claude (superadmin-only) | Marketing content context | Varies | Command DB |

## Minimisation assessment
- **Strong minimisation (PII stripped):** chase (3,4), transaction summary (11), voice-profile (15).
- **Little/no minimisation (full third-party PII sent to a US provider):** explain-email (1,2), refine-email (5), memo-parse (9), voice-update (8), inbound read (10). This is the main AI privacy exposure and should be addressed in the DPIA's necessity/proportionality section.

## Automated decision-making
**None with legal/similar effect [VERIFIED-CODE].** AI is advisory; inbound-read and milestone suggestions are reviewed by a human before anything changes. Article 22 not engaged.

## NOT-VERIFIED (provider-contract dependent)
- Anthropic & OpenAI: no-training and retention/zero-retention — **unconfirmed** (Q1).
- EU/UK residency for AI: **contradicted** — both are reached at US default endpoints; relies on SCCs/IDTA in the provider contracts.
