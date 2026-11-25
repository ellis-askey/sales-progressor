import { Section } from "./_shell";
import { SectionHead, Reveal, Disclosure } from "../ui";

const LENSES = [
  { title: "Commercial", body: "Paying customers, acquisition cost, conversion, retention and revenue." },
  { title: "Operational", body: "Boardwalk staff time, software expenditure and transaction outcomes." },
  { title: "Technical", body: "Reliability, support demand, gross margin and infrastructure cost per transaction." },
];

const RISKS: [string, string][] = [
  ["Scope & single-agency bias", "Protect core progression; prioritise reusable features with wider demand."],
  ["Production & infrastructure", "Set quality and security requirements; review costs at higher usage; stage releases."],
  ["Data, security & AI", "Tenant isolation, permissions, approved data use, human oversight and audit trails."],
  ["Support & key-person dependency", "Document systems, improve onboarding, and recruit when justified."],
  ["Acquisition & competition", "Track conversion, retention, gross margin and acquisition cost; adjust spend."],
  ["Ownership & conflicting priorities", "Separate customer and shareholder agreements; establish authority, IP rights and dispute resolution."],
];

export function GovernanceSection() {
  return (
    <Section id="governance">
      <SectionHead
        eyebrow="17 — Governance & risk"
        title={
          <>
            Measure what matters. Protect what we build<span className="prop-stop">.</span>
          </>
        }
        lead="A shared approach to priorities, sustainable growth and the risks that come with scale. A monthly product and strategy review would keep us aligned; significant expenditure or changes outside agreed boundaries would need approval."
      />

      <div className="prop-grid prop-grid-3" style={{ marginTop: "2.25rem" }}>
        {LENSES.map((l, i) => (
          <Reveal key={l.title} delay={i * 60}>
            <div className="prop-card prop-card--pad-lg" style={{ height: "100%" }}>
              <div className="prop-accent-rule" style={{ marginBottom: "1rem" }} />
              <h3 className="prop-h3" style={{ marginBottom: "0.6rem" }}>{l.title}</h3>
              <p className="prop-body" style={{ fontSize: "0.9375rem" }}>{l.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div style={{ marginTop: "2.25rem" }}>
        <h3 className="prop-h3" style={{ marginBottom: "1rem" }}>Principal risks and responses</h3>
        <div className="prop-card" style={{ padding: 0, overflow: "hidden" }}>
          {RISKS.map(([risk, response], i) => (
            <div key={risk} className="prop-risk-row" style={{ borderTop: i === 0 ? "0" : "1px solid var(--prop-line)" }}>
              <div className="prop-risk-k">{risk}</div>
              <div className="prop-body prop-risk-v">{response}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="prop-stack" style={{ marginTop: "2rem" }}>
        <Disclosure title="Intellectual property & ownership">
          <p className="prop-body">
            Existing IP and future reusable developments are intended to remain within TSP. Boardwalk-specific configurations,
            templates and private data stay separate; reusable functionality forms part of the product and is made available to
            the wider market once ready. Any use of Boardwalk&rsquo;s name, outcomes or information in marketing would be subject
            to agreement.
          </p>
        </Disclosure>
        <Disclosure title="Data protection, security & scalability">
          <p className="prop-body">
            Tenant isolation, least-privilege permissions, approved data use, auditability and human approval for sensitive
            actions are essential. Cross-agency insight requires appropriately authorised and, where needed, effectively
            anonymised data. Infrastructure efficiency and cost-per-transaction are tracked as usage grows.
          </p>
        </Disclosure>
      </div>

      <style>{`
        .prop-risk-row { display: grid; grid-template-columns: 280px 1fr; gap: 1.5rem; padding: 1.1rem 1.4rem; align-items: start; }
        .prop-risk-k { font-weight: 600; color: var(--prop-ink); font-size: 0.9375rem; }
        .prop-risk-v { font-size: 0.9375rem; }
        @media (max-width: 680px) { .prop-risk-row { grid-template-columns: 1fr; gap: 0.4rem; } }
      `}</style>
    </Section>
  );
}
