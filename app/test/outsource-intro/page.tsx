// Public, no-auth preview page for the "Getting your sale moving" email.
// Lives under /test/* per the project convention (per the disposable-mock
// memory entry — handy for marketing screenshots, copy reviews, deliberate
// stress-tests of fallback variants).
//
// RENDERS ONLY. There is no send button. Nothing on this page ever fires
// a real send to a real address — building the template object is a pure
// function and we never call sendEmail / enqueueEmail from here.
//
// Renders three side-by-side variants so the fallback paths can be eyed
// next to the happy path:
//   1. Happy: all variables present.
//   2. Missing client first name → "Hi there,"
//   3. Missing address          → opener rewritten without "at {address}"

import { buildOutsourceIntroEmail, type OutsourceIntroVars } from "@/lib/emails/outsource-intro-template";

const VARIANTS: { label: string; vars: OutsourceIntroVars }[] = [
  {
    label: "Happy path",
    vars: {
      clientFirstName: "Sarah",
      address: "42 Briarwood Avenue, Hampton, TW12 1AB",
      agentFirstName: "Taylor",
      agentLastName: "Kay",
      agencyName: "Akeman Residential",
    },
  },
  {
    label: "Fallback — no client first name",
    vars: {
      clientFirstName: null,
      address: "42 Briarwood Avenue, Hampton, TW12 1AB",
      agentFirstName: "Taylor",
      agentLastName: "Kay",
      agencyName: "Akeman Residential",
    },
  },
  {
    label: "Fallback — no address",
    vars: {
      clientFirstName: "Sarah",
      address: null,
      agentFirstName: "Taylor",
      agentLastName: "Kay",
      agencyName: "Akeman Residential",
    },
  },
];

export default function OutsourceIntroPreview() {
  return (
    <div style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      maxWidth: 1280, margin: "0 auto", padding: "32px 24px", background: "#f5f5f7",
    }}>
      <header style={{ marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6e6e73" }}>
          Preview (render only)
        </p>
        <h1 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700, color: "#1d1d1f" }}>
          Outsource intro email
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#3a3a3c", maxWidth: 760, lineHeight: 1.55 }}>
          This page does NOT send. Three variants below show the happy path
          and the two fallback shapes (missing client first name, missing
          address) side by side. From-name shown above each iframe — the
          actual address (envelope sender) is resolved at send time and
          depends on agency verified-domain status.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
        {VARIANTS.map((v) => {
          const email = buildOutsourceIntroEmail(v.vars);
          return (
            <section key={v.label} style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#86868b" }}>
                {v.label}
              </p>
              <h2 style={{ margin: "4px 0 12px", fontSize: 15, fontWeight: 600, color: "#1d1d1f" }}>
                {email.subject}
              </h2>
              <div style={{ fontSize: 12, color: "#3a3a3c", marginBottom: 12, padding: "8px 10px", background: "#f5f5f7", borderRadius: 6, lineHeight: 1.5 }}>
                <div><strong style={{ color: "#1d1d1f" }}>From-name:</strong> {email.fromName}</div>
                <div style={{ marginTop: 2 }}><strong style={{ color: "#1d1d1f" }}>To:</strong> {v.vars.clientFirstName ? `${v.vars.clientFirstName} (a recipient contact)` : "(contact without a first name)"}</div>
              </div>
              <iframe
                title={`${v.label} email body`}
                srcDoc={email.html}
                style={{ width: "100%", height: 620, border: "0.5px solid #d2d2d7", borderRadius: 6, background: "#fff" }}
              />
              <details style={{ marginTop: 10 }}>
                <summary style={{ fontSize: 11, color: "#6e6e73", cursor: "pointer" }}>Plain-text version</summary>
                <pre style={{ fontSize: 11, color: "#1d1d1f", whiteSpace: "pre-wrap", background: "#f5f5f7", padding: 10, borderRadius: 6, margin: "6px 0 0" }}>
                  {email.text}
                </pre>
              </details>
            </section>
          );
        })}
      </div>
    </div>
  );
}
