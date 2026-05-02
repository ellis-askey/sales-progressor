import type { Metadata } from "next";
import Link from "next/link";
import { ResetPreferencesButton } from "./ResetPreferencesButton";

export const metadata: Metadata = {
  title: "Cookie Policy — Sales Progressor",
  robots: { index: false },
};

export default function CookiePolicyPage() {
  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "48px 24px 80px", fontFamily: "system-ui, sans-serif", color: "#222", lineHeight: "1.65" }}>

      <p style={{ fontSize: "13px", color: "#888", marginBottom: "8px" }}>
        <Link href="/" style={{ color: "#888", textDecoration: "none" }}>Sales Progressor</Link>
      </p>
      <h1 style={{ fontSize: "26px", fontWeight: "700", marginBottom: "6px" }}>Cookie Policy</h1>
      <p style={{ color: "#888", fontSize: "14px", marginTop: "0" }}>Last updated: May 2025</p>

      <p>
        Sales Progressor (&ldquo;we&rdquo;, &ldquo;us&rdquo;) uses cookies and similar storage
        technologies on this website and the Sales Progressor platform. This policy explains what
        cookies we set, why we set them, and how you can control them.
      </p>

      <h2 style={{ fontSize: "18px", fontWeight: "600", marginTop: "36px" }}>What is a cookie?</h2>
      <p>
        A cookie is a small text file stored on your device when you visit a website. Cookies
        help sites remember information about your visit — such as whether you are logged in
        or what preferences you have set.
      </p>

      <h2 style={{ fontSize: "18px", fontWeight: "600", marginTop: "36px" }}>Cookies we use</h2>

      <h3 style={{ fontSize: "15px", fontWeight: "600", marginTop: "24px" }}>Strictly necessary</h3>
      <p>
        These cookies are essential for the platform to work. They cannot be switched off.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginTop: "12px" }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: "600", borderBottom: "1px solid #e0e0e0" }}>Cookie name</th>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: "600", borderBottom: "1px solid #e0e0e0" }}>Purpose</th>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: "600", borderBottom: "1px solid #e0e0e0" }}>Duration</th>
          </tr>
        </thead>
        <tbody>
          {[
            {
              name: "next-auth.session-token\n(or __Secure-next-auth.session-token on HTTPS)",
              purpose: "Keeps you logged in to the Sales Progressor platform.",
              duration: "30 days (or until you sign out)",
            },
            {
              name: "next-auth.csrf-token",
              purpose: "Protects form submissions against cross-site request forgery attacks.",
              duration: "Session",
            },
            {
              name: "cookie-consent",
              purpose: "Remembers whether you have accepted or declined optional analytics cookies, so we do not ask again on every visit.",
              duration: "1 year",
            },
          ].map((row) => (
            <tr key={row.name} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "8px 12px", verticalAlign: "top", fontFamily: "monospace", fontSize: "12px", whiteSpace: "pre-line" }}>{row.name}</td>
              <td style={{ padding: "8px 12px", verticalAlign: "top" }}>{row.purpose}</td>
              <td style={{ padding: "8px 12px", verticalAlign: "top", whiteSpace: "nowrap" }}>{row.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ fontSize: "15px", fontWeight: "600", marginTop: "28px" }}>Analytics (optional)</h3>
      <p>
        These cookies are <strong>off by default</strong>. We only set them if you click
        &ldquo;Accept analytics&rdquo; in the cookie banner. They help us understand how
        people use the platform so we can improve it.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginTop: "12px" }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: "600", borderBottom: "1px solid #e0e0e0" }}>Cookie name</th>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: "600", borderBottom: "1px solid #e0e0e0" }}>Purpose</th>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: "600", borderBottom: "1px solid #e0e0e0" }}>Duration</th>
          </tr>
        </thead>
        <tbody>
          {[
            {
              name: "ph_*",
              purpose: "PostHog analytics. Records page views and feature interactions (anonymised) to help us understand platform usage. Session recordings are disabled. We collect only a limited set of events, all data is stored on PostHog's EU-region servers.",
              duration: "Up to 1 year",
            },
          ].map((row) => (
            <tr key={row.name} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "8px 12px", verticalAlign: "top", fontFamily: "monospace", fontSize: "12px" }}>{row.name}</td>
              <td style={{ padding: "8px 12px", verticalAlign: "top" }}>{row.purpose}</td>
              <td style={{ padding: "8px 12px", verticalAlign: "top", whiteSpace: "nowrap" }}>{row.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: "18px", fontWeight: "600", marginTop: "36px" }}>How to manage your preferences</h2>
      <p>
        You can change your cookie preferences at any time. Clicking the button below will
        reset your choice and re-show the cookie banner on your next page load.
      </p>
      <ResetPreferencesButton />

      <p style={{ marginTop: "16px" }}>
        You can also control cookies through your browser settings. Blocking all cookies may
        affect your ability to log in and use the platform.
      </p>

      <h2 style={{ fontSize: "18px", fontWeight: "600", marginTop: "36px" }}>Third-party processors</h2>
      <p>
        Analytics data is processed by <strong>PostHog, Inc.</strong> under a data processing
        agreement. PostHog stores data on servers within the European Economic Area (EU region).
        You can read PostHog&apos;s privacy policy at{" "}
        <span style={{ color: "#555" }}>posthog.com/privacy</span>.
      </p>

      <h2 style={{ fontSize: "18px", fontWeight: "600", marginTop: "36px" }}>Contact</h2>
      <p>
        If you have questions about how we use cookies or about your personal data, please
        email us at{" "}
        <a href="mailto:hello@thesalesprogressor.co.uk" style={{ color: "#333" }}>
          hello@thesalesprogressor.co.uk
        </a>
        .
      </p>

      <div style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid #eee", fontSize: "13px", color: "#888" }}>
        <Link href="/" style={{ color: "#888" }}>← Back to Sales Progressor</Link>
      </div>
    </div>
  );
}
