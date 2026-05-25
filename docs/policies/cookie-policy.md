# Cookie Policy

**Source (live):** [`app/cookie-policy/page.tsx`](../../app/cookie-policy/page.tsx) — served at `/cookie-policy`
**Linked from:** Privacy Policy section 7 (cookies summary), footers
**Helper component:** [`app/cookie-policy/ResetPreferencesButton.tsx`](../../app/cookie-policy/ResetPreferencesButton.tsx) — clears `cookie-consent` localStorage + cookie, reloads page
**Last shown date in copy:** "Last updated: May 2026" (placeholder)

---

## Current text (verbatim from source)

Sales Progressor ("we", "us") uses cookies and similar storage technologies on this website and the Sales Progressor platform. This policy explains what cookies we set, why we set them, and how you can control them.

### What is a cookie?

A cookie is a small text file stored on your device when you visit a website. Cookies help sites remember information about your visit — such as whether you are logged in or what preferences you have set.

### Cookies we use

#### Strictly necessary

These cookies are essential for the platform to work. They cannot be switched off.

| Cookie name | Purpose | Duration |
|---|---|---|
| `next-auth.session-token` (or `__Secure-next-auth.session-token` on HTTPS) | Keeps you logged in to the Sales Progressor platform. | 30 days (or until you sign out) |
| `next-auth.csrf-token` | Protects form submissions against cross-site request forgery attacks. | Session |
| `cookie-consent` | Remembers whether you have accepted or declined optional analytics cookies, so we do not ask again on every visit. | 1 year |
| `command_session` | Command Centre only. Confirms that an authorised administrator has passed two-factor authentication (TOTP step-up) to access the admin console. Not set for regular agency users. | 24 hours |

#### Analytics (optional)

These cookies are **off by default**. We only set them if you click "Accept analytics" in the cookie banner. They help us understand how people use the platform so we can improve it.

| Cookie name | Purpose | Duration |
|---|---|---|
| `ph_*` | PostHog analytics. Records page views and feature interactions (anonymised) to help us understand platform usage. Session recordings are disabled. We collect only a limited set of events, all data is stored on PostHog's EU-region servers. | Up to 1 year |

### How to manage your preferences

You can change your cookie preferences at any time. Clicking the button below will reset your choice and re-show the cookie banner on your next page load.

[*Reset cookie preferences button*]

You can also control cookies through your browser settings. Blocking all cookies may affect your ability to log in and use the platform.

### Third-party processors

Analytics data is processed by **PostHog, Inc.** under a data processing agreement. PostHog stores data on servers within the European Economic Area (EU region). You can read PostHog's privacy policy at posthog.com/privacy.

### Contact

If you have questions about how we use cookies or about your personal data, please email us at support@thesalesprogressor.co.uk.

---

## Pre-existing review flags (4 sections, verbatim from source comments)

1. **Top of policy (PECR compliance)**: *"LEGAL REVIEW REQUIRED — confirm this policy satisfies PECR (Privacy and Electronic Communications Regulations) requirements for UK users; verify consent mechanism for analytics cookies is adequate"*
2. **Strictly-necessary list**: *"LEGAL REVIEW REQUIRED — confirm each cookie listed below matches what is actually set in production; verify the 'strictly necessary' categorisation is defensible under ICO guidance"*
3. **Analytics section**: *"LEGAL REVIEW REQUIRED — confirm opt-in consent mechanism for analytics cookies meets PECR requirements; verify PostHog DPA is signed and EU data residency is confirmed in writing"*
4. **Third-party processors section**: *"LEGAL REVIEW REQUIRED — confirm DPA reference and data residency claim for PostHog are accurate and documented"*

---

## Observations for the improvement pass

- **Consent banner IS implemented — correction to an earlier draft of this doc** that claimed it didn't exist. Verified end-to-end on 2026-05-25:
  - [`components/analytics/CookieConsentBanner.tsx`](../../components/analytics/CookieConsentBanner.tsx) — floating consent card with three ICO-compliant equally-weighted CTAs (Accept all / Essential only / Manage with granular toggles), mounted in [`app/layout.tsx:40`](../../app/layout.tsx#L40).
  - [`lib/analytics/consent.ts`](../../lib/analytics/consent.ts) — `getConsent()`, `setConsent()`, `hasDecided()`. Writes localStorage + plain cookie + dispatches `consent-updated` event.
  - [`lib/analytics/posthog.ts`](../../lib/analytics/posthog.ts) — triple-gated init (module flag + `init(consent)` short-circuit + every capture function checks `_initialized`). PostHog can't fire before consent.
  - [`components/analytics/PostHogProvider.tsx`](../../components/analytics/PostHogProvider.tsx) — initialises on mount if consent already given; listens for `consent-updated` to react to changes.

  Original error was caused by greping for the string `cookie-consent` (only 2 matches — policy page + reset button), missing the actual banner component whose name doesn't contain that string. Policy text matches reality.

- **PostHog cookie list shows only `ph_*` (wildcard)** — that's accurate but uninformative. Worth being explicit: PostHog typically sets `ph_<TOKEN>_posthog`, `ph_<TOKEN>_window_id`, etc. ICO guidance leans toward more specificity in disclosed cookies.
- **No mention of localStorage / sessionStorage.** The policy talks about cookies but the `cookie-consent` value is ALSO stored in localStorage (see `ResetPreferencesButton.tsx`). PECR guidance increasingly treats localStorage as equivalent to cookies for consent purposes. Worth disclosing.
- **No mention of Sentry.** Sentry was installed in commit `fe3e93b`. It loads a client-side script (`@sentry/nextjs`) which can use localStorage and may set cookies in some configurations. Verify what Sentry actually sets in the browser and add to the appropriate category (probably strictly-necessary for error reporting OR analytics if it's gated).
- **No mention of Stripe.** Stripe.js (loaded via `@stripe/stripe-js` for the card capture form) sets cookies including `__stripe_mid`, `__stripe_sid`. These are needed for fraud detection on card-save flows — usually categorised as strictly-necessary. Worth disclosing now that prod is live for payments.
- **Strictly-necessary categorisation needs ICO defence.** Per ICO guidance, "strictly necessary" is a narrow category — limited to cookies essential for a service the user has explicitly requested. The `cookie-consent` cookie (storing whether you accepted analytics) is arguably necessary to honour your choice, but lawyers sometimes argue it's a preference cookie. Verify defensibility.
- **No retention/deletion process for consent records.** If we offer accept/decline, GDPR requires us to keep auditable records of consent. Where do we store them? (Currently: localStorage on the user's device — that's not a server-side record we can produce on demand if a regulator asks.)
- **Cookie policy and Privacy Policy section 7 must stay in sync.** Both list the same cookies but in different format. Maintainability risk. Either single-source-of-truth one and reference from the other, or commit to a documented sync process.
- **"Reset preferences" UX is a bit clinical.** The button drops you back into the (non-existent) consent banner. Worth thinking about the wider flow once the banner is built — e.g. ability to ALSO accept/decline directly from the policy page without forcing a page reload.
- **No mention of opt-out cookies for users who decline.** Some jurisdictions require an "opted out" marker cookie to persist the decision. PECR doesn't strictly require this, but it's good practice.
- **The "Reset cookie preferences" button** is invoked via `ResetPreferencesButton.tsx` which:
  - Removes `cookie-consent` from localStorage
  - Sets `cookie-consent=; max-age=0; path=/` (deletes the cookie)
  - Reloads the page

  Mechanically correct. But "reloads the page" should re-prompt — which requires the banner to actually exist (see top gap).

- **Robots meta is `noindex`** (`robots: { index: false }`) — that's a deliberate choice on the cookie policy page. Worth verifying that's the intended SEO posture; usually you DO want cookie policies indexed so search engines can surface them.
- **"May 2026" placeholder date** — same issue as Privacy and Terms.
