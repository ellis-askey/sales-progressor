"use client";

import { useMemo, useState } from "react";
import { Section } from "./_shell";
import { SectionHead, Slider, Readout, Note, num, gbp } from "../ui";
import { additionalSoftware, pct, FORMS_BUNDLE_MONTHLY } from "@/lib/proposal/model";
import { useBeacon } from "../analytics-client";

export function SoftwareSection() {
  const { track } = useBeacon();
  const [customers, setCustomers] = useState(100);
  const [adoption, setAdoption] = useState(0.3);

  const r = useMemo(() => additionalSoftware({ customers, adoptionPct: adoption }), [customers, adoption]);

  return (
    <Section id="software">
      <SectionHead
        eyebrow="11 — Operational tools"
        title={
          <>
            Each tool adds customer value and revenue<span className="prop-stop">.</span>
          </>
        }
        lead={`The illustrative Forms + Tasks bundle is £${FORMS_BUNDLE_MONTHLY}/month. Not every customer takes every module — but each one that does deepens the relationship and adds recurring revenue alongside core progression.`}
      />

      <div className="prop-sw" onPointerDown={() => track("calculator_open", { detail: "operational-software", sectionId: "software" })}>
        <div className="prop-card prop-card--pad-lg">
          <h3 className="prop-h3" style={{ marginBottom: "1.3rem" }}>Bundle adoption</h3>
          <div className="prop-stack-lg">
            <Slider label="Total agency customers" value={customers} min={10} max={1000} step={10} onChange={setCustomers} />
            <Slider label="Share adopting the bundle" value={adoption} min={0} max={1} step={0.05} onChange={setAdoption} format={(v) => pct(v, 0)} />
          </div>
          <p className="prop-caption" style={{ marginTop: "1.4rem" }}>
            {num(Math.round(r.adoptingCustomers))} of {num(customers)} customers on the £{FORMS_BUNDLE_MONTHLY}/month bundle.
          </p>
        </div>
        <div className="prop-stack">
          <Readout label="Additional monthly revenue" value={gbp(r.monthlyRevenue)} />
          <Readout label="Additional annual revenue" value={gbp(r.annualRevenue)} coral />
        </div>
      </div>

      <Note>
        The wider strategy isn&rsquo;t to charge for every small feature — a broader operations package may become appropriate as
        the platform grows. Figures are illustrative; adoption is not assumed to be universal.
      </Note>

      <style>{`
        .prop-sw { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: clamp(1rem, 2.5vw, 1.75rem); margin-top: 2rem; align-items: start; }
        @media (max-width: 760px) { .prop-sw { grid-template-columns: 1fr; } }
      `}</style>
    </Section>
  );
}
