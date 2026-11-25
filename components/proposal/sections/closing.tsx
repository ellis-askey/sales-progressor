"use client";

import { Section } from "./_shell";
import { PButton } from "../ui";

const DISCUSSION = [
  "Do we share the same long-term ambition?",
  "What capital commitment and equity structure would be fair?",
  "How do we divide responsibilities and agree our first priorities?",
  "What measurable milestones should we work towards?",
];

export function ClosingSection({ pdfAvailable, onDownload }: { pdfAvailable: boolean; onDownload: () => void }) {
  const toModel = () => document.getElementById("sec-combined")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <Section id="closing" flush>
      <div className="prop-panel" style={{ padding: "clamp(2rem, 5vw, 4rem)" }}>
        <p className="prop-eyebrow" style={{ color: "var(--prop-coral-soft)", marginBottom: "1.4rem" }}>18 — Where we go from here</p>

        <p className="prop-serif" style={{ fontSize: "clamp(1.5rem, 3.6vw, 2.6rem)", lineHeight: 1.26, color: "var(--prop-navy-ink)", margin: 0, maxWidth: "20ch" }}>
          Do we want to build technology that helps Boardwalk become one of the most successful estate agencies in Bristol, or
          the technology company that supports successful agencies across the country?
        </p>

        <p className="prop-serif" style={{ fontSize: "clamp(1.6rem, 4vw, 2.6rem)", fontStyle: "italic", color: "var(--prop-coral-soft)", margin: "1.6rem 0 0" }}>
          Why couldn&rsquo;t we do both?
        </p>

        <p className="prop-body" style={{ color: "var(--prop-navy-ink-2)", marginTop: "1.6rem", maxWidth: "58ch" }}>
          You know what good looks like in an estate agency. I know how to turn those requirements into software. I genuinely
          believe we can build something with value far beyond one business.
        </p>

        <div style={{ marginTop: "2.5rem", paddingTop: "2.25rem", borderTop: "1px solid var(--prop-navy-line)" }}>
          <p className="prop-eyebrow" style={{ color: "var(--prop-coral-soft)", marginBottom: "1.2rem" }}>Our discussion in Bristol · 11 December</p>
          <ol className="prop-close-list">
            {DISCUSSION.map((d, i) => (
              <li key={d} className="prop-flex" style={{ gap: 14, alignItems: "baseline" }}>
                <span className="prop-tabular" style={{ color: "var(--prop-coral-soft)", fontWeight: 700, fontSize: "0.8rem" }}>{String(i + 1).padStart(2, "0")}</span>
                <span className="prop-body" style={{ color: "var(--prop-navy-ink)", fontSize: "1.05rem" }}>{d}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="prop-flex-wrap" style={{ marginTop: "2.5rem", gap: "0.75rem" }}>
          <PButton variant="primary" onClick={toModel}>Revisit the commercial model</PButton>
          {pdfAvailable && (
            <a className="prop-btn prop-btn--onnavy" href="/api/proposal/pdf" onClick={onDownload} style={{ textDecoration: "none" }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download the original PDF
            </a>
          )}
        </div>
      </div>

      <footer style={{ padding: "2.5rem 0 1rem", textAlign: "center" }}>
        <p className="prop-fnote" style={{ maxWidth: "70ch", marginInline: "auto" }}>
          Confidential, non-binding proposal for discussion. Based on existing conversations and information provided by Ellis.
          Product status, company records, financial assumptions and terms remain subject to review; no repository or financial
          records have been independently inspected. Definitive terms require appropriate legal and financial review.
        </p>
        <p className="prop-caption" style={{ marginTop: "1rem" }}>The Sales Progressor × Boardwalk Property Co · Prepared for Nick and Jack</p>
      </footer>

      <style>{`
        .prop-close-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.9rem; }
      `}</style>
    </Section>
  );
}
