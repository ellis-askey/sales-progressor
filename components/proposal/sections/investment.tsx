"use client";

import { useMemo, useState } from "react";
import { Section } from "./_shell";
import { SectionHead, Slider, Readout, Disclosure, Note, ResetButton, num, gbp } from "../ui";
import {
  investmentBudget,
  acquisition,
  DEFAULT_BUDGET_TOTAL,
  DEFAULT_BUDGET_ALLOCATIONS,
  type BudgetAllocation,
} from "@/lib/proposal/model";
import { useBeacon } from "../analytics-client";

export function InvestmentSection() {
  const { track } = useBeacon();
  const [total, setTotal] = useState(DEFAULT_BUDGET_TOTAL);
  const [allocations, setAllocations] = useState<BudgetAllocation[]>(DEFAULT_BUDGET_ALLOCATIONS);
  const [assumedMonthly, setAssumedMonthly] = useState(6250);

  const r = useMemo(() => investmentBudget(total, allocations, assumedMonthly), [total, allocations, assumedMonthly]);
  const maxAlloc = Math.max(...allocations.map((a) => a.amount), 1);

  // Acquisition scenario
  const [acqBudget, setAcqBudget] = useState(24000);
  const [cac, setCac] = useState(1200);
  const [avgExch, setAvgExch] = useState(10);
  const acq = useMemo(() => acquisition({ budget: acqBudget, costPerAcquisition: cac, avgExchangesPerCustomer: avgExch }), [acqBudget, cac, avgExch]);

  const setAlloc = (id: string, amount: number) => setAllocations((prev) => prev.map((a) => (a.id === id ? { ...a, amount } : a)));
  const reset = () => { setTotal(DEFAULT_BUDGET_TOTAL); setAllocations(DEFAULT_BUDGET_ALLOCATIONS); setAssumedMonthly(6250); };

  return (
    <Section id="investment" alt>
      <SectionHead
        eyebrow="14 — Investment"
        title={
          <>
            Build and grow at the same time<span className="prop-stop">.</span>
          </>
        }
        lead="A proposed initial 12-month growth investment of £75,000–£100,000 into TSP — focused on marketing, customer acquisition and establishing credibility. We already have a product to sell, so we grow the business from the outset. The budget is a starting point for discussion, not an instruction."
      />

      <div className="prop-inv" onPointerDown={() => track("calculator_open", { detail: "investment-budget", sectionId: "investment" })}>
        <div className="prop-card prop-card--pad-lg">
          <div className="prop-between" style={{ marginBottom: "1.2rem" }}>
            <h3 className="prop-h3">Growth budget</h3>
            <ResetButton onClick={reset} />
          </div>
          <Slider label="Total growth capital" value={total} min={50000} max={150000} step={5000} onChange={setTotal} format={(v) => gbp(v)} />
          <div className="prop-stack-sm" style={{ marginTop: "1.5rem" }}>
            {allocations.map((a) => (
              <div key={a.id}>
                <div className="prop-between" style={{ marginBottom: 4 }}>
                  <span className="prop-field-label">{a.label}</span>
                  <span className="prop-field-value">{gbp(a.amount)}</span>
                </div>
                <input
                  className="prop-slider"
                  type="range"
                  min={0}
                  max={40000}
                  step={1000}
                  value={a.amount}
                  aria-label={a.label}
                  onChange={(e) => setAlloc(a.id, Number(e.target.value))}
                  style={{ ["--prop-track" as string]: `linear-gradient(90deg, var(--prop-coral) ${(a.amount / 40000) * 100}%, var(--prop-line-strong) ${(a.amount / 40000) * 100}%)` }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="prop-stack">
          <div className="prop-grid prop-grid-2">
            <Readout label="Monthly equivalent" value={gbp(Math.round(r.monthlyEquivalent))} />
            <Readout label="Allocated" value={gbp(r.allocated)} />
          </div>
          <Readout
            label="Unallocated / over budget"
            value={gbp(r.remaining)}
            coral={r.remaining === 0}
            hint={r.remaining === 0 ? "Reconciles exactly to the total" : r.remaining > 0 ? "Still to allocate" : "Over the selected total"}
          />
          <div className="prop-card prop-card--quiet">
            <div className="prop-stat-label" style={{ marginTop: 0, marginBottom: 10 }}>Runway at an assumed monthly spend</div>
            <Slider label="Assumed monthly spend" value={assumedMonthly} min={2000} max={15000} step={250} onChange={setAssumedMonthly} format={(v) => gbp(v)} />
            <div className="prop-stat-value" style={{ marginTop: 14, fontSize: "1.8rem" }}>{r.durationMonths ? `${r.durationMonths.toFixed(1)} months` : "—"}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "1.75rem" }}>
        <Disclosure title="Optional: marketing → customer acquisition (illustrative)" onOpen={() => track("calculator_open", { detail: "acquisition", sectionId: "investment" })}>
          <p className="prop-body" style={{ marginBottom: "1.4rem" }}>
            The relationship between spend and customers, on explicitly illustrative assumptions. Customers don&rsquo;t arrive
            immediately, the acquisition cost isn&rsquo;t proven, and full-adoption annual revenue is not revenue earned during the
            acquisition period.
          </p>
          <div className="prop-grid prop-grid-2" style={{ gap: "1.5rem" }}>
            <div className="prop-stack-lg">
              <Slider label="Acquisition budget" value={acqBudget} min={0} max={100000} step={1000} onChange={setAcqBudget} format={(v) => gbp(v)} />
              <Slider label="Assumed cost per customer" value={cac} min={200} max={5000} step={100} onChange={setCac} format={(v) => gbp(v)} />
              <Slider label="Avg monthly exchanges / customer" value={avgExch} min={1} max={40} step={1} onChange={setAvgExch} />
            </div>
            <div className="prop-stack">
              <Readout label="Potential agency customers" value={num(Math.round(acq.customersAcquired))} />
              <Readout label="Added monthly exchanges" value={num(Math.round(acq.monthlyExchanges))} />
              <Readout label="Annual revenue at full adoption" value={gbp(Math.round(acq.annualRevenueFullAdoption))} coral hint="Not first-year revenue — acquisition is phased" />
            </div>
          </div>
        </Disclosure>
      </div>

      <Note>
        Indicative allocation, not supplier quotes or commitments. The growth budget is distinct from separately-required
        development, infrastructure, operating or founder-remuneration funding, which would be reviewed to establish the full
        requirement.
      </Note>

      <style>{`
        .prop-inv { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: clamp(1rem, 2.5vw, 1.75rem); margin-top: 2rem; align-items: start; }
        @media (max-width: 820px) { .prop-inv { grid-template-columns: 1fr; } }
      `}</style>
    </Section>
  );
}
