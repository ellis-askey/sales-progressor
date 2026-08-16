"use client";

// Stamp duty (SDLT) estimator for buyers. Card face shows a starting estimate at
// standard rates; tapping opens a sheet where the buyer can edit the price and
// toggle first-time-buyer / additional-property to refine it. England & NI only
// (see lib/sdlt.ts). An estimate — the solicitor confirms the real figure.

import { useState } from "react";
import { P } from "./portal-ui";
import { calculateSdlt } from "@/lib/sdlt";

function fmtGBP(n: number) {
  return "£" + Math.round(n).toLocaleString("en-GB");
}
function fmtPct(r: number) {
  return (r * 100).toFixed(1) + "%";
}
// Show the portion of each band actually used by the price. The upper figure is
// capped at the purchase price (from + the taxed slice), so a £650k purchase in
// the £250k–£925k band reads "£250,000 to £650,000", not "…to £925,000".
function bandLabel(from: number, upper: number) {
  return `${fmtGBP(from)} to ${fmtGBP(upper)}`;
}

export function PortalStampDutyCard({ priceGBP }: { priceGBP: number }) {
  const [open, setOpen] = useState(false);
  const [priceStr, setPriceStr] = useState(String(Math.round(priceGBP)));
  const [ftb, setFtb] = useState(false);
  const [additional, setAdditional] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const price = Number(priceStr) || 0;
  const starting = calculateSdlt({ price: priceGBP, firstTimeBuyer: false, additionalProperty: false });
  const result = calculateSdlt({ price, firstTimeBuyer: ftb, additionalProperty: additional });

  // First-time-buyer relief and the additional-property surcharge never combine,
  // so the toggles are mutually exclusive in the UI.
  function toggleFtb() {
    setFtb((v) => {
      const next = !v;
      if (next) setAdditional(false);
      return next;
    });
  }
  function toggleAdditional() {
    setAdditional((v) => {
      const next = !v;
      if (next) setFtb(false);
      return next;
    });
  }

  return (
    <>
      {/* Card face */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pbtn pbtn-press block w-full text-left"
        style={{
          borderRadius: 16,
          padding: 16,
          background: "linear-gradient(160deg, rgba(37,99,235,0.09), rgba(37,99,235,0.02))",
          border: "0.5px solid rgba(37,99,235,0.14)",
          boxShadow: P.shadowSm,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 52, height: 52, borderRadius: 14, background: "#fff", color: "#2563EB", boxShadow: "0 2px 8px rgba(37,99,235,0.20)" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="3" y1="22" x2="21" y2="22" /><line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" /><line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" /><polygon points="12 2 20 7 4 7" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold" style={{ color: P.textPrimary, marginBottom: 2 }}>
            Stamp duty estimate
          </p>
          <p className="text-[12px]" style={{ color: P.textSecondary, lineHeight: 1.4 }}>
            About <b style={{ color: "#1D4ED8" }}>{fmtGBP(starting.total)}</b> on {fmtGBP(priceGBP)}. Assumes standard rates. Tap to adjust.
          </p>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Sheet */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setOpen(false)}>
          <div className="portal-sheet-backdrop absolute inset-0" style={{ background: "rgba(15,23,42,0.45)" }} />
          <div
            className="portal-sheet relative w-full max-w-lg mx-auto"
            style={{
              background: "#FFFFFF",
              borderRadius: `${P.radiusXl} ${P.radiusXl} 0 0`,
              boxShadow: P.shadowXl,
              paddingBottom: "env(safe-area-inset-bottom, 16px)",
              maxHeight: "88vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(139,145,163,0.30)" }} />
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "rgba(15,23,42,0.06)", color: P.textMuted }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="px-6 pt-2 pb-6">
              <p className="text-[18px] font-semibold leading-snug mb-4" style={{ color: P.textPrimary }}>
                Stamp duty estimate
              </p>

              {/* Price */}
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: P.textSecondary }}>
                Purchase price
              </label>
              <div
                className="flex items-center rounded-xl px-4 mb-4"
                style={{ border: `1px solid ${P.border}`, background: P.pageBg }}
              >
                <span className="text-[16px] font-semibold" style={{ color: P.textMuted }}>£</span>
                <input
                  inputMode="numeric"
                  value={Number(priceStr || 0).toLocaleString("en-GB")}
                  onChange={(e) => setPriceStr(e.target.value.replace(/[^\d]/g, ""))}
                  className="w-full py-3 pl-1.5 text-[16px] font-semibold bg-transparent focus:outline-none"
                  style={{ color: P.textPrimary }}
                  aria-label="Purchase price"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-2 mb-5">
                <ToggleRow
                  label="First-time buyer"
                  sub="Never owned a home before, and this will be your only property"
                  on={ftb}
                  onClick={toggleFtb}
                />
                <ToggleRow
                  label="I'll own another property after this"
                  sub="A second home or buy-to-let. Adds the surcharge"
                  on={additional}
                  onClick={toggleAdditional}
                />
              </div>

              {/* Result */}
              <div className="rounded-2xl px-5 py-4 mb-4" style={{ background: "rgba(37,99,235,0.06)", border: "0.5px solid rgba(37,99,235,0.14)" }}>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: "#2563EB" }}>
                  Estimated stamp duty
                </p>
                <p className="text-[30px] font-black leading-none tabular-nums" style={{ color: P.textPrimary }}>
                  {fmtGBP(result.total)}
                </p>
                <p className="text-[12px] mt-1.5" style={{ color: P.textSecondary }}>
                  Effective rate {fmtPct(result.effectiveRate)} of the purchase price
                </p>
              </div>

              {/* Breakdown */}
              <button
                type="button"
                onClick={() => setShowBreakdown((v) => !v)}
                className="flex items-center gap-1.5 text-[13px] font-semibold mb-3"
                style={{ color: P.accent }}
              >
                {showBreakdown ? "Hide" : "See"} how this is worked out
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showBreakdown ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showBreakdown && (
                <div className="rounded-xl overflow-hidden mb-4" style={{ border: `1px solid ${P.border}` }}>
                  {result.bands.length === 0 ? (
                    <p className="px-4 py-3 text-[13px]" style={{ color: P.textMuted }}>No stamp duty on this price.</p>
                  ) : (
                    result.bands.map((b, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-4 py-2.5 text-[13px]"
                        style={{ borderBottom: i < result.bands.length - 1 ? `1px solid ${P.border}` : undefined, color: P.textSecondary }}
                      >
                        <span>{bandLabel(b.from, b.from + b.taxed)} at {(b.rate * 100).toFixed(0)}%</span>
                        <span className="font-semibold tabular-nums" style={{ color: P.textPrimary }}>{fmtGBP(b.tax)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Disclaimer */}
              <p className="text-[11.5px] leading-relaxed" style={{ color: P.textMuted }}>
                This is an estimate using Stamp Duty Land Tax rates for England and Northern Ireland. Rates differ in Scotland (LBTT) and Wales (LTT). Your solicitor will confirm the exact figure for your purchase.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ToggleRow({ label, sub, on, onClick }: { label: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 text-left w-full rounded-xl px-4 py-3"
      style={{
        border: `1px solid ${on ? P.primary : P.border}`,
        borderWidth: on ? 2 : 1,
        background: on ? P.primaryBg : "#fff",
      }}
      aria-pressed={on}
    >
      <span
        className="flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ width: 20, height: 20, borderRadius: 6, background: on ? P.primary : "transparent", border: on ? "none" : `1.5px solid ${P.border}` }}
      >
        {on && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold" style={{ color: P.textPrimary }}>{label}</span>
        <span className="block text-[12px] mt-0.5 leading-snug" style={{ color: P.textMuted }}>{sub}</span>
      </span>
    </button>
  );
}
