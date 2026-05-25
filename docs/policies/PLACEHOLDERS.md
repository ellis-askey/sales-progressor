# Unfilled placeholders — final post-incorporation fill list

Updated 25 May 2026 after all `[COUNSEL TO CONFIRM]` flags resolved with settled positions and stripped from the public render. Editorial scaffolding removed. The verbose "TBC on incorporation" placeholder language has been replaced with clean inline `[Company number]` / `[Registered office address]` placeholders.

**Only two placeholders remain across the entire legal pack**, both pending Companies House registration. Everything else is settled copy ready for solicitor review.

---

## The two remaining placeholders

| Placeholder | What it needs |
|---|---|
| `[Company number]` | The Companies House registered company number for The Sales Progressor Ltd |
| `[Registered office address]` | The registered office address as filed with Companies House |

Both are filled by the same trigger: Ellis completes the Companies House registration. Both have to be done together; neither requires legal review.

---

## Where they appear (the fill list)

### Public pages (static React content — search-and-replace fill)

| Page | Section | Source file | What the line says today |
|---|---|---|---|
| **/privacy** | § 1 Who we are | [app/privacy/page.tsx](../../app/privacy/page.tsx) | "...operated by The Sales Progressor Ltd, a company registered in England and Wales, company number [Company number], registered office [Registered office address]." |
| **/privacy** | § 11 Contact | [app/privacy/page.tsx](../../app/privacy/page.tsx) | "Data controller: The Sales Progressor Ltd, company number [Company number], registered office [Registered office address]." |
| **/terms** | § 1 About this service | [app/terms/page.tsx](../../app/terms/page.tsx) | "...operated by The Sales Progressor Ltd, a company registered in England and Wales, company number [Company number], registered office [Registered office address]..." |
| **/legal/dpa** | Parties | [app/legal/dpa/page.tsx](../../app/legal/dpa/page.tsx) | "The Processor — The Sales Progressor Ltd, company number [Company number], registered office [Registered office address]..." |
| **/billing-terms** | Sales Progressor — pricing | [app/billing-terms/page.tsx](../../app/billing-terms/page.tsx) | "...Billing is operated by The Sales Progressor Ltd, company number [Company number], registered office [Registered office address]." |

### DB-versioned billing terms — needs a NEW TermsVersion (v4)

The current live billing acknowledgement is **v3** (`2026-06-payments-v3`), which embeds the placeholder language inline because Stripe Elements is gated by the disclosure tick at signup and we cannot edit a TermsVersion in place once it's been acknowledged. To fill the placeholders in the disclosure that directors actually see when saving a card, ship a **v4** TermsVersion with the entity values inline.

Process for v4 (when ready, post-incorporation):

1. Update three files with the real values (single edit pattern, copy-paste between):
   - **NEW** migration: `prisma/migrations/<timestamp>_terms_version_v4/migration.sql` — mirror of v3 with the real entity values substituted into the "Sales Progressor — pricing" section body.
   - **NEW** script: `scripts/insert-prod-terms-v4.ts` — mirror of v3 with the same substitution.
   - **UPDATE**: `app/billing-terms/page.tsx` — change version string + the inline JSX to match.
2. Run migration on staging → verify v4 disclosure renders correctly with real entity data.
3. Run migration on prod → existing directors re-acknowledge v4 on next card action; v3 acknowledgements remain valid against v3 only.

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
