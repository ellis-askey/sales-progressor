"use client";

// "Your costs" overview for buyers. Consolidates the money picture: purchase
// price, the ~10% deposit (marked Paid once PM24 confirms), and the stamp-duty
// estimate (tap the row to open the calculator). It's an OVERVIEW, not a precise
// balance — we don't store the mortgage advance or the solicitor's fees, so the
// exact figure comes from the solicitor's completion statement. Replaces the old
// standalone stamp-duty card.

import { useState } from "react";
import { P } from "./portal-ui";
import { PortalGlassCard } from "./PortalGlassCard";
import { calculateSdlt } from "@/lib/sdlt";

function fmtGBP(n: number) {
  return "£" + Math.round(n).toLocaleString("en-GB");
}
function fmtPct(r: number) {
  return (r * 100).toFixed(1) + "%";
}
function bandLabel(from: number, upper: number) {
  return `${fmtGBP(from)} to ${fmtGBP(upper)}`;
}

export function PortalCostsCard({ priceGBP, depositPaid }: { priceGBP: number; depositPaid: boolean }) {
  const [open, setOpen] = useState(false);
  const [priceStr, setPriceStr] = useState(String(Math.round(priceGBP)));
  const [ftb, setFtb] = useState(false);
  const [additional, setAdditional] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const price = Number(priceStr) || 0;
  const result = calculateSdlt({ price, firstTimeBuyer: ftb, additionalProperty: additional });
  const deposit = Math.round(priceGBP * 0.1);

  function toggleFtb() {
    setFtb((v) => { const n = !v; if (n) setAdditional(false); return n; });
  }
  function toggleAdditional() {
    setAdditional((v) => { const n = !v; if (n) setFtb(false); return n; });
  }

  return (
    <>
      <PortalGlassCard glassId="your-costs" label="Your costs" className="overflow-hidden">
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${P.border}` }}>
          <p className="text-[13px] font-bold" style={{ color: P.textPrimary }}>Your costs</p>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${P.border}` }}>
          <p className="text-[14px]" style={{ color: P.textPrimary }}>Purchase price</p>
          <span className="text-[14px] font-semibold tabular-nums" style={{ color: P.textPrimary }}>{fmtGBP(priceGBP)}</span>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${P.border}` }}>
          <p className="text-[14px]" style={{ color: P.textPrimary }}>Deposit <span style={{ color: P.textMuted }}>(about 10%)</span></p>
          <div className="flex items-center gap-2">
            {depositPaid && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: P.successBg, color: P.success }}>Paid</span>
            )}
            <span className="text-[14px] font-semibold tabular-nums" style={{ color: P.textPrimary }}>{fmtGBP(deposit)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pbtn pbtn-press w-full flex items-center justify-between px-5 py-3.5 text-left"
          style={{ borderBottom: `1px solid ${P.border}`, background: "transparent" }}
        >
          <div>
            <p className="text-[14px]" style={{ color: P.textPrimary }}>Stamp duty</p>
            <p className="text-[11px]" style={{ color: P.textMuted }}>Estimate. Tap to adjust</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-semibold tabular-nums" style={{ color: "#1D4ED8" }}>~{fmtGBP(result.total)}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </button>

        <div className="px-5 py-3.5">
          <p className="text-[12px] leading-relaxed" style={{ color: P.textMuted }}>
            Your solicitor will send a completion statement with the exact balance to transfer, including their fees and any other costs.
          </p>
        </div>
      </PortalGlassCard>

      {/* Stamp-duty calculator sheet */}
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
              <p className="text-[18px] font-semibold leading-snug mb-4" style={{ color: P.textPrimary }}>Stamp duty estimate</p>

              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: P.textSecondary }}>Purchase price</label>
              <div className="flex items-center rounded-xl px-4 mb-4" style={{ border: `1px solid ${P.border}`, background: P.pageBg }}>
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

              <div className="flex flex-col gap-2 mb-5">
                <ToggleRow label="First-time buyer" sub="Never owned a home before, and this will be your only property" on={ftb} onClick={toggleFtb} />
                <ToggleRow label="I'll own another property after this" sub="A second home or buy-to-let. Adds the surcharge" on={additional} onClick={toggleAdditional} />
              </div>

              <div className="rounded-2xl px-5 py-4 mb-4" style={{ background: "rgba(37,99,235,0.06)", border: "0.5px solid rgba(37,99,235,0.14)" }}>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: "#2563EB" }}>Estimated stamp duty</p>
                <p className="text-[30px] font-black leading-none tabular-nums" style={{ color: P.textPrimary }}>{fmtGBP(result.total)}</p>
                <p className="text-[12px] mt-1.5" style={{ color: P.textSecondary }}>Effective rate {fmtPct(result.effectiveRate)} of the purchase price</p>
              </div>

              <button type="button" onClick={() => setShowBreakdown((v) => !v)} className="flex items-center gap-1.5 text-[13px] font-semibold mb-3" style={{ color: P.accent }}>
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
                      <div key={i} className="flex items-center justify-between px-4 py-2.5 text-[13px]" style={{ borderBottom: i < result.bands.length - 1 ? `1px solid ${P.border}` : undefined, color: P.textSecondary }}>
                        <span>{bandLabel(b.from, b.from + b.taxed)} at {(b.rate * 100).toFixed(0)}%</span>
                        <span className="font-semibold tabular-nums" style={{ color: P.textPrimary }}>{fmtGBP(b.tax)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

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
      style={{ border: `1px solid ${on ? P.primary : P.border}`, borderWidth: on ? 2 : 1, background: on ? P.primaryBg : "#fff" }}
      aria-pressed={on}
    >
      <span className="flex items-center justify-center flex-shrink-0 mt-0.5" style={{ width: 20, height: 20, borderRadius: 6, background: on ? P.primary : "transparent", border: on ? "none" : `1.5px solid ${P.border}` }}>
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
