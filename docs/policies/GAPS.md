# Policies — gaps and adjacent surfaces

What we DON'T have a policy for and arguably should, plus consent surfaces that aren't strictly "policies" but interact with them.

## Policies that should exist but don't

### Data Processing Agreement (DPA) — controller-to-processor
**What it is:** A B2B contract where the customer (estate agency, a data controller) appoints us (the processor) to handle their data — required under UK GDPR Art. 28 when a processor handles personal data on the controller's behalf.

**Why we need it:** Estate agencies are the data controllers for their clients' (buyers, sellers, solicitors) data. We process that data on their behalf. UK GDPR REQUIRES this relationship to be governed by a written contract with specific clauses (purpose, duration, sub-processor approval, security obligations, breach notification, audit rights, return/deletion at end, etc.).

**What we have today:** Nothing standalone. Privacy Policy section 4 mentions "Each [sub-processor] processes personal data only on our instructions and under a data processing agreement" — but that's describing our DPAs with OUR sub-processors, not the agency's DPA with us.

**Existing nearby:** [`docs/reference/DATA_PROCESSING_OVERVIEW.md`](../reference/DATA_PROCESSING_OVERVIEW.md) — 416 lines, internal-facing reference about how data flows through the system. NOT a user-facing DPA.

**Risk if missing:** Sophisticated agency customers (larger chains, anyone with internal compliance) will refuse to sign up without one. Even single-shop directors might block once they ask their solicitor friend about it.

**Recommendation:** Draft a standard DPA (Schedule A: data categories + processing purposes; Schedule B: sub-processors; Schedule C: technical & organisational measures). Surface as: (a) downloadable PDF linked from Terms, (b) on-screen acknowledgement during signup, OR (c) electronically signed with first invoice. Industry norm is (a) — downloadable, referenced from Terms.

### Sub-processor list (standalone page)
**What it is:** A dedicated, dated, version-controlled list of every third party that processes user data on our behalf.

**Why we need it:** Standard SaaS expectation. Customers want to subscribe to it so they're notified when we add/change sub-processors. Privacy regulations (UK GDPR + EU GDPR) require notification, but customers also expect proactive transparency.

**What we have today:** Privacy Policy section 4 contains the list inline — Supabase, Vercel, SendGrid, Anthropic, Upstash, PostHog. Missing: **Stripe** (added 2026-05-25), **Sentry** (added recently). Inline-in-privacy is acceptable for early-stage but doesn't scale — every sub-processor addition requires a policy update + email notification, easier to manage from a dedicated page.

**Recommendation:** Standalone `/sub-processors` page with: table, last-modified date, RSS/email-subscribe option, change-log. Link from Privacy Policy section 4. Add Stripe + Sentry as part of the next revision regardless.

### Acceptable Use Policy (AUP) — standalone
**What it is:** A standalone document of prohibited uses, often referenced from the Terms.

**Why it might warrant standalone status:** Currently embedded in Terms section 3 (5 bullet points). Standalone status makes it easier to update without re-versioning all Terms.

**Recommendation:** **Don't bother.** For our scale and use-case, inline-in-Terms is fine. Flag this as a deliberate decision rather than an oversight. Revisit if/when we hit enterprise contracts.

### Security Overview / Security Page
**What it is:** A public-facing description of security measures — encryption at rest/transit, access controls, audit logging, breach response, certifications (if any).

**Why we need it:** Sales-cycle artefact. Anyone evaluating us professionally will ask for this; not having one is a friction point. Also reinforces trust in the privacy policy commitments.

**What we have today:** Nothing user-facing. Internal: codebase has access controls + role gates + audit logging.

**Recommendation:** Worth creating a brief `/security` page once there's customer demand. For now, parked.

### Service Level Agreement (SLA)
**What it is:** Contractual uptime/availability commitments, response-time guarantees, credit-back mechanics for breaches.

**Why we DON'T need one yet:** Self-serve sign-up + per-sale pricing means no enterprise contracts. SLAs are an enterprise feature. Current Terms section 6 ("we aim to maintain reliable service availability but do not guarantee uninterrupted access") is the right posture for now.

**Recommendation:** Skip until/unless we sell to a chain with SLA requirements.

### Refund Policy
**What it is:** Standalone document describing when and how customers can get a refund.

**Why we don't need a standalone one:** Our pricing model is per-sale, post-exchange. There's nothing to refund in the traditional sense — fees are only charged after the sale exchanges. The system has a **credit-note mechanism** for reversed exchanges (handled automatically), which is the closest analogue.

**Recommendation:** Add a brief mention to the [Billing Terms](./billing-terms.md) ("If an exchanged sale is later un-done, the fee is reversed as a credit"). Don't create a standalone document.

### Modern Slavery Statement
**What it is:** Required under the Modern Slavery Act 2015 for UK companies with global turnover ≥ £36m. Self-published statement of measures taken to ensure no slavery in our operations or supply chain.

**Why we don't need one yet:** We're under the threshold by ~£35.99m. Revisit at scale.

### Whistleblower / Reporting Channel
**What it is:** A channel for employees/customers to report concerns. Required for some companies under the EU Whistleblower Directive (and good practice generally).

**Why we don't need one yet:** Pre-launch, no employees beyond the founder, no UK whistleblower obligation at this size.

---

## Consent surfaces — adjacent to policies but not policies themselves

### Register-page consent ([`app/register/page.tsx`](../../app/register/page.tsx))
**What it is:** Checkbox during signup: *"By creating an account, you agree to our Terms of Service and Privacy Policy"* with links to both. Records consent via a `termsAccepted` boolean state that must be ticked to proceed.

**Status:** Implemented. Stores the acceptance implicitly via account creation (no separate `terms_accepted_at` column on the User table that I'm aware of — verify).

**Improvement opportunity:** No `acceptedTermsVersion` or `acceptedAt` column on User means we can't prove which version a user accepted at signup. UK GDPR best practice for tracking consent: record version + timestamp. **Worth a small future migration:** add `User.termsAcceptedVersion` (string) + `User.termsAcceptedAt` (timestamp). Not a policy doc itself but mentioned here for completeness.

### Cookie consent banner — EXISTS AND WORKS (correcting an earlier compilation error)

**Earlier draft of this doc claimed the banner didn't exist.** That was wrong — the compiler (Claude) grepped for the `cookie-consent` localStorage key string and only found the policy page + reset button, missing the actual component because it's named `CookieConsentBanner`, not anything containing the string `cookie-consent`. Verified end-to-end on 2026-05-25 after Ellis pushed back.

**What's actually implemented:**
- [`components/analytics/CookieConsentBanner.tsx`](../../components/analytics/CookieConsentBanner.tsx) — floating consent card, bottom-right, three equally-weighted CTAs (Accept all / Essential only / Manage) per ICO guidance. Manage opens a modal with granular toggles.
- [`components/analytics/PostHogProvider.tsx`](../../components/analytics/PostHogProvider.tsx) — initialises PostHog only after consent, listens for `consent-updated` events to re-init or reset as the user changes mind.
- [`lib/analytics/consent.ts`](../../lib/analytics/consent.ts) — writes consent to BOTH localStorage (source of truth, JSON with `decidedAt` timestamp) AND a plain cookie `cookie-consent=accepted|declined` (1-year max-age, SSR-readable). Dispatches `consent-updated` CustomEvent on change.
- [`lib/analytics/posthog.ts`](../../lib/analytics/posthog.ts) — module-level `_initialized` flag; `init(consent)` is a no-op when consent is false; `track()` and `identify()` are no-ops while `_initialized === false`. Header comment: *"SDK is never initialised, identified, or captured before consent is given."*
- Mounted in [`app/layout.tsx:40`](../../app/layout.tsx#L40); banner suppressed for internal staff (`!isInternalStaff`).

**Cookie policy text matches reality.** *"We ask for this when you first visit, and you can accept or decline"* — that's exactly what happens.

**Remaining minor gaps** worth noting (these are real, unlike the "no banner" claim):
- Sentry was added recently and its consent treatment isn't reviewed here.
- Consent is stored on the user's device only — no server-side audit record of who consented to what when. If a regulator asks "prove this user consented on X date" we can't, because the localStorage value is theirs. Worth a discussion with counsel re: whether this is sufficient for PECR/UK GDPR.
- Stripe.js may set its own cookies (`__stripe_mid`, `__stripe_sid`) when the card-save form loads — those aren't listed in the cookie policy. Should add.

### Billing terms acknowledgement (covered in [`billing-terms.md`](./billing-terms.md))
**What it is:** The "tick to agree" gate on card-save, recorded in `PricingAcknowledgement` (timestamped + version-tagged).

**Status:** Fully implemented + production-live since 2026-05-25.

### Negotiator-acceptance email + onboarding flow
**What it is:** When a director invites a negotiator, the negotiator gets an email with a sign-up link → registration → enters their own account. They tick the terms checkbox at that point.

**Status:** Implemented. Same consent mechanic as direct sign-up.

### Portal access by buyers/sellers
**What it is:** Buyers/sellers receive a personal portal link (token-authenticated) from the agency. They DON'T sign up or tick any consent — they just visit the link.

**Status:** Implemented. **This is an interesting privacy boundary:** the buyer/seller never accepts our Terms or Privacy Policy directly. Their data is in our system because the agency (their data controller) put it there. Their lawful basis for being in our system is the agency's lawful basis (legitimate interest, contract performance with their estate agent). Our Privacy Policy section 6 directs them to "contact their estate agent in the first instance" for data-subject rights, which is correct under the controller-processor model.

**Improvement opportunity:** When a buyer/seller first visits their portal, should we surface a brief privacy notice ("This portal is provided by [agency name] using Sales Progressor's platform. Our [link to privacy] explains how we handle data; for questions about your specific data, contact [agency].")? Currently nothing of the sort exists. Worth a counsel consultation — might be required for transparency obligations.

---

## Editorial / process improvements (not policies themselves)

- **Single source of truth for sub-processor list.** Currently lives in two places (Privacy section 4 + Cookie Policy third-party processors). Drift risk. Worth either (a) consolidating into one source the other references, or (b) committing to an editorial sync process.
- **No version control on policy revisions.** Privacy/Terms/Cookies all say "Last updated: May 2026" but there's no diff history visible to users. Standard practice: include a "Version 1.0 — first published 25 May 2026" footer + maintain a public changelog page (or commit-log link). For now the git history serves this role internally.
- **No effective-date mechanism.** Terms section 7 says "we will notify registered account holders of material changes by email before they take effect" — but there's no in-platform mechanism for this. Either build one (recommended: leverage the existing TermsVersion pattern used for billing terms — version tag + email blast + acknowledgement) or soften the language.
- **No common header/footer with last-revision metadata.** Each policy page renders its own date + back-link in its own style. Consider extracting a shared `<PolicyShell>` component that takes title + last-revised + content. Out of scope for this review but worth flagging.
- **No "policies hub" page** linking all three from one place. Current pattern: footer links + cross-references in body text. A `/legal` index page would be useful (and is standard for SaaS).
