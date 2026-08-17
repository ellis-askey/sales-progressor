"use client";

// Buyer costs, switched on exchange (one or the other, never both):
//  - Before exchange: the standalone stamp-duty estimate card. Tapping opens the
//    calculator to refine it. Nothing else — the real deposit/mortgage figures
//    aren't settled yet.
//  - After exchange: "Your costs" — the buyer confirms the deposit they actually
//    paid and their mortgage advance, and we show the estimated funds still to
//    send at completion (price − deposit − mortgage + SDLT). Those two figures
//    persist (portalSaveCostsAction). Fees still come from the solicitor's
//    completion statement, so it's an estimate, not a precise balance.

import { useState } from "react";
import { createPortal } from "react-dom";
import { P } from "./portal-ui";
import { PortalGlassCard } from "./PortalGlassCard";
import { calculateSdlt } from "@/lib/sdlt";
import { portalSaveCostsAction } from "@/app/actions/portal";

function fmtGBP(n: number) {
  return "£" + Math.round(n).toLocaleString("en-GB");
}
function fmtPct(r: number) {
  return (r * 100).toFixed(1) + "%";
}
function bandLabel(from: number, upper: number) {
  return `${fmtGBP(from)} to ${fmtGBP(upper)}`;
}
function digits(s: string) {
  return s.replace(/[^\d]/g, "");
}

type Props = {
  priceGBP: number;
  hasExchanged: boolean;
  isCash: boolean;
  savedDeposit: number | null;
  savedMortgage: number | null;
  token: string;
};

export function PortalCostsCard({ priceGBP, hasExchanged, isCash, savedDeposit, savedMortgage, token }: Props) {
  const [open, setOpen] = useState(false);
  const [ftb, setFtb] = useState(false);
  const [additional, setAdditional] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [depositStr, setDepositStr] = useState(String(savedDeposit ?? Math.round(priceGBP * 0.1)));
  const [mortgageStr, setMortgageStr] = useState(savedMortgage != null ? String(savedMortgage) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const starting = calculateSdlt({ price: priceGBP, firstTimeBuyer: false, additionalProperty: false });
  const result = calculateSdlt({ price: priceGBP, firstTimeBuyer: ftb, additionalProperty: additional });
  const sdlt = result.total;

  const depositNum = Number(depositStr) || 0;
  const mortgageNum = isCash ? 0 : (Number(mortgageStr) || 0);
  const fundsToSend = Math.max(0, priceGBP - depositNum - mortgageNum + sdlt);

  // Only show the funds figure once every APPLICABLE input has a value. Cash
  // buyers have no mortgage, so deposit alone is enough for them; mortgage
  // buyers need both. Guessing with a blank input would mislead.
  const depositFilled = depositStr.trim() !== "" && depositNum > 0;
  const mortgageFilled = isCash || (mortgageStr.trim() !== "" && mortgageNum > 0);
  const showFunds = depositFilled && mortgageFilled;
  const missingLabel = !depositFilled ? "deposit" : "mortgage amount";

  const dirty =
    depositNum !== (savedDeposit ?? Math.round(priceGBP * 0.1)) ||
    (!isCash && mortgageNum !== (savedMortgage ?? 0));

  function toggleFtb() { setFtb((v) => { const n = !v; if (n) setAdditional(false); return n; }); }
  function toggleAdditional() { setAdditional((v) => { const n = !v; if (n) setFtb(false); return n; }); }

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const res = await portalSaveCostsAction({
        token,
        depositGBP: depositNum,
        mortgageGBP: isCash ? null : mortgageNum,
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {hasExchanged ? (
        <PortalGlassCard glassId="your-costs" label="Your costs" className="overflow-hidden">
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${P.border}` }}>
            <p className="text-[13px] font-bold" style={{ color: P.textPrimary }}>Your costs</p>
          </div>

          <Row label="Purchase price" value={fmtGBP(priceGBP)} />
          <MoneyRow label="Deposit paid" value={depositStr} onChange={(v) => { setDepositStr(v); setSaved(false); }} />
          {!isCash && (
            <MoneyRow label="Mortgage amount" hint="From your mortgage offer" value={mortgageStr} onChange={(v) => { setMortgageStr(v); setSaved(false); }} />
          )}

          {/* Stamp duty — tappable */}
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
              <span className="text-[14px] font-semibold tabular-nums" style={{ color: "#1D4ED8" }}>~{fmtGBP(sdlt)}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </button>

          {showFunds ? (
            <div className="flex items-center justify-between px-5 py-4" style={{ background: P.primaryBg }}>
              <div>
                <p className="text-[14px] font-bold" style={{ color: P.textPrimary }}>Funds still to send</p>
                <p className="text-[11px]" style={{ color: P.textMuted }}>Estimated, before fees</p>
              </div>
              <span className="text-[20px] font-black tabular-nums" style={{ color: P.primary }}>~{fmtGBP(fundsToSend)}</span>
            </div>
          ) : (
            <div className="px-5 py-4" style={{ background: P.pageBg }}>
              <p className="text-[13px]" style={{ color: P.textMuted }}>
                Add your {missingLabel} to see the funds still to send.
              </p>
            </div>
          )}
          <div className="px-5 py-3.5">
            <p className="text-[12px] leading-relaxed mb-3" style={{ color: P.textMuted }}>
              Plus your solicitor&apos;s fees and any other costs. They&apos;ll confirm the exact balance to transfer on your completion statement.
            </p>
            {saved && !dirty ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: P.successBg }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-[13px] font-bold" style={{ color: P.success }}>Figures saved</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={save}
                disabled={saving || !dirty}
                className="pbtn pbtn-press px-4 py-2 rounded-xl text-[13px] font-bold text-white disabled:opacity-40"
                style={{ background: P.primary }}
              >
                {saving ? "Saving…" : "Save my figures"}
              </button>
            )}
          </div>
        </PortalGlassCard>
      ) : (
        /* Before exchange — standalone stamp-duty estimate card. */
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
      )}

      {/* Stamp-duty calculator sheet — portalled to <body> so it overlays the
          viewport, not the bottom of the (long) overview page. */}
      {open && typeof document !== "undefined" && createPortal(
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
              <p className="text-[18px] font-semibold leading-snug mb-1" style={{ color: P.textPrimary }}>Stamp duty estimate</p>
              <p className="text-[13px] mb-4" style={{ color: P.textMuted }}>On {fmtGBP(priceGBP)}</p>

              <div className="flex flex-col gap-2 mb-5">
                <ToggleRow label="First-time buyer" sub="Never owned a home before, and this will be your only property" on={ftb} onClick={toggleFtb} />
                <ToggleRow label="I'll own another property after this" sub="A second home or buy-to-let. Adds the surcharge" on={additional} onClick={toggleAdditional} />
              </div>

              <div className="rounded-2xl px-5 py-4 mb-4" style={{ background: "rgba(37,99,235,0.06)", border: "0.5px solid rgba(37,99,235,0.14)" }}>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: "#2563EB" }}>Estimated stamp duty</p>
                <p className="text-[30px] font-black leading-none tabular-nums" style={{ color: P.textPrimary }}>{fmtGBP(sdlt)}</p>
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
        </div>,
        document.body,
      )}
    </>
  );
}

function Row({ label, value, pill }: { label: React.ReactNode; value: string; pill?: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${P.border}` }}>
      <p className="text-[14px]" style={{ color: P.textPrimary }}>{label}</p>
      <div className="flex items-center gap-2">
        {pill && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: P.successBg, color: P.success }}>{pill}</span>}
        <span className="text-[14px] font-semibold tabular-nums" style={{ color: P.textPrimary }}>{value}</span>
      </div>
    </div>
  );
}

function MoneyRow({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${P.border}` }}>
      <div>
        <p className="text-[14px]" style={{ color: P.textPrimary }}>{label}</p>
        {hint && <p className="text-[11px]" style={{ color: P.textMuted }}>{hint}</p>}
      </div>
      <div className="flex items-center rounded-xl px-3" style={{ border: `1px solid ${P.border}`, background: P.pageBg, maxWidth: 150 }}>
        <span className="text-[14px] font-semibold" style={{ color: P.textMuted }}>£</span>
        <input
          inputMode="numeric"
          value={value ? Number(value).toLocaleString("en-GB") : ""}
          onChange={(e) => onChange(digits(e.target.value))}
          placeholder="0"
          className="w-full py-2 pl-1 text-[14px] font-semibold bg-transparent text-right focus:outline-none"
          style={{ color: P.textPrimary }}
          aria-label={label}
        />
      </div>
    </div>
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
