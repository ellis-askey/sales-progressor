# Milestone Email Matrix

The CSVs in this folder are the source of truth for milestone email content (subjects, bodies, recipient flags).

When you need to change what fires for a given milestone, edit the CSV first, then update `lib/portal-copy.ts` to match. Do not edit `portal-copy.ts` directly without updating the CSV.

## Files

| File | Purpose |
|---|---|
| `milestone-email-matrix-outsourced-v6.csv` | Email matrix for outsourced files (Sales Progressor internal team manages the file) |
| `milestone-email-matrix-self-managed-v6.csv` | Email matrix for self-managed files (agency manages the file themselves) |

## Structure

Each CSV has three sections:

1. **Section 1 — Seller confirms via portal** (all VM milestones — seller can confirm any VM milestone in the portal, except VM19/VM20 which are agent-only post-exchange)
2. **Section 2 — Buyer confirms via portal** (all PM milestones — buyer can confirm any PM milestone in the portal, except PM26/PM27 which are agent-only post-exchange)
3. **Section 3 — Agent (self-managed) or Sales Progressor (outsourced) confirms in the app** (all 47 milestones)

## Column structure (per section)

`Code | Milestone name | Who performs this step | Seller gets email? | Seller: email subject | Seller: email body | Buyer gets email? | Buyer: email subject | Buyer: email body | Agent gets email? | Agent: email subject | Agent: email body | Progressor gets email? | Progressor: email subject | Progressor: email body | Notes / Known issues`

## Key distinctions

- **Self-managed**: `assignedUser = null` — progressor column = N for ALL milestones
- **Outsourced**: `assignedUser` set — progressor gets email for milestones where Progressor: Y
- Email body copy in Section 3 is canonical (stored in `lib/portal-copy.ts`)
- Agent email body in Section 1/2 may differ slightly from Section 3 (reflects "confirmed via portal" context)
- Bodies may differ between sections but Y/N recipient flags must be consistent across all sections for the same milestone
