"use client";

// Agent-side Stamp Duty calculator. A Quick-links row on the file sidebar
// opens a right-anchored Drawer holding the calculator, prefilled with the
// sale price. The band logic is the SAME single source of truth the buyer's
// portal runs (lib/sdlt.ts) — a Budget change to the thresholds updates both
// sides at once, nothing to keep in sync.
//
// Scope matches the portal calculator (lib/sdlt.ts header): England & Northern
// Ireland residential rates, first-time-buyer relief, additional-property
// surcharge. Always an estimate; the buyer's solicitor confirms the exact
// figure. Rendered only when the file has a purchase price.

import { useState } from "react";
import { Calculator, ArrowRight, CaretDown } from "@phosphor-icons/react";
import { Drawer } from "@/components/ui/Drawer";
import { calculateSdlt } from "@/lib/sdlt";

// One info-blue for every stamp-duty figure, matching the buyer's portal card
// (PortalCostsCard) so the two views read as the same tool. Semantic, not the
// agent accent — the agent coral stays the drawer's top accent line.
const INFO = "#3B82F6";
const FTB_CAP = 500_000;

function fmtGBP(n: number) {
  return "£" + Math.round(n).toLocaleString("en-GB");
}
function fmtPct(r: number) {
  return (r * 100).toFixed(1) + "%";
}
function onlyDigits(s: string) {
  return s.replace(/[^\d]/g, "");
}

export function StampDutyQuickAction({ priceGBP }: { priceGBP: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="agent-hover-row sdlt-quicklink"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 6px",
          borderRadius: 8,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          width: "100%",
          fontFamily: "inherit",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26,
            color: "var(--agent-text-secondary)",
          }}>
            <Calculator size={17} weight="regular" />
          </span>
          <span style={{ fontSize: 13, color: "var(--agent-text-primary)", fontWeight: 500 }}>
            Stamp duty calculator
          </span>
        </span>
        <span className="sdlt-arrow-glide">
          <span className="sdlt-arrow-spin">
            <ArrowRight size={13} weight="bold" />
          </span>
        </span>
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} ariaLabel="Stamp duty calculator" size="sm">
        <Drawer.Header>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--agent-text-primary)" }}>
            Stamp duty calculator
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)" }}>
            What the buyer pays. Same figures they see in their portal.
          </p>
        </Drawer.Header>
        <Drawer.Body>
          <SdltCalc priceGBP={priceGBP} />
        </Drawer.Body>
      </Drawer>

      <style>{`
        .sdlt-quicklink .sdlt-arrow-spin {
          display: inline-flex;
          color: var(--agent-text-muted);
          transform: rotate(-45deg);
          transition: transform 170ms cubic-bezier(0.16,1,0.3,1), color 170ms ease;
        }
        .sdlt-quicklink .sdlt-arrow-glide {
          display: inline-flex;
          transform: translateX(0);
          transition: transform 220ms cubic-bezier(0.16,1,0.3,1) 150ms;
        }
        .sdlt-quicklink:hover .sdlt-arrow-spin {
          transform: rotate(0deg);
          color: var(--agent-coral-deep, #FF6B4A);
        }
        .sdlt-quicklink:hover .sdlt-arrow-glide {
          transform: translateX(4px);
        }
        @media (prefers-reduced-motion: reduce) {
          .sdlt-quicklink .sdlt-arrow-spin,
          .sdlt-quicklink .sdlt-arrow-glide { transition: none; }
        }
      `}</style>
    </>
  );
}

function SdltCalc({ priceGBP }: { priceGBP: number }) {
  const [priceStr, setPriceStr] = useState(String(Math.round(priceGBP)));
  const [ftb, setFtb] = useState(false);
  const [additional, setAdditional] = useState(false);
  const [showBands, setShowBands] = useState(false);

  const price = Number(priceStr) || 0;
  const ftbEligible = price <= FTB_CAP;

  const result = calculateSdlt({ price, firstTimeBuyer: ftb, additionalProperty: additional });

  // First-time-buyer relief and the surcharge never combine — turning one on
  // clears the other (mirrors PortalCostsCard).
  function toggleFtb() {
    if (!ftbEligible) return;
    setFtb((v) => {
      const n = !v;
      if (n) setAdditional(false);
      return n;
    });
  }
  function toggleAdditional() {
    setAdditional((v) => {
      const n = !v;
      if (n) setFtb(false);
      return n;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Sale price — editable, prefilled from the file. */}
      <div>
        <label htmlFor="sdlt-price" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 6 }}>
          Sale price
        </label>
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          border: "1px solid rgba(15,23,42,0.12)", borderRadius: 10,
          padding: "0 12px", background: "rgba(255,255,255,0.6)",
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--agent-text-muted)" }}>£</span>
          <input
            id="sdlt-price"
            inputMode="numeric"
            value={price ? price.toLocaleString("en-GB") : ""}
            onChange={(e) => setPriceStr(onlyDigits(e.target.value))}
            placeholder="0"
            aria-label="Sale price"
            style={{
              flex: 1, border: "none", background: "transparent", padding: "10px 4px",
              textAlign: "right", fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)",
              fontVariantNumeric: "tabular-nums", outline: "none",
            }}
          />
        </div>
      </div>

      {/* What-if toggles. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <ToggleRow
          label="First-time buyer"
          sub={ftbEligible ? "No tax on the first £300,000" : "Only applies up to £500,000"}
          on={ftb}
          disabled={!ftbEligible}
          onClick={toggleFtb}
        />
        <ToggleRow
          label="Will own another property"
          sub="Second home or buy-to-let. Adds the 5% surcharge"
          on={additional}
          onClick={toggleAdditional}
        />
      </div>

      {/* Result. */}
      <div style={{
        borderRadius: 14, padding: "15px 16px",
        background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.16)",
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INFO }}>
          Estimated stamp duty
        </p>
        <p style={{ margin: 0, fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em", color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>
          {fmtGBP(result.total)}
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>
          Effective rate {fmtPct(result.effectiveRate)} of the purchase price
        </p>
      </div>

      {/* How it's worked out. */}
      <div>
        <button
          type="button"
          onClick={() => setShowBands((v) => !v)}
          aria-expanded={showBands}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer", padding: "2px 0",
            fontSize: 12.5, fontWeight: 600, color: INFO, fontFamily: "inherit",
          }}
        >
          {showBands ? "Hide how this is worked out" : "See how this is worked out"}
          <CaretDown size={13} weight="bold" style={{ transform: showBands ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }} />
        </button>
        {showBands && (
          <div style={{ marginTop: 8, border: "1px solid rgba(15,23,42,0.08)", borderRadius: 10, overflow: "hidden" }}>
            {result.bands.length === 0 ? (
              <p style={{ margin: 0, padding: "10px 13px", fontSize: 12.5, color: "var(--agent-text-muted)" }}>
                No stamp duty on this price.
              </p>
            ) : (
              result.bands.map((b, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 13px", fontSize: 12.5, color: "var(--agent-text-secondary)",
                    borderBottom: i < result.bands.length - 1 ? "1px solid rgba(15,23,42,0.08)" : "none",
                  }}
                >
                  <span>{fmtGBP(b.from)} to {fmtGBP(b.from + b.taxed)} at {(b.rate * 100).toFixed(0)}%</span>
                  <span style={{ fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmtGBP(b.tax)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>
        Estimate using Stamp Duty Land Tax rates for England and Northern Ireland. Rates differ in Scotland and Wales. The buyer&apos;s solicitor confirms the exact figure for their purchase.
      </p>
    </div>
  );
}

function ToggleRow({
  label, sub, on, disabled, onClick,
}: {
  label: string;
  sub: string;
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      style={{
        display: "flex", alignItems: "flex-start", gap: 11, textAlign: "left", width: "100%",
        padding: "11px 13px", borderRadius: 11, cursor: disabled ? "not-allowed" : "pointer",
        border: `${on ? 1.5 : 1}px solid ${on ? INFO : "rgba(15,23,42,0.10)"}`,
        background: on ? "rgba(59,130,246,0.06)" : "rgba(255,255,255,0.5)",
        opacity: disabled ? 0.5 : 1, fontFamily: "inherit",
        transition: "border-color 140ms ease, background 140ms ease",
      }}
    >
      <span style={{
        width: 19, height: 19, borderRadius: 6, flexShrink: 0, marginTop: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: on ? INFO : "transparent",
        border: on ? "none" : "1.5px solid rgba(15,23,42,0.16)",
      }}>
        {on && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>{label}</span>
        <span style={{ display: "block", fontSize: 11.5, marginTop: 2, lineHeight: 1.35, color: "var(--agent-text-muted)" }}>{sub}</span>
      </span>
    </button>
  );
}
