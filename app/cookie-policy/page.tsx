// app/cookie-policy/page.tsx
//
// Cookie Policy — Version 1.0, published 25 May 2026.
//
// All [COUNSEL TO CONFIRM] flags resolved by Ellis on 2026-05-25 to settled
// positions and stripped from the public render. Sentry classified as
// strictly-necessary error monitoring based on the factual finding that
// it writes only one sessionStorage key (PREVIOUS_TRACE_KEY for distributed
// trace continuity), no cookies, and Session Replay only initialises on
// errors. See git log for the original draft.
//
// This page contains NO entity-name placeholders (the policy refers to
// "we"/"us" throughout without naming the legal entity).

import type { Metadata } from "next";
import Link from "next/link";
import { PolicyShell, type PolicySection } from "@/components/policies/PolicyShell";
import { ResetPreferencesButton } from "./ResetPreferencesButton";

export const metadata: Metadata = {
  title: "Cookie Policy — The Sales Progressor",
  description:
    "What cookies and similar storage technologies we use, why, and how to control your preferences.",
  robots: { index: true, follow: true },
};

const SECTIONS: PolicySection[] = [
  {
    id: "what-is-a-cookie",
    title: "1. What is a cookie?",
    body: (
      <>
        <p>
          A cookie is a small text file stored on your device when you visit a website. Some
          websites also use related technologies such as <strong>local storage</strong>, which works
          similarly. Together these help a site remember things about your visit — whether
          you&rsquo;re logged in, or what preferences you&rsquo;ve set. Where we use local storage
          in a way that affects your privacy choices, we treat it the same as a cookie and cover it
          in this policy.
        </p>
      </>
    ),
  },
  {
    id: "your-choice",
    title: "2. Your choice",
    body: (
      <p>
        When you first visit, we show you a cookie banner. You can <strong>Accept all</strong>,
        choose <strong>Essential only</strong>, or <strong>Manage</strong> your choice with granular
        toggles. Analytics cookies are <strong>off until you turn them on</strong> — nothing
        non-essential loads before you choose. You can change your decision at any time using the
        &ldquo;Reset preferences&rdquo; option further down this page.
      </p>
    ),
  },
  {
    id: "strictly-necessary",
    title: "3. Strictly necessary cookies",
    body: (
      <>
        <p>These are essential for the platform to work and cannot be switched off.</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Purpose</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>next-auth.session-token</code> (or{" "}
                <code>__Secure-next-auth.session-token</code> on HTTPS)
              </td>
              <td>Keeps you logged in</td>
              <td>30 days (or until you sign out)</td>
            </tr>
            <tr>
              <td><code>next-auth.csrf-token</code></td>
              <td>Protects forms against cross-site request forgery</td>
              <td>Session</td>
            </tr>
            <tr>
              <td><code>cookie-consent</code></td>
              <td>
                Remembers your cookie choice so we don&rsquo;t ask every visit. Also stored in your
                browser&rsquo;s local storage.
              </td>
              <td>1 year</td>
            </tr>
            <tr>
              <td><code>command_session</code></td>
              <td>
                Command Centre only — confirms an administrator has passed two-factor authentication.
                Not set for regular users.
              </td>
              <td>24 hours</td>
            </tr>
            <tr>
              <td>
                <code>__stripe_mid</code>, <code>__stripe_sid</code>
              </td>
              <td>
                Set by Stripe, our payment processor, on pages where card details are entered — used
                for payment fraud prevention.
              </td>
              <td>
                <code>__stripe_mid</code>: 1 year · <code>__stripe_sid</code>: 30 minutes
              </td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "analytics",
    title: "4. Analytics cookies (optional)",
    body: (
      <>
        <p>
          These are <strong>off by default</strong>. We set them only if you accept analytics. They
          help us understand how the platform is used so we can improve it.
        </p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Purpose</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>ph_*</code> (e.g. <code>ph_&lt;token&gt;_posthog</code>)</td>
              <td>
                PostHog analytics. Records page views and feature interactions to help us understand
                usage. Session recording is disabled; data is stored on PostHog&rsquo;s EU servers.
              </td>
              <td>Up to 1 year</td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "error-monitoring",
    title: "5. Error monitoring (strictly necessary)",
    body: (
      <>
        <p>
          We use Sentry to detect and diagnose errors so we can fix them quickly. Error monitoring
          is essential to keeping the platform reliable, so we classify it as strictly necessary
          and it is not consent-gated.
        </p>
        <p>
          What Sentry stores in your browser is limited to a single <code>sessionStorage</code> key{" "}
          (<code>PREVIOUS_TRACE_KEY</code>) used to link error reports across in-app navigations.
          This is cleared when you close your browser tab. Sentry does not set any cookies, and
          does not use local storage. Sentry&rsquo;s session-replay feature is configured to
          activate only when an error occurs; it does not initialise during a normal visit.
        </p>
        <p>
          When an error is reported, Sentry receives technical data including your IP address,
          browser information, and the URL where the error occurred. This is processed under a data
          processing agreement; data is stored in the EU.
        </p>
      </>
    ),
  },
  {
    id: "manage-preferences",
    title: "6. How to manage your preferences",
    body: (
      <>
        <p>
          You can change your cookie choice at any time using the button below — it resets your
          choice and re-shows the banner.
        </p>
        <p style={{ marginTop: 12 }}>
          <ResetPreferencesButton />
        </p>
        <p>
          You can also control cookies through your browser settings. Blocking all cookies may stop
          you logging in or using the platform.
        </p>
      </>
    ),
  },
  {
    id: "where-recorded",
    title: "7. Where your choice is recorded",
    body: (
      <p>
        Your cookie choice is stored on your own device (in a cookie and in local storage). Because
        it lives on your device, clearing your browser data will reset it and we&rsquo;ll ask again
        on your next visit.
      </p>
    ),
  },
  {
    id: "third-party-processors",
    title: "8. Third-party processors",
    body: (
      <>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Role</th>
              <th>Data location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>PostHog, Inc.</td>
              <td>Analytics (only with consent)</td>
              <td>EU</td>
            </tr>
            <tr>
              <td>Stripe</td>
              <td>Payment fraud prevention on card-entry pages</td>
              <td>US (SCCs + UK IDTA)</td>
            </tr>
            <tr>
              <td>Sentry</td>
              <td>Error monitoring (strictly necessary)</td>
              <td>EU</td>
            </tr>
          </tbody>
        </table>
        <p>
          Each processes data under a data processing agreement. You can read PostHog&rsquo;s privacy
          policy at posthog.com/privacy and Stripe&rsquo;s at stripe.com/privacy.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "9. Contact",
    body: (
      <>
        <p>
          Questions about cookies or your data:{" "}
          <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a>
        </p>
        <p>
          For the full picture of how we handle personal data, see our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </>
    ),
  },
];

export default function CookiePolicyPage() {
  return (
    <PolicyShell
      title="Cookie Policy"
      description="What we set, why, and how to control it."
      lastUpdated="25 May 2026"
      version="1.0"
      sections={SECTIONS}
    />
  );
}
