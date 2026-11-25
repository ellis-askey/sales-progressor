"use client";

import { useMemo, useState } from "react";
import { Section } from "./_shell";
import { SectionHead, Slider, PresetRow, Readout, Drawer, Stepper, Donut, Legend, Note, ResetButton, PButton, cx, gbp, num } from "../ui";
import {
  agencyRevenue,
  mixedPortfolio,
  gbpCompact,
  boardwalkMonthlyCost,
  type PortfolioGroup,
} from "@/lib/proposal/model";
import { useBeacon } from "../analytics-client";

const AGENCY_PRESETS = [20, 50, 100, 250, 500, 1000];
const EXCHANGE_PRESETS = [5, 10, 15, 30, 60, 80];

const SCENARIOS = [
  { id: "small", label: "Smaller established", agencies: 20, exch: 10 },
  { id: "regional", label: "Regional adoption", agencies: 50, exch: 10 },
  { id: "national", label: "National growth", agencies: 250, exch: 10 },
  { id: "large", label: "Larger-scale", agencies: 1000, exch: 10 },
];

const PORTFOLIO_COLORS = ["#ff6b4a", "#ff9470", "#ffc0a6", "#3d4b58", "#6c7884"];

const DEFAULT_GROUPS: (PortfolioGroup & { desc: string })[] = [
  { id: "smaller", label: "Smaller agencies", desc: "5 / month", count: 10, avgExchanges: 5 },
  { id: "established", label: "Established branches", desc: "10 / month", count: 6, avgExchanges: 10 },
  { id: "busy", label: "Busy branches", desc: "20 / month", count: 3, avgExchanges: 20 },
  { id: "larger", label: "Larger agencies", desc: "40 / month", count: 1, avgExchanges: 40 },
];

export function CommercialSection() {
  const { track } = useBeacon();
  const [agencies, setAgencies] = useState(100);
  const [exch, setExch] = useState(10);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const r = useMemo(() => agencyRevenue({ agencies, exchangesPerAgency: exch }), [agencies, exch]);

  const onOpen = () => track("calculator_open", { detail: "agency-revenue", sectionId: "commercial" });

  return (
    <Section id="commercial" alt wide>
      <SectionHead
        eyebrow="08 — Commercial model"
        title={
          <>
            Revenue grows with successful exchanges<span className="prop-stop">.</span>
          </>
        }
        lead="The standard agency charge is £50 per successful exchange. A relatively small number of customers can represent meaningful, recurring software revenue. Adjust the assumptions — nothing here is a forecast."
      />

      <div className="prop-comm" onPointerDown={onOpen}>
        <div className="prop-card prop-card--pad-lg">
          <div className="prop-between" style={{ marginBottom: "1.4rem" }}>
            <h3 className="prop-h3">Agency revenue calculator</h3>
            <ResetButton onClick={() => { setAgencies(100); setExch(10); }} />
          </div>

          <div className="prop-stack-lg">
            <div>
              <Slider label="Agency customers" value={agencies} min={5} max={1000} step={5} onChange={setAgencies} />
              <div style={{ marginTop: "0.7rem" }}>
                <PresetRow options={AGENCY_PRESETS} value={AGENCY_PRESETS.includes(agencies) ? agencies : -1} onChange={(v) => setAgencies(v as number)} format={(v) => num(v as number)} />
              </div>
            </div>
            <div>
              <Slider label="Average monthly exchanges per agency" value={exch} min={1} max={80} step={1} onChange={setExch} />
              <div style={{ marginTop: "0.7rem" }}>
                <PresetRow options={EXCHANGE_PRESETS} value={EXCHANGE_PRESETS.includes(exch) ? exch : -1} onChange={(v) => setExch(v as number)} />
              </div>
            </div>
          </div>

          <p className="prop-caption" style={{ marginTop: "1.5rem" }}>
            {num(agencies)} agencies averaging {num(exch)} exchanges each is{" "}
            <strong style={{ color: "var(--prop-ink)" }}>{num(r.totalMonthlyExchanges)}</strong> monthly exchanges.
          </p>
        </div>

        <div className="prop-panel prop-comm-out">
          <p className="prop-eyebrow" style={{ marginBottom: "1.2rem" }}>At these assumptions</p>
          <div className="prop-stack-lg">
            <div>
              <div className="prop-stat-value" style={{ color: "var(--prop-coral-soft)" }}>{gbp(r.annualRevenue)}</div>
              <div className="prop-stat-label" style={{ color: "var(--prop-navy-ink-2)" }}>Annualised software revenue</div>
            </div>
            <div className="prop-grid prop-grid-2" style={{ gap: "1rem" }}>
              <div>
                <div className="prop-h2" style={{ color: "var(--prop-navy-ink)" }}>{gbp(r.monthlyRevenue)}</div>
                <div className="prop-stat-label" style={{ color: "var(--prop-navy-ink-2)" }}>Monthly revenue</div>
              </div>
              <div>
                <div className="prop-h2" style={{ color: "var(--prop-navy-ink)" }}>{num(r.totalAnnualExchanges)}</div>
                <div className="prop-stat-label" style={{ color: "var(--prop-navy-ink-2)" }}>Exchanges / year</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scenario comparison */}
      <div style={{ marginTop: "2.5rem" }}>
        <h3 className="prop-h3" style={{ marginBottom: "1rem" }}>Compare scenarios</h3>
        <div className="prop-grid prop-grid-4">
          {SCENARIOS.map((s) => {
            const sr = agencyRevenue({ agencies: s.agencies, exchangesPerAgency: s.exch });
            const activeS = agencies === s.agencies && exch === s.exch;
            return (
              <button
                key={s.id}
                type="button"
                className={cx("prop-card", "prop-scenario")}
                data-active={activeS}
                onClick={() => { setAgencies(s.agencies); setExch(s.exch); }}
              >
                <div className="prop-caption" style={{ marginBottom: 8 }}>{s.label}</div>
                <div className="prop-stat-value" style={{ fontSize: "clamp(1.4rem, 2.6vw, 1.9rem)" }}>{gbpCompact(sr.annualRevenue)}</div>
                <div className="prop-stat-label">{num(s.agencies)} agencies · {s.exch}/mo</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <PButton variant="ghost" onClick={() => { setDrawerOpen(true); track("calculator_open", { detail: "mixed-portfolio", sectionId: "commercial" }); }}>
          Build a mixed customer portfolio
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 8h9m0 0L8.5 4.5M12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </PButton>
      </div>

      <Note>
        Illustrative gross software revenue only — not a forecast or profit. Excludes VAT, discounts, churn, acquisition and
        operating costs. Agency accounts may be single branches or larger businesses.
      </Note>

      <PortfolioDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <style>{`
        .prop-comm { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: clamp(1rem, 2.5vw, 1.75rem); margin-top: 2rem; align-items: stretch; }
        .prop-comm-out { display: flex; flex-direction: column; justify-content: center; }
        .prop-scenario { text-align: left; cursor: pointer; border: 1px solid var(--prop-line); transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease; }
        .prop-scenario:hover { box-shadow: var(--prop-shadow-md); transform: translateY(-2px); }
        .prop-scenario[data-active="true"] { border-color: var(--prop-coral); box-shadow: 0 0 0 1px var(--prop-coral); }
        @media (max-width: 820px) { .prop-comm { grid-template-columns: 1fr; } }
      `}</style>
    </Section>
  );
}

function PortfolioDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [groups, setGroups] = useState(DEFAULT_GROUPS);
  const [includeBoardwalk, setIncludeBoardwalk] = useState(true);
  const [bwExch, setBwExch] = useState(80);

  const set = (id: string, patch: Partial<PortfolioGroup>) =>
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const result = useMemo(
    () => mixedPortfolio(groups, includeBoardwalk ? { exchanges: bwExch } : undefined),
    [groups, includeBoardwalk, bwExch],
  );

  const donut = result.perGroup
    .filter((g) => g.monthlyRevenue > 0)
    .map((g, i) => ({ label: g.label, value: g.monthlyRevenue, color: PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length] }));

  const reset = () => { setGroups(DEFAULT_GROUPS); setIncludeBoardwalk(true); setBwExch(80); };

  return (
    <Drawer open={open} onClose={onClose} title="Mixed customer portfolio" footer={<ResetButton onClick={reset} />}>
      <p className="prop-body" style={{ marginBottom: "1.4rem" }}>
        Not every agency has the same volume. Build a blend and see the combined revenue. Boardwalk is priced once on its tiered
        rate and never double-counted.
      </p>

      <div className="prop-stack">
        {groups.map((g) => (
          <div key={g.id} className="prop-card prop-card--quiet" style={{ padding: "0.9rem 1rem" }}>
            <div className="prop-between" style={{ marginBottom: "0.7rem" }}>
              <div>
                <div className="prop-field-label" style={{ color: "var(--prop-ink)" }}>{g.label}</div>
                <div className="prop-caption">{g.desc}</div>
              </div>
              <Stepper value={g.count} min={0} max={1000} onChange={(v) => set(g.id, { count: v })} ariaLabel={`${g.label} count`} />
            </div>
            <Slider label="Avg exchanges / month" value={g.avgExchanges} min={1} max={60} step={1} onChange={(v) => set(g.id, { avgExchanges: v })} />
          </div>
        ))}

        <div className="prop-card prop-card--quiet" style={{ padding: "0.9rem 1rem" }}>
          <label className="prop-between" style={{ cursor: "pointer", marginBottom: includeBoardwalk ? "0.7rem" : 0 }}>
            <span className="prop-field-label" style={{ color: "var(--prop-ink)" }}>Include Boardwalk (tiered)</span>
            <input type="checkbox" checked={includeBoardwalk} onChange={(e) => setIncludeBoardwalk(e.target.checked)} />
          </label>
          {includeBoardwalk && (
            <Slider label="Boardwalk monthly exchanges" value={bwExch} min={1} max={120} step={1} onChange={setBwExch} />
          )}
        </div>
      </div>

      <div className="prop-card prop-card--pad-lg" style={{ marginTop: "1.4rem" }}>
        <div style={{ display: "flex", gap: "1.2rem", alignItems: "center", flexWrap: "wrap" }}>
          <Donut segments={donut} centerLabel={gbpCompact(result.annualRevenue)} centerSub="per year" size={150} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <Legend items={donut.map((d) => ({ label: d.label, color: d.color, value: gbp(d.value) }))} />
          </div>
        </div>
        <div className="prop-between" style={{ marginTop: "1.2rem", paddingTop: "1.2rem", borderTop: "1px solid var(--prop-line)" }}>
          <div>
            <div className="prop-stat-value prop-stat-value--coral" style={{ fontSize: "1.8rem" }}>{gbp(result.monthlyRevenue)}</div>
            <div className="prop-stat-label">Combined monthly revenue</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="prop-field-value">{num(result.totalMonthlyExchanges)}</div>
            <div className="prop-stat-label">monthly exchanges</div>
          </div>
        </div>
        {includeBoardwalk && (
          <p className="prop-caption" style={{ marginTop: "0.8rem" }}>
            Boardwalk contributes {gbp(boardwalkMonthlyCost(bwExch))}/month on its tier — counted exactly once.
          </p>
        )}
      </div>
    </Drawer>
  );
}
