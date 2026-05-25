# Unfilled placeholders — checklist for the final fill

Generated as part of shipping the v1 (and v2 billing terms) legal-pack on 25 May 2026.

Every placeholder still in the live pages is listed here with the document, the section, the visible text, and **why it's still blank**. Three categories:

- **Incorporation-pending** — needs a real value once The Sales Progressor Ltd is registered at Companies House. Fillable by Ellis without counsel.
- **Counsel-pending** — needs the solicitor to confirm or refine before going live. Should NOT be filled unilaterally.
- **Needs-Ellis-input** — needs a factual answer from Ellis that doesn't require counsel.

When you fill one, delete its row from this checklist + update the corresponding `docs/policies/<doc>.md` annotation + edit the live page source.

---

## Incorporation-pending (4 placeholders)

| Page | Section | Visible text | Where in source |
|---|---|---|---|
| [/privacy](../../app/privacy/page.tsx) | §1 Who we are + §11 Contact | "The Sales Progressor Ltd — company number TBC on incorporation, registered office TBC" | `PENDING_ENTITY` + `PENDING_ADDRESS` constants at top of file |
| [/terms](../../app/terms/page.tsx) | §1 About this service | Same | Same constants |
| [/legal/dpa](../../app/legal/dpa/page.tsx) | Parties | "The Sales Progressor Ltd — company number TBC, registered office address TBC" | Same constants |
| [/billing-terms](../../app/billing-terms/page.tsx) + **TermsVersion DB row** | Section 1 "Sales Progressor — pricing" | "Billing is operated by The Sales Progressor Ltd (company number to be added on incorporation), registered office to be added on incorporation." | Live preview: `PENDING_ENTITY` + `PENDING_ADDRESS`. DB row v2: inline plain text — **needs new TermsVersion v3 when filled** (see below). |

**Fill action when ready:**
1. Update the four pages' `PENDING_ENTITY` and `PENDING_ADDRESS` constants with real Companies House details.
2. **Billing terms specifically** — ship a new TermsVersion v3 with the entity details inline. Don't edit v2 in place. (See `docs/policies/billing-terms.md` for the material-change checklist.)

---

## Counsel-pending — for the solicitor to confirm before any change

These stay in the source as inline `COUNSEL NOTES` comments (visible to the lawyer reading the file, not visible on the public page). 18 total across the legal pack — see each page's header comment block for the full list:

| Page | Number of counsel notes | Highest priority items |
|---|---|---|
| [/privacy](../../app/privacy/page.tsx) | 5 | Lawful-basis mapping (§3); 7-year retention + erasure-via-anonymisation question (§5); DPIA / DPO question (page tail) |
| [/terms](../../app/terms/page.tsx) | 4 | **Limitation of liability cap** (§10 — currently no monetary cap; counsel input needed); Consumer Rights Act exposure for single-director agencies (§10); change-notification mechanism wording (§11) |
| [/cookie-policy](../../app/cookie-policy/page.tsx) | 3 | "Strictly necessary" defensibility under ICO guidance (§3); Sentry consent-gating question (§5); server-side consent audit record question (§7) |
| [/legal/dpa](../../app/legal/dpa/page.tsx) | 6 | Art. 28(3) completeness (§3); sub-processor authorisation model (§5); audit clause adequacy for multi-tenant SaaS (§6); Schedule C accuracy |
| [/billing-terms](../../app/billing-terms/page.tsx) | 3 | Payment-failure grace mechanics — state specifics or keep plainer? Pricing-change notice period (specific vs "advance notice"); dispute/chargeback wording + cancellation edge cases |

**Fill action:** none yet — these need legal review first.

---

## Needs-Ellis-input — RESOLVED ✓

**Sentry region resolved 2026-05-25**: confirmed EU (DSN host: `ingest.eu.sentry.io`). All three pages (Privacy §4, Cookies §8, DPA Schedule B) updated to render "EU". No SCCs/IDTA caveat needed since EU is within UK Adequacy.

No remaining items in this category. Every placeholder still outstanding is either incorporation-pending or counsel-pending.

---

## What's NOT a placeholder, but is worth knowing about

These items in the legal pack ARE filled, but are worth flagging so they don't drift:

- **"Last updated" dates** on every page currently say "25 May 2026". Update on every material content change.
- **Version strings** — Privacy / Terms / Cookies / DPA are all `1.0`. Increment on material changes. Billing terms uses date-tagged versions (currently `2026-06-payments-v2`) per its versioning model.
- **Sub-processor list** appears in three places (Privacy §4 + Cookies §8 + DPA Schedule B) and **must stay in sync**. When a new sub-processor is added or one's region/role changes, update all three.
- **AI data inventory in Terms §5** is the literal output of the chase-prompt scrubbing commit (`d26273d`). If the prompt code changes again, update this section.
