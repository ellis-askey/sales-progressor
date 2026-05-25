# Policies — single source of truth for legal copy

A consolidated folder of every policy the platform currently presents (or should present) to users. **Each doc here mirrors the live copy from its source file in the codebase.** Improvements made here need to be pushed back to the source file for users to see them.

Built so a separate review pass (legal counsel, or another Claude session focused on phrasing) can read everything in one place without hunting through `app/`, `prisma/migrations/`, and `scripts/`.

## What's in this folder

| File | What it covers | Live source |
|---|---|---|
| [`privacy-policy.md`](./privacy-policy.md) | UK GDPR notice, data inventory, sub-processors, retention, rights, cookies summary, complaints | [`app/privacy/page.tsx`](../../app/privacy/page.tsx) → `/privacy` |
| [`terms-of-service.md`](./terms-of-service.md) | Service description, account rules, acceptable use, logging, AI features, liability, changes, governing law | [`app/terms/page.tsx`](../../app/terms/page.tsx) → `/terms` |
| [`cookie-policy.md`](./cookie-policy.md) | Cookie definitions, strictly-necessary inventory, analytics (optional/consent-gated), management, third-party processors | [`app/cookie-policy/page.tsx`](../../app/cookie-policy/page.tsx) → `/cookie-policy` |
| [`billing-terms.md`](./billing-terms.md) | What the director ticks when saving a payment card — pricing, billing cadence, trial, payment-failure, who's billed, VAT | DB-stored in `TermsVersion.bodySections`, source in [`prisma/migrations/20260525090000_terms_version_body_sections/migration.sql`](../../prisma/migrations/20260525090000_terms_version_body_sections/migration.sql) + [`scripts/insert-prod-terms-v1.ts`](../../scripts/insert-prod-terms-v1.ts) |
| [`GAPS.md`](./GAPS.md) | What we DON'T have a policy for and probably should (DPA, sub-processor list as a standalone page, etc.) — and what's adjacent but not strictly a policy (consent banner, register-page consent text, data-processing overview) |

## How to use this folder for a review pass

1. **Read everything in this folder first** — fastest way to see the full legal surface.
2. **For each policy doc**, you'll find:
   - **Source** — where the live copy lives (the file that has to be edited for users to see changes)
   - **Current text** — verbatim copy of what's live now
   - **Pre-existing review flags** — every `LEGAL REVIEW REQUIRED` comment already in the source code, with the section it relates to
   - **Observations for the improvement pass** — open questions, gaps, or phrasing issues noted while compiling
3. **For improvements**: edit the live source file directly (path noted at the top of each doc). The text here is a snapshot for review; it won't update if the live page changes unless you re-sync it.
4. **Billing terms have an extra wrinkle**: the canonical copy lives in three places that MUST stay in sync — the migration SQL (history), the insertion script (re-runnable for new envs), and the live `TermsVersion.bodySections` DB row (what users actually acknowledge). Updating any single one without the others creates drift. The terms-version model is designed for versioning — when copy materially changes, ship a NEW `versionTag` row rather than editing the existing one in place.

## Important context

- **Pre-launch status**: the platform is pre-revenue. Production was switched to live Stripe keys on 2026-05-25. ~5 test users, no paying customers yet. None of these policies have been signed off by qualified UK legal counsel — every `LEGAL REVIEW REQUIRED` flag in the source code (and surfaced in the docs here) represents a known open question awaiting that review.
- **Company entity**: live copy refers to "The Sales Progressor Ltd" — verify this matches the registered Companies House entity before launch.
- **Last updated** dates in the live copy say "May 2026" across all three policy pages — these are placeholders, not actual revision dates. Worth setting a proper date-tracking convention as part of the improvement pass.
- **Jurisdiction**: UK GDPR / English law throughout. No multi-jurisdictional concerns yet (single market: UK estate agencies).
- **The cookie consent banner referenced in the cookie policy ("when you first visit, you can accept or decline") doesn't appear to be implemented as a banner component** — only the `cookie-consent` localStorage key reset is in the codebase. See `GAPS.md`.
