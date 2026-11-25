"use client";

import { useMemo, useState } from "react";
import { Section } from "./_shell";
import { SectionHead, Slider, Readout, Donut, Legend, Disclosure, Note, ResetButton, num, gbp } from "../ui";
import { combinedModel, pct } from "@/lib/proposal/model";
import { useBeacon } from "../analytics-client";

const STREAM_COLORS: Record<string, string> = {
  agency: "#ff6b4a",
  boardwalk: "#ff9470",
  progressor: "#3d4b58",
  software: "#ffc0a6",
};

interface Cost {
  id: string;
  label: string;
  monthly: number;
}
const COST_LINES: Cost[] = [
  { id: "infra", label: "Infrastructure", monthly: 0 },
  { id: "ai", label: "AI usage", monthly: 0 },
  { id: "support", label: "Customer support", monthly: 0 },
  { id: "dev", label: "Development resources", monthly: 0 },
  { id: "marketing", label: "Marketing", monthly: 0 },
  { id: "sales", label: "Sales & administration", monthly: 0 },
];

export function CombinedSection() {
  const { track } = useBeacon();
  const [agencies, setAgencies] = useState(100);
  const [exch, setExch] = useState(10);
  const [includeBoardwalk, setIncludeBoardwalk] = useState(true);
  const [bwExch, setBwExch] = useState(80);
  const [progressorBiz, setProgressorBiz] = useState(10);
  const [softwareAdoption, setSoftwareAdoption] = useState(0.3);
  const [costs, setCosts] = useState(COST_LINES);

  const r = useMemo(
    () =>
      combinedModel({
        agency: { agencies, exchangesPerAgency: exch },
        includeBoardwalk,
        boardwalkExchanges: bwExch,
        progressor: {
          businesses: progressorBiz,
          directorsPerBusiness: 1,
          additionalMembersPerBusiness: 2,
          salesPerBusinessPerMonth: 10,
          pctViaIntroduction: 0.2,
          networkExchangeRate: 0.6,
        },
        software: { customers: agencies, adoptionPct: softwareAdoption },
      }),
    [agencies, exch, includeBoardwalk, bwExch, progressorBiz, softwareAdoption],
  );

  const donut = r.streams.filter((s) => s.monthly > 0).map((s) => ({ label: s.label, value: s.monthly, color: STREAM_COLORS[s.id] }));

  const totalCosts = costs.reduce((a, c) => a + c.monthly, 0);
  const surplus = r.monthlyTotal - totalCosts;

  const reset = () => {
    setAgencies(100); setExch(10); setIncludeBoardwalk(true); setBwExch(80); setProgressorBiz(10); setSoftwareAdoption(0.3);
    setCosts(COST_LINES);
  };

  return (
    <Section id="combined" alt wide>
      <SectionHead
        eyebrow="12 — Combined model"
        title={
          <>
            The whole opportunity, in one place<span className="prop-stop">.</span>
          </>
        }
        lead="Agency exchanges, Boardwalk, the progressor network and operational software — brought together. Adjust the drivers and watch how the streams combine. Gross software revenue only, never profit."
      />

      <div className="prop-comb" onPointerDown={() => track("calculator_open", { detail: "combined-model", sectionId: "combined" })}>
        <div className="prop-card prop-card--pad-lg">
          <div className="prop-between" style={{ marginBottom: "1.3rem" }}>
            <h3 className="prop-h3">Drivers</h3>
            <ResetButton onClick={reset} />
          </div>
          <div className="prop-stack-lg">
            <Slider label="Agency customers" value={agencies} min={5} max={1000} step={5} onChange={setAgencies} />
            <Slider label="Avg exchanges / agency / month" value={exch} min={1} max={60} step={1} onChange={setExch} />
            <div className="prop-card prop-card--quiet" style={{ padding: "0.8rem 1rem" }}>
              <label className="prop-between" style={{ cursor: "pointer", marginBottom: includeBoardwalk ? "0.6rem" : 0 }}>
                <span className="prop-field-label" style={{ color: "var(--prop-ink)" }}>Include Boardwalk</span>
                <input type="checkbox" checked={includeBoardwalk} onChange={(e) => setIncludeBoardwalk(e.target.checked)} />
              </label>
              {includeBoardwalk && <Slider label="Boardwalk exchanges / month" value={bwExch} min={1} max={120} step={1} onChange={setBwExch} />}
            </div>
            <Slider label="Progression businesses" value={progressorBiz} min={0} max={200} step={1} onChange={setProgressorBiz} />
            <Slider label="Bundle adoption" value={softwareAdoption} min={0} max={1} step={0.05} onChange={setSoftwareAdoption} format={(v) => pct(v, 0)} />
          </div>
          <p className="prop-fnote" style={{ marginTop: "1.2rem" }}>
            Fixed network assumptions: 1 director + 2 members each, 10 sales/business/month, 20% via introduction, 60% of those
            exchange.
          </p>
        </div>

        <div className="prop-stack">
          <div className="prop-panel">
            <div className="prop-between" style={{ alignItems: "center", flexWrap: "wrap", gap: "1.2rem" }}>
              <div>
                <div className="prop-stat-value" style={{ color: "var(--prop-coral-soft)", fontSize: "clamp(2rem, 5vw, 3rem)" }}>{gbp(r.annualTotal)}</div>
                <div className="prop-stat-label" style={{ color: "var(--prop-navy-ink-2)" }}>Annualised gross revenue · {gbp(r.monthlyTotal)}/mo</div>
              </div>
              <Donut segments={donut} size={132} centerLabel={`${donut.length}`} centerSub="streams" />
            </div>
            <div style={{ marginTop: "1.3rem", paddingTop: "1.3rem", borderTop: "1px solid var(--prop-navy-line)" }}>
              <Legend items={r.streams.filter((s) => s.monthly > 0).map((s) => ({ label: s.label, color: STREAM_COLORS[s.id], value: `${gbp(s.annual)}/yr` }))} />
            </div>
          </div>

          <Disclosure title="Add an optional operating-cost scenario" onOpen={() => track("calculator_open", { detail: "cost-scenario", sectionId: "combined" })}>
            <p className="prop-body" style={{ marginBottom: "1.2rem" }}>
              These are illustrative, editable monthly costs — not TSP&rsquo;s actual figures, which aren&rsquo;t disclosed here.
              Set your own to see an indicative picture.
            </p>
            <div className="prop-stack-sm">
              {costs.map((c) => (
                <Slider
                  key={c.id}
                  label={c.label}
                  value={c.monthly}
                  min={0}
                  max={200000}
                  step={1000}
                  onChange={(v) => setCosts((prev) => prev.map((x) => (x.id === c.id ? { ...x, monthly: v } : x)))}
                  format={(v) => gbp(v)}
                />
              ))}
            </div>
            <div className="prop-grid prop-grid-2" style={{ marginTop: "1.3rem" }}>
              <Readout label="Total illustrative monthly cost" value={gbp(totalCosts)} />
              <Readout label="Indicative monthly surplus" value={gbp(surplus)} hint="Illustrative, pre-tax — not profit, cash flow or guidance" coral={surplus >= 0} />
            </div>
          </Disclosure>
        </div>
      </div>

      <Note>
        Annualised gross revenue is not profit, cash flow, contracted recurring revenue or a valuation. Excludes VAT, discounts,
        churn and timing. Reset returns every assumption to its starting point. Figures you enter stay in your browser.
      </Note>

      <style>{`
        .prop-comb { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: clamp(1rem, 2.5vw, 1.75rem); margin-top: 2rem; align-items: start; }
        @media (max-width: 860px) { .prop-comb { grid-template-columns: 1fr; } }
      `}</style>
    </Section>
  );
}
