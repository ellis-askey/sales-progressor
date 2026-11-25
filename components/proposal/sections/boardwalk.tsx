"use client";

import { useMemo, useState } from "react";
import { Section } from "./_shell";
import { SectionHead, Slider, Readout, Disclosure, Note, ResetButton, gbp, num } from "../ui";
import { boardwalkEconomics, fallThrough, pct, BOARDWALK_AVG_FEE, BOARDWALK_REVENUE_TARGET } from "@/lib/proposal/model";
import { useBeacon } from "../analytics-client";

export function BoardwalkSection() {
  const { track } = useBeacon();
  const [exch, setExch] = useState(80);
  const [fee, setFee] = useState(BOARDWALK_AVG_FEE);
  const [target, setTarget] = useState(BOARDWALK_REVENUE_TARGET);

  const e = useMemo(() => boardwalkEconomics({ exchanges: exch, avgFee: fee, annualRevenueTarget: target }), [exch, fee, target]);

  // Fall-through model
  const [agreed, setAgreed] = useState(100);
  const [baseFo, setBaseFo] = useState(0.3);
  const [impFo, setImpFo] = useState(0.2);
  const ft = useMemo(() => fallThrough({ agreedSales: agreed, baselineFalloutPct: baseFo, improvedFalloutPct: impFo, avgFee: fee }), [agreed, baseFo, impFo, fee]);

  const reset = () => { setExch(80); setFee(BOARDWALK_AVG_FEE); setTarget(BOARDWALK_REVENUE_TARGET); };

  return (
    <Section id="boardwalk">
      <SectionHead
        eyebrow="09 — Boardwalk economics"
        title={
          <>
            Aligned with the revenue you generate<span className="prop-stop">.</span>
          </>
        }
        lead="Proposed Boardwalk pricing: £50 per exchange for the first 60 each month, then £35 thereafter. At 80 monthly exchanges, TSP costs around 1.08% of the commission those exchanges represent."
      />

      <div className="prop-bw" onPointerDown={() => track("calculator_open", { detail: "boardwalk-economics", sectionId: "boardwalk" })}>
        <div className="prop-card prop-card--pad-lg">
          <div className="prop-between" style={{ marginBottom: "1.3rem" }}>
            <h3 className="prop-h3">Your assumptions</h3>
            <ResetButton onClick={reset} />
          </div>
          <div className="prop-stack-lg">
            <Slider label="Monthly exchanges" value={exch} min={0} max={120} step={1} onChange={setExch} />
            <Slider label="Average agency fee" value={fee} min={1000} max={8000} step={50} onChange={setFee} format={(v) => gbp(v)} />
            <Slider label="Annual revenue ambition (2027/28)" value={target} min={1_000_000} max={12_000_000} step={250_000} onChange={setTarget} format={(v) => gbp(v)} />
          </div>
        </div>

        <div className="prop-stack">
          <div className="prop-grid prop-grid-2">
            <Readout label="Monthly TSP cost" value={gbp(e.monthlyCost)} />
            <Readout label="Annual TSP cost" value={gbp(e.annualCost)} coral />
          </div>
          <div className="prop-grid prop-grid-2">
            <Readout label="Share of illustrated commission" value={pct(e.pctOfCommission, 2)} hint={`${gbp(e.annualCommission)} annual commission`} />
            <Readout label="Share of revenue ambition" value={pct(e.pctOfTarget, 2)} hint={`of ${gbp(target)}`} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: "1.75rem" }}>
        <Disclosure title="Fall-through improvement model (illustrative)" onOpen={() => track("calculator_open", { detail: "fall-through", sectionId: "boardwalk" })}>
          <p className="prop-body" style={{ marginBottom: "1.4rem" }}>
            The economic sensitivity of transaction outcomes. The same number of agreed sales is used in both scenarios; the only
            change is the fall-through rate. Additional software charges are shown separately — this is gross commission, not
            profit, and improvements are not guaranteed or wholly attributable to TSP.
          </p>
          <div className="prop-grid prop-grid-2" style={{ gap: "1.5rem" }}>
            <div className="prop-stack-lg">
              <Slider label="Agreed sales" value={agreed} min={10} max={400} step={5} onChange={setAgreed} />
              <Slider label="Current fall-through rate" value={baseFo} min={0} max={0.6} step={0.01} onChange={setBaseFo} format={(v) => pct(v, 0)} />
              <Slider label="Improved fall-through rate" value={impFo} min={0} max={0.6} step={0.01} onChange={setImpFo} format={(v) => pct(v, 0)} />
            </div>
            <div className="prop-stack">
              <Readout label="Additional successful exchanges" value={num(Math.round(ft.additionalExchanges * 10) / 10)} hint={`${ft.baselineExchanges.toFixed(0)} → ${ft.improvedExchanges.toFixed(0)} exchanges`} />
              <Readout label="Additional gross commission" value={gbp(Math.round(ft.additionalGrossCommission))} coral />
              <Readout label="Additional TSP software charge" value={gbp(Math.round(ft.additionalSoftwareCost))} hint="Shown separately — not netted off" />
            </div>
          </div>
        </Disclosure>
      </div>

      <Note>
        Assumes consistent volumes. Exchange-based commission is distinct from Boardwalk&rsquo;s broader business revenue target,
        which is subject to confirmation. Pricing remains under discussion; results are not guaranteed.
      </Note>

      <style>{`
        .prop-bw { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(1rem, 2.5vw, 1.75rem); margin-top: 2rem; align-items: start; }
        @media (max-width: 820px) { .prop-bw { grid-template-columns: 1fr; } }
      `}</style>
    </Section>
  );
}
