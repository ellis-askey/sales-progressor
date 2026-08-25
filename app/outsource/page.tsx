// Public "hand us a file" landing page for the outsourced service — the front
// door the cold-email campaign (and any paid traffic) points at. No auth
// (whitelisted in middleware.ts). Reuses the claim marketing design system.

import { ClaimBackground } from "@/components/claim/ClaimBackground";
import { OutsourceIntakeForm } from "./OutsourceIntakeForm";
import "@/app/claim/styles/claim-flow.css";

export const metadata = {
  title: "We'll progress your sales | Sales Progressor",
  description: "Hand us your agreed sales. We chase them through to exchange. You pay £250 per sale, only when it exchanges.",
};

export const dynamic = "force-dynamic";

const STEPS: { n: string; title: string; body: string }[] = [
  { n: "1", title: "Send us a sale", body: "Once you've agreed a sale, pass us the details. It takes a minute." },
  { n: "2", title: "We progress it", body: "We do all the chasing, using our own system, so your team doesn't have to." },
  { n: "3", title: "You pay on exchange", body: "£250 per sale, only when it exchanges. Nothing if it falls through." },
];

const WHY: { title: string; body: string }[] = [
  { title: "Fewer fall-throughs", body: "A sale that's actively chased is a sale that holds together." },
  { title: "No admin for your team", body: "The progression work leaves your desk entirely." },
  { title: "No risk", body: "No upfront cost and no monthly fee. You only pay on success." },
];

export default function OutsourcePage() {
  return (
    <div className="claim-page">
      <ClaimBackground />
      <header className="claim-header">
        <a href="https://www.thesalesprogressor.co.uk" target="_blank" rel="noopener" className="claim-wordmark">
          The Sales Progressor
        </a>
      </header>

      <div className="claim-container">
        {/* Hero */}
        <div className="claim-hero">
          <p className="claim-hero-eyebrow">Done for you</p>
          <h1 className="claim-hero-h1">We&apos;ll progress your sales to exchange.</h1>
          <p className="claim-hero-sub">
            Hand us your agreed sales. We chase the solicitors, the mortgage, the searches and the enquiries all the way to
            completion. You pay £250 per sale, and only when it exchanges.
          </p>
          <a href="#start" className="claim-btn" style={{ maxWidth: 280 }}>Hand us your first file</a>
        </div>

        {/* How it works */}
        <div style={{ marginTop: 36 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--claim-text-3)", margin: "0 0 14px" }}>
            How it works
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "var(--claim-surface)", border: "1px solid var(--claim-border)", borderRadius: "var(--claim-r-card)", padding: "16px 18px" }}>
                <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 999, background: "var(--claim-coral)", color: "#fff", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.n}</span>
                <div>
                  <p style={{ margin: "2px 0 3px", fontSize: 15, fontWeight: 700, color: "var(--claim-text-1)" }}>{s.title}</p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--claim-text-2)", lineHeight: 1.55 }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Why */}
        <div style={{ marginTop: 32 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {WHY.map((w) => (
              <div key={w.title} style={{ flex: "1 1 150px" }}>
                <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 700, color: "var(--claim-text-1)" }}>{w.title}</p>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--claim-text-2)", lineHeight: 1.5 }}>{w.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Intake */}
        <div id="start" style={{ marginTop: 36, scrollMarginTop: 72 }}>
          <OutsourceIntakeForm />
        </div>

        <footer style={{ marginTop: 28, textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "var(--claim-text-3)" }}>
            Questions? <a href="mailto:support@thesalesprogressor.co.uk" style={{ color: "var(--claim-coral)" }}>support@thesalesprogressor.co.uk</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
