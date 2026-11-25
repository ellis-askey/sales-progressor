"use client";

import { useMemo, useState } from "react";
import { Section } from "./_shell";
import { SectionHead, Slider, Readout, Note, ResetButton, gbp } from "../ui";
import { progressorNetwork, pct } from "@/lib/proposal/model";
import { useBeacon } from "../analytics-client";

const FLOW = [
  { title: "Estate agency", body: "Keeps ownership of its account and chooses a progressor." },
  { title: "TSP", body: "Provides the software, discovery and introductions.", highlight: true },
  { title: "Independent progressor", body: "Owns service delivery and the commercial relationship." },
];

const PRICING = [
  ["Director subscription", "£59 / month"],
  ["Additional team member", "£39 / month"],
  ["Progressor's own client", "£5 / added sale"],
  ["TSP-generated introduction", "£5 / added sale + £10 on exchange"],
];

export function ProgressorSection() {
  const { track } = useBeacon();
  const [businesses, setBusinesses] = useState(10);
  const [directors, setDirectors] = useState(1);
  const [members, setMembers] = useState(2);
  const [sales, setSales] = useState(10);
  const [viaIntro, setViaIntro] = useState(0.2);
  const [exchangeRate, setExchangeRate] = useState(0.6);

  const r = useMemo(
    () =>
      progressorNetwork({
        businesses,
        directorsPerBusiness: directors,
        additionalMembersPerBusiness: members,
        salesPerBusinessPerMonth: sales,
        pctViaIntroduction: viaIntro,
        networkExchangeRate: exchangeRate,
      }),
    [businesses, directors, members, sales, viaIntro, exchangeRate],
  );

  const reset = () => { setBusinesses(10); setDirectors(1); setMembers(2); setSales(10); setViaIntro(0.2); setExchangeRate(0.6); };

  return (
    <Section id="progressor" alt>
      <SectionHead
        eyebrow="10 — Progressor network"
        title={
          <>
            A network, not a managed service<span className="prop-stop">.</span>
          </>
        }
        lead="Connect agencies that need external support with independent progression businesses. Agencies keep ownership of their accounts; progressors own service delivery; TSP supplies the platform and the introductions."
      />

      <div className="prop-flow3">
        {FLOW.map((f, i) => (
          <div key={f.title} className="prop-flow3-cell">
            <div className={f.highlight ? "prop-panel" : "prop-card"} style={{ height: "100%", padding: "1.3rem" }}>
              <h3 className="prop-h3" style={{ marginBottom: "0.5rem", color: f.highlight ? "var(--prop-navy-ink)" : undefined }}>{f.title}</h3>
              <p className="prop-body" style={{ fontSize: "0.9375rem", color: f.highlight ? "var(--prop-navy-ink-2)" : undefined }}>{f.body}</p>
            </div>
            {i < FLOW.length - 1 && (
              <svg className="prop-flow3-arrow" width="26" height="16" viewBox="0 0 26 16" fill="none" aria-hidden>
                <path d="M0 8h22m0 0l-5-5m5 5l-5 5" stroke="var(--prop-coral)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        ))}
      </div>

      <div className="prop-grid prop-grid-2" style={{ marginTop: "2rem", gap: "0.6rem 2rem" }}>
        {PRICING.map(([k, v]) => (
          <div key={k} className="prop-between" style={{ padding: "0.6rem 0", borderBottom: "1px solid var(--prop-line)" }}>
            <span className="prop-body" style={{ fontSize: "0.9375rem" }}>{k}</span>
            <span className="prop-field-value">{v}</span>
          </div>
        ))}
      </div>

      <div className="prop-prog" style={{ marginTop: "2rem" }} onPointerDown={() => track("calculator_open", { detail: "progressor-network", sectionId: "progressor" })}>
        <div className="prop-card prop-card--pad-lg">
          <div className="prop-between" style={{ marginBottom: "1.3rem" }}>
            <h3 className="prop-h3">Model the network</h3>
            <ResetButton onClick={reset} />
          </div>
          <div className="prop-stack-lg">
            <Slider label="Progression businesses" value={businesses} min={1} max={200} step={1} onChange={setBusinesses} />
            <div className="prop-grid prop-grid-2" style={{ gap: "1.25rem" }}>
              <Slider label="Directors each" value={directors} min={1} max={5} step={1} onChange={setDirectors} />
              <Slider label="Team members each" value={members} min={0} max={10} step={1} onChange={setMembers} />
            </div>
            <Slider label="Sales added / business / month" value={sales} min={1} max={60} step={1} onChange={setSales} />
            <Slider label="Share via TSP introduction" value={viaIntro} min={0} max={1} step={0.05} onChange={setViaIntro} format={(v) => pct(v, 0)} />
            <Slider label="Exchange rate on introduced sales" value={exchangeRate} min={0} max={1} step={0.05} onChange={setExchangeRate} format={(v) => pct(v, 0)} />
          </div>
        </div>

        <div className="prop-stack">
          <Readout label="Monthly subscriptions" value={gbp(r.monthlySubscription)} />
          <Readout label="Monthly transaction fees" value={gbp(r.monthlyTransaction)} hint="£5 on every added sale" />
          <Readout label="Network exchange fees" value={gbp(r.monthlyNetworkExchange)} hint="£10 only on introduced sales that exchange" />
          <div className="prop-panel" style={{ padding: "1.3rem 1.5rem" }}>
            <div className="prop-stat-value" style={{ color: "var(--prop-coral-soft)" }}>{gbp(r.annualTotal)}</div>
            <div className="prop-stat-label" style={{ color: "var(--prop-navy-ink-2)" }}>Annualised network revenue · {gbp(r.monthlyTotal)}/mo</div>
          </div>
        </div>
      </div>

      <Note>
        A successful network-generated exchange totals £15 (£5 + £10) — a 200% increase on the £5 transaction fee, around 5% of
        an illustrative £300 progressor fee. The £10 never applies to a progressor&rsquo;s own sales, and the £5 base is never
        counted twice. Pricing requires commercial validation before launch.
      </Note>

      <style>{`
        .prop-flow3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 2rem; }
        .prop-flow3-cell { position: relative; }
        .prop-flow3-arrow { position: absolute; right: -16px; top: 50%; transform: translateY(-50%); z-index: 1; }
        .prop-prog { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: clamp(1rem, 2.5vw, 1.75rem); align-items: start; }
        @media (max-width: 760px) {
          .prop-flow3 { grid-template-columns: 1fr; }
          .prop-flow3-arrow { display: none; }
          .prop-prog { grid-template-columns: 1fr; }
        }
      `}</style>
    </Section>
  );
}
