# Legal-pack entity placeholders — fill status

Updated **14 Sept 2026**. The company number and registered office are now confirmed and filled across every static policy page (see below). All `[COUNSEL TO CONFIRM]` flags were resolved back on 25 May 2026; editorial scaffolding removed.

**Confirmed entity values (filled 14 Sept 2026):**

| Placeholder | Value |
|---|---|
| `[Company number]` | **17455131** |
| `[Registered office address]` / `[Postal address]` | **5 Hercules Way, Leavesden Park, Watford WD25 7GS, United Kingdom** |

> Note: Ellis supplied the address as "5 Hercules Way, Leavesden, Park, Watford WD25 7GS". Rendered as **Leavesden Park** (the business-park name at that postcode); confirm if a different reading was intended.

---

## Static public pages — FILLED ✅ (14 Sept 2026)

All `.pending` chips replaced with the confirmed values; no `[…]` placeholders remain in these files.

| Page | Section | Source file |
|---|---|---|
| **/privacy** | § 1 Who we are + § 11 Contact | [app/privacy/page.tsx](../../app/privacy/page.tsx) |
| **/terms** | § 1 About this service | [app/terms/page.tsx](../../app/terms/page.tsx) |
| **/legal/dpa** | Parties | [app/legal/dpa/page.tsx](../../app/legal/dpa/page.tsx) |
| **/provider-terms** | § 1 About these terms + § 13 (postal address) | [app/provider-terms/page.tsx](../../app/provider-terms/page.tsx) |
| **/billing-terms** | About these terms (public preview) | [app/billing-terms/page.tsx](../../app/billing-terms/page.tsx) |
| **/outsourced-terms** | Introduction (entity line newly added) | [app/outsourced-terms/page.tsx](../../app/outsourced-terms/page.tsx) |
| **/cookie-policy** | § 9 Contact (entity line newly added) | [app/cookie-policy/page.tsx](../../app/cookie-policy/page.tsx) |

### DB-versioned billing terms — STILL PENDING a new TermsVersion (v7) ⚠️

The public `/billing-terms` page is only a preview. The disclosure directors actually **acknowledge when saving a card** is served from the database (`getActiveTermsVersion()`), currently **v6** (`2026-08-payments-v6`). Its "About these terms" body reads:

> "By saving a payment card, you agree to the pricing and billing terms set out below. Billing is operated by The Sales Progressor."

It has **no company number / registered office** (the entity line was deliberately stripped from v4 while the number was unknown). A TermsVersion cannot be edited in place once acknowledged, so adding the entity details to the acknowledgement disclosure requires shipping a **v7** TermsVersion:

1. **NEW** migration `prisma/migrations/<timestamp>_terms_version_v7/migration.sql` — mirror of v6 with the entity line restored in "About these terms" (company number 17455131, registered office 5 Hercules Way, Leavesden Park, Watford WD25 7GS, United Kingdom).
2. **NEW** script `scripts/insert-prod-terms-v7.ts` — mirror for prod insert.
3. Apply on **staging first** (Law 3) → verify the disclosure renders with the entity data → then prod. Existing directors re-acknowledge v7 on their next card action; v6 acknowledgements remain valid against v6.

This is deferred until Ellis confirms he wants the entity details in the card-acknowledgement disclosure too (not just the public pages).

---

## What's NOT a placeholder (already settled)

For reference, in case there's any confusion about what's "open" — these are all settled copy as of 25 May 2026:

- All UK GDPR lawful-basis mappings (Privacy § 3)
- 7-year retention with AML/HMRC grounding (Privacy § 5)
- Erasure-via-anonymisation when records must be retained (Privacy § 5)
- Liability cap = fees paid in prior 12 months + non-excludable carve-out (Terms § 10)
- 14-day payment-failure warning + 7-day grace + block (Billing Terms)
- 30-day pricing-change notice with in-flight protection (Billing Terms)
- Sentry classified as strictly-necessary error monitoring, not consent-gated (Cookie Policy § 5)
- General sub-processor authorisation model (DPA § 5)
- All Article 28(3) processor obligations (DPA § 3)
- Schedule C technical & organisational measures (DPA)
- Sub-processor list (8 providers across Privacy § 4, Cookie § 8, DPA Schedule B)

All of the above are positions Ellis has settled. The solicitor reviewing the pack will see them as written, not as open questions.

---

## Editorial scaffolding — stripped from public render

The following were stripped from what users see, but the source files retain a brief header comment per page noting that flags were resolved on 25 May 2026 (for future-traceability via git log):

- All `[COUNSEL TO CONFIRM]` inline notes — gone from rendered pages
- All "Editor's note" callouts — gone from rendered pages
- All "TBC on incorporation" explanatory phrasing — replaced with clean `[Company number]` / `[Registered office address]` placeholders
- DPIA/DPO mentions on the public Privacy page — removed entirely (internal-only concern)

Annotated source markdowns in this folder (`privacy-policy.md`, `terms-of-service.md`, etc.) are now historical — they describe the v1 draft state. The live page source is the authoritative version going forward.
