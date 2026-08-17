"use client";

// Buyer costs, switched on exchange (one or the other, never both):
//  - Before exchange: the standalone stamp-duty estimate card. Tapping opens the
//    calculator to refine it. Nothing else — the real deposit/mortgage figures
//    aren't settled yet.
//  - After exchange: "Your costs". Stamp duty is confirm-first — we don't show a
//    firm figure until the buyer tells us whether they'll own another property
//    (the surcharge question), because assuming standard rates can be badly
//    wrong. First-time-buyer relief is a separate toggle at the foot of the card,
//    open to every buyer (cash included). Deposit + mortgage + any other funds
//    already sent give the funds still to send at completion (which includes the
//    stamp duty, shown with a breakdown). Everything persists; a "funds sent"
//    flag closes the loop. Fees still come from the solicitor's completion
//    statement, so it's an estimate, not a precise balance.

import { useState } from "react";
import { createPortal } from "react-dom";
import { P } from "./portal-ui";
import { PortalGlassCard } from "./PortalGlassCard";
import { PortalMoney } from "./PortalMoney";
import { calculateSdlt } from "@/lib/sdlt";
import { portalSaveCostsAction } from "@/app/actions/portal";

// One info-blue for every stamp-duty figure/affordance (reads on light + dark).
const INFO = "#3B82F6";
// First-time-buyer relief only applies at or below this price.
const FTB_CAP = 500_000;

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
  savedOtherFunds: number | null;
  savedFtb: boolean;
  // null = the buyer hasn't confirmed their stamp-duty situation yet.
  savedAdditional: boolean | null;
  savedFundsSent: boolean;
  token: string;
};

export function PortalCostsCard({
  priceGBP, hasExchanged, isCash, savedDeposit, savedMortgage, savedOtherFunds, savedFtb, savedAdditional, savedFundsSent, token,
}: Props) {
  const [open, setOpen] = useState(false);
  const [ftb, setFtb] = useState(savedFtb);
  const [additional, setAdditional] = useState<boolean | null>(savedAdditional);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showFundsParts, setShowFundsParts] = useState(false);

  const [depositStr, setDepositStr] = useState(String(savedDeposit ?? Math.round(priceGBP * 0.1)));
  const [mortgageStr, setMortgageStr] = useState(savedMortgage != null ? String(savedMortgage) : "");
  const [otherFundsStr, setOtherFundsStr] = useState(savedOtherFunds != null ? String(savedOtherFunds) : "");
  const [fundsSent, setFundsSent] = useState(savedFundsSent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const ftbEligible = priceGBP <= FTB_CAP;
  // The buyer has told us enough to work out stamp duty once they've answered
  // the surcharge question, or turned on first-time-buyer (which implies a
  // single property, so the answer is settled either way).
  const sdltConfirmed = additional !== null || ftb;

  const starting = calculateSdlt({ price: priceGBP, firstTimeBuyer: false, additionalProperty: false });
  const result = calculateSdlt({ price: priceGBP, firstTimeBuyer: ftb, additionalProperty: additional === true });
  const sdlt = result.total;

  const depositNum = Number(depositStr) || 0;
  const mortgageNum = isCash ? 0 : (Number(mortgageStr) || 0);
  const otherFundsNum = Number(otherFundsStr) || 0;
  // The completion amount owed = balance of the price + stamp duty. Any funds
  // already sent come off the WHOLE thing (so money put toward the stamp duty
  // reduces the total, not just the price balance). Kept as parts for the
  // breakdown so the stamp-duty share is shown, not silently folded in.
  const balanceOfPrice = Math.max(0, priceGBP - depositNum - mortgageNum);
  const fundsToSend = Math.max(0, balanceOfPrice + sdlt - otherFundsNum);

  const depositFilled = depositStr.trim() !== "" && depositNum > 0;
  const mortgageFilled = isCash || (mortgageStr.trim() !== "" && mortgageNum > 0);
  // Every applicable input plus a confirmed stamp-duty situation before we show
  // a completion figure — guessing any of them would mislead.
  const showFunds = depositFilled && mortgageFilled && sdltConfirmed;
  const missingLabel = !depositFilled ? "your deposit" : !mortgageFilled ? "your mortgage amount" : "your stamp duty";

  const dirty =
    depositNum !== (savedDeposit ?? Math.round(priceGBP * 0.1)) ||
    (!isCash && mortgageNum !== (savedMortgage ?? 0)) ||
    otherFundsNum !== (savedOtherFunds ?? 0) ||
    ftb !== savedFtb ||
    additional !== savedAdditional;

  // Confirm the surcharge question (from the sheet). "Yes, another property"
  // rules out first-time-buyer, so clear it.
  function confirmAdditional(v: boolean) {
    setSaved(false);
    setAdditional(v);
    if (v) setFtb(false);
  }
  // First-time buyer implies a single property, so it settles the surcharge too.
  function toggleFtb() {
    if (!ftbEligible) return;
    setSaved(false);
    setFtb((v) => {
      const n = !v;
      if (n) setAdditional(false);
      return n;
    });
  }

  // One write path for everything on the card. The Save button persists the
  // figures; the "funds sent" affordance calls it straight away with the new flag.
  async function persist(override?: { fundsSent?: boolean }) {
    const sentVal = override?.fundsSent ?? fundsSent;
    setSaving(true); setSaved(false);
    try {
      const res = await portalSaveCostsAction({
        token,
        depositGBP: depositNum,
        mortgageGBP: isCash ? null : mortgageNum,
        otherFundsGBP: otherFundsNum > 0 ? otherFundsNum : null,
        firstTimeBuyer: ftb,
        additionalProperty: additional,
        completionFundsSent: sentVal,
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }
  function markFundsSent(next: boolean) {
    setFundsSent(next);
    void persist({ fundsSent: next });
  }

  return (
    <>
      {hasExchanged ? (
        <PortalGlassCard glassId="your-costs" label="Your costs" className="overflow-hidden">
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${P.border}` }}>
            <p className="text-[13px] font-bold" style={{ color: P.textPrimary }}>Your costs</p>
          </div>

          <Row label="Purchase price" value={fmtGBP(priceGBP)} />
          <MoneyRow
            label="Deposit paid at exchange"
            hint="The part you paid when contracts exchanged"
            value={depositStr}
            onChange={(v) => { setDepositStr(v); setSaved(false); }}
          />
          {!isCash && (
            <MoneyRow label="Mortgage amount" hint="From your mortgage offer" value={mortgageStr} onChange={(v) => { setMortgageStr(v); setSaved(false); }} />
          )}
          <MoneyRow
            label="Other funds already sent"
            hint="Optional. Anything you've sent beyond the deposit"
            value={otherFundsStr}
            onChange={(v) => { setOtherFundsStr(v); setSaved(false); }}
          />

          {/* Stamp duty — confirm-first. Until they answer the surcharge question
              (or turn on first-time buyer) we don't show a firm figure. */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pbtn pbtn-press w-full flex items-center justify-between px-5 py-3.5 text-left"
            style={{ borderBottom: `1px solid ${P.border}`, background: "transparent" }}
          >
            <div>
              <p className="text-[14px]" style={{ color: P.textPrimary }}>Stamp duty</p>
              <p className="text-[11px]" style={{ color: sdltConfirmed ? P.textMuted : INFO }}>
                {sdltConfirmed ? (ftb ? "First-time buyer rate. Tap to adjust" : additional ? "Includes the second-property surcharge. Tap to adjust" : "Tap to adjust") : "Tap to confirm your situation"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {sdltConfirmed ? (
                <span className="text-[14px] font-semibold tabular-nums" style={{ color: INFO }}>~<PortalMoney>{fmtGBP(sdlt)}</PortalMoney></span>
              ) : (
                <span className="text-[13px] font-semibold" style={{ color: INFO }}>Confirm</span>
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INFO} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </button>

          {fundsSent ? (
            /* Closed the loop — they've told us the money's on its way. */
            <div className="flex items-center justify-between px-5 py-4" style={{ background: P.successBg }}>
              <div>
                <p className="text-[14px] font-bold" style={{ color: P.success }}>Funds sent</p>
                <p className="text-[11px]" style={{ color: P.textMuted }}>You&apos;ve told us the completion funds are on their way.</p>
              </div>
              <button type="button" onClick={() => markFundsSent(false)} disabled={saving} className="pbtn-press text-[12px] font-semibold" style={{ color: P.textMuted }}>
                Undo
              </button>
            </div>
          ) : showFunds ? (
            <div className="px-5 py-4" style={{ background: P.primaryBg }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-bold" style={{ color: P.textPrimary }}>Funds still to send</p>
                  <p className="text-[11px]" style={{ color: P.textMuted }}>Includes stamp duty. Estimated, before fees</p>
                </div>
                <span className="text-[20px] font-black tabular-nums" style={{ color: P.primary }}>~<PortalMoney>{fmtGBP(fundsToSend)}</PortalMoney></span>
              </div>

              <button
                type="button"
                onClick={() => setShowFundsParts((v) => !v)}
                className="pbtn-press mt-2 flex items-center gap-1.5 text-[12px] font-semibold"
                style={{ color: P.primary }}
              >
                {showFundsParts ? "Hide the breakdown" : "What's this made of?"}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showFundsParts ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showFundsParts && (
                <div className="mt-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${P.border}`, background: P.cardBg }}>
                  <BreakdownRow label="Balance of the purchase price" value={fmtGBP(balanceOfPrice)} />
                  <BreakdownRow label="Stamp duty" value={fmtGBP(sdlt)} />
                  {otherFundsNum > 0 && <BreakdownRow label="Less other funds already sent" value={"−" + fmtGBP(otherFundsNum)} />}
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: P.pageBg }}>
                    <span className="text-[13px] font-bold" style={{ color: P.textPrimary }}>Total to send</span>
                    <span className="text-[13px] font-bold tabular-nums" style={{ color: P.textPrimary }}><PortalMoney>{fmtGBP(fundsToSend)}</PortalMoney></span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => markFundsSent(true)}
                disabled={saving}
                className="pbtn pbtn-press mt-3 w-full py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-40"
                style={{ background: P.primary }}
              >
                {saving ? "Saving…" : "I've sent these funds"}
              </button>
            </div>
          ) : (
            <div className="px-5 py-4" style={{ background: P.pageBg }}>
              <p className="text-[13px]" style={{ color: P.textMuted }}>
                Add {missingLabel} to see the funds still to send.
              </p>
              {depositFilled && mortgageFilled && !sdltConfirmed && (
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="pbtn pbtn-press mt-2 text-[13px] font-bold"
                  style={{ color: INFO }}
                >
                  Confirm your stamp duty →
                </button>
              )}
            </div>
          )}

          {/* First-time buyer — foot of the card, open to every buyer. */}
          <SwitchRow
            label="First-time buyer"
            hint={ftbEligible ? "No stamp duty on the first £300,000" : "Only applies on purchases up to £500,000"}
            on={ftb}
            disabled={!ftbEligible}
            onToggle={toggleFtb}
          />

          <div className="px-5 py-3.5">
            <p className="text-[12px] leading-relaxed mb-3" style={{ color: P.textMuted }}>
              Plus your solicitor&apos;s fees and any other costs. They&apos;ll confirm the exact balance to transfer on your completion statement.
            </p>
            {saved && !dirty ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: P.success }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Figures saved
              </span>
            ) : (
              <button
                type="button"
                onClick={() => persist()}
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
            background: "linear-gradient(160deg, rgba(59,130,246,0.09), rgba(59,130,246,0.02))",
            border: "0.5px solid rgba(59,130,246,0.14)",
            boxShadow: P.shadowSm,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 52, height: 52, borderRadius: 14, background: P.cardBg, color: INFO, boxShadow: "0 2px 8px rgba(59,130,246,0.20)" }}
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
              About <b style={{ color: INFO }}><PortalMoney>{fmtGBP(starting.total)}</PortalMoney></b> on <PortalMoney>{fmtGBP(priceGBP)}</PortalMoney>. Assumes standard rates. Tap to adjust.
            </p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INFO} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Stamp-duty sheet — portalled to <body>. Post-exchange it's the confirm
          flow (surcharge question); pre-exchange it's the full estimate calculator. */}
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setOpen(false)}>
          <div className="portal-sheet-backdrop absolute inset-0" style={{ background: "rgba(15,23,42,0.45)" }} />
          <div
            className="portal-sheet relative w-full max-w-lg mx-auto"
            style={{
              background: P.cardBg,
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
              <p className="text-[18px] font-semibold leading-snug mb-1" style={{ color: P.textPrimary }}>
                {hasExchanged ? "Your stamp duty" : "Stamp duty estimate"}
              </p>
              <p className="text-[13px] mb-4" style={{ color: P.textMuted }}>On <PortalMoney>{fmtGBP(priceGBP)}</PortalMoney></p>

              {hasExchanged ? (
                /* Confirm flow — one question drives the surcharge. */
                <div className="flex flex-col gap-2 mb-5">
                  <p className="text-[14px] font-semibold mb-1" style={{ color: P.textPrimary }}>
                    After you complete, will you own more than one property?
                  </p>
                  <OptionButton
                    label="No, this will be my only home"
                    sub="Standard rates"
                    selected={additional === false}
                    onClick={() => confirmAdditional(false)}
                  />
                  <OptionButton
                    label="Yes, I'll own another property"
                    sub="A second home or buy-to-let. Adds the 5% surcharge"
                    selected={additional === true}
                    onClick={() => confirmAdditional(true)}
                  />
                  <p className="text-[12px] mt-1 leading-snug" style={{ color: P.textMuted }}>
                    First-time buyer? Use the toggle at the foot of the card. That takes the stamp duty off your first £300,000.
                  </p>
                </div>
              ) : (
                /* Pre-exchange estimate — full what-if toggles. */
                <div className="flex flex-col gap-2 mb-5">
                  <ToggleRow label="First-time buyer" sub="Never owned a home before, and this will be your only property" on={ftb} onClick={toggleFtb} />
                  <ToggleRow label="I'll own another property after this" sub="A second home or buy-to-let. Adds the surcharge" on={additional === true} onClick={() => confirmAdditional(additional !== true)} />
                </div>
              )}

              {(!hasExchanged || sdltConfirmed) && (
                <>
                  <div className="rounded-2xl px-5 py-4 mb-4" style={{ background: "rgba(59,130,246,0.06)", border: "0.5px solid rgba(59,130,246,0.14)" }}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: INFO }}>Estimated stamp duty</p>
                    <p className="text-[30px] font-black leading-none tabular-nums" style={{ color: P.textPrimary }}><PortalMoney>{fmtGBP(sdlt)}</PortalMoney></p>
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
                            <span className="font-semibold tabular-nums" style={{ color: P.textPrimary }}><PortalMoney>{fmtGBP(b.tax)}</PortalMoney></span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}

              <p className="text-[11.5px] leading-relaxed" style={{ color: P.textMuted }}>
                This is an estimate using Stamp Duty Land Tax rates for England and Northern Ireland. Rates differ in Scotland (LBTT) and Wales (LTT). Your solicitor will confirm the exact figure for your purchase.
              </p>

              {hasExchanged && sdltConfirmed && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="pbtn pbtn-press mt-4 w-full py-3 rounded-2xl text-[14px] font-bold text-white"
                  style={{ background: P.primary }}
                >
                  Done
                </button>
              )}
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
        <span className="text-[14px] font-semibold tabular-nums" style={{ color: P.textPrimary }}><PortalMoney>{value}</PortalMoney></span>
      </div>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${P.border}` }}>
      <span className="text-[13px]" style={{ color: P.textSecondary }}>{label}</span>
      <span className="text-[13px] font-semibold tabular-nums" style={{ color: P.textPrimary }}><PortalMoney>{value}</PortalMoney></span>
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

// Inline switch row that matches the card's other rows (divider, px-5).
function SwitchRow({ label, hint, on, disabled, onToggle }: { label: string; hint?: string; on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3" style={{ borderBottom: `1px solid ${P.border}`, opacity: disabled ? 0.55 : 1 }}>
      <div className="min-w-0">
        <p className="text-[14px]" style={{ color: P.textPrimary }}>{label}</p>
        {hint && <p className="text-[11px]" style={{ color: P.textMuted }}>{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        style={{ position: "relative", width: 44, height: 26, borderRadius: 999, background: on ? P.primary : "rgba(139,145,163,0.30)", border: "none", cursor: disabled ? "not-allowed" : "pointer", transition: "background 150ms ease", flexShrink: 0 }}
      >
        <span aria-hidden style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", boxShadow: "0 1px 3px rgba(15,23,42,0.2)", transition: "left 180ms cubic-bezier(0.16, 1, 0.3, 1)" }} />
      </button>
    </div>
  );
}

// Selectable option card for the confirm sheet.
function OptionButton({ label, sub, selected, onClick }: { label: string; sub: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 text-left w-full rounded-xl px-4 py-3"
      style={{ border: `1px solid ${selected ? P.primary : P.border}`, borderWidth: selected ? 2 : 1, background: selected ? P.primaryBg : P.cardBg }}
      aria-pressed={selected}
    >
      <span className="flex items-center justify-center flex-shrink-0 mt-0.5" style={{ width: 20, height: 20, borderRadius: "50%", background: selected ? P.primary : "transparent", border: selected ? "none" : `1.5px solid ${P.border}` }}>
        {selected && (
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

function ToggleRow({ label, sub, on, onClick }: { label: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 text-left w-full rounded-xl px-4 py-3"
      style={{ border: `1px solid ${on ? P.primary : P.border}`, borderWidth: on ? 2 : 1, background: on ? P.primaryBg : P.cardBg }}
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
