# Data Flow Map

**Date:** 28 October 2026. Describes how personal data moves through TSP and to external providers.

## High-level flow

```mermaid
flowchart TD
  subgraph Sources
    A1[Agency staff / internal team]
    A2[Buyer / seller portal (token link)]
    A3[Connected mailbox (Outlook/IMAP)]
    A4[WhatsApp Business API]
    A5[Migration spreadsheet]
  end

  A1 --> APP[TSP app on Vercel - Dublin/EEA]
  A2 --> APP
  A3 --> APP
  A4 --> APP
  A5 --> APP

  APP --> DB[(Supabase Postgres - EU)]
  APP --> ST[(Supabase Storage - private buckets, signed URLs)]

  APP -->|transactional + inbound email| SG[SendGrid / Twilio - US]
  APP -->|AI assistance| AN[Anthropic API - US]
  APP -->|outreach review only| OA[OpenAI API - US]
  APP -->|billing| STR[Stripe - US]
  APP -->|product analytics - consent-gated, masked| PH[PostHog - EU]
  APP -->|error monitoring - no PII default| SE[Sentry - region TBC]
  APP -->|mailbox access| MS[Microsoft Graph - mailbox region]
  APP -->|staff sign-in| GO[Google OAuth - US]
  APP -->|messaging| ME[Meta WhatsApp Cloud - US]
  APP -->|rate limiting| UP[Upstash Redis - EU]
```

## Who sees what (access, enforced in application code)

| Role | Sees |
|---|---|
| Negotiator | Own files by default; all agency files if a director grants "see all" |
| Director | All files in their agency |
| Internal progressor (sales_progressor) | Assigned files + unassigned pool |
| Admin | All TSP-progressed files |
| Superadmin (founder) | Everything, via the Command Centre |
| Buyer / seller | Only their own sale, strictly minimised (cannot see the other party's contacts or internal notes) [VERIFIED-CODE] |
| Solicitor | Only their own instructed file (signed, expiring link) |

## Key data paths

- **Document upload/download:** browser gets a one-time signed upload URL → Supabase `transaction-documents` (private). Downloads are minted as short-lived signed URLs **only after** an ownership/scope check (`app/api/transactions/[id]/documents/route.ts`, `lib/services/portal.ts`). [VERIFIED-CODE; bucket privacy OWNER-CONFIRMED]
- **Inbound email:** SendGrid Inbound Parse → `/api/webhooks/sendgrid-inbound` (now shared-secret gated, live) → filed onto the matching sale; optionally read by AI (summary stored on the message). [VERIFIED-CODE + OWNER-CONFIRMED]
- **AI explain-email:** portal paste → `/api/portal/explain-email` → **now checks the agency off-switch** → Anthropic (US) → explanation returned; content not stored (only a usage marker). [VERIFIED-CODE, fixed this audit]
- **Consent:** cookie choice → localStorage (source of truth) + `/api/consent` writes a server-side `ConsentRecord` (audit-only). [VERIFIED-CODE]
- **Erasure / offboarding:** superadmin Command Centre tools remove storage objects then DB rows, scoped to one agency/contact, audit-logged. [VERIFIED-CODE]

## International transfers
EEA/EU: Supabase (EU), Vercel compute (Dublin), PostHog (EU), Upstash (EU, NOT-VERIFIED), Railway (EU, NOT-VERIFIED).
US (SCCs/IDTA asserted, NOT-VERIFIED contractually): Anthropic, OpenAI, SendGrid, Stripe, Google, Meta; Vercel (US entity). Microsoft per mailbox region. Sentry per DSN (NOT-VERIFIED).
