"use client";

// The add-a-card gate: shown when a business tries to add a sale with no card on
// file (once collection is live). Self-contained modal (own portal, theme-aware
// chrome: coral top line, close button, backdrop) so it can own an iOS-robust
// background scroll-lock and an enter/exit animation that the shared Modal
// primitive doesn't provide. Shows the plan, the pro-rated "Due today" figure +
// next payment date, then the Stripe card form (BusinessCardCapture). On a saved
// card the page refreshes, billing goes active, and the sale can be added.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { X } from "@phosphor-icons/react";
import { BusinessCardCapture } from "./BusinessCardCapture";

// Plain, client-safe shape mirrored from BusinessFirstChargePreview
// (lib/progression/business-billing.ts). Passed in from the server page.
export type CardGatePreview = {
  dueTodayPence: number;
  daysLeft: number;
  monthLabel: string;
  nextPaymentLabel: string;
  basePence: number;
  perSalePence: number;
  perMemberPence: number;
};

// Whole pounds show no decimals (£59); a fractional amount shows 2dp (£43.77).
function gbp(pence: number): string {
  const pounds = pence / 100;
  return Number.isInteger(pounds) ? `£${pounds}` : `£${pounds.toFixed(2)}`;
}

export function AddCardGateModal({
  publishableKey,
  onClose,
  preview = null,
}: {
  publishableKey: string;
  onClose: () => void;
  preview?: CardGatePreview | null;
}) {
  const { theme, isNight } = usePortalTheme();
  const [closing, setClosing] = useState(false);

  // Animate out, THEN tell the parent to unmount (via onAnimationEnd). Reduced
  // motion closes instantly.
  const requestClose = useCallback(() => {
    if (closing) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { onClose(); return; }
    setClosing(true);
  }, [closing, onClose]);

  // Escape closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") requestClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  // Background scroll-lock that holds on iOS (where body overflow:hidden is
  // ignored for touch). Pin the body in place and restore the scroll on close.
  useEffect(() => {
    const scrollY = window.scrollY;
    const b = document.body;
    const prev = { position: b.style.position, top: b.style.top, left: b.style.left, right: b.style.right, width: b.style.width, overflow: b.style.overflow };
    b.style.position = "fixed";
    b.style.top = `-${scrollY}px`;
    b.style.left = "0";
    b.style.right = "0";
    b.style.width = "100%";
    b.style.overflow = "hidden";
    return () => {
      b.style.position = prev.position;
      b.style.top = prev.top;
      b.style.left = prev.left;
      b.style.right = prev.right;
      b.style.width = prev.width;
      b.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  if (typeof window === "undefined") return null;

  const basePence = preview?.basePence ?? 5900;
  const perSalePence = preview?.perSalePence ?? 500;
  const perMemberPence = preview?.perMemberPence ?? 3900;

  const rowBase: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
    padding: "11px 14px", fontSize: 12.5, color: "var(--agent-text-secondary)",
    borderTop: "1px solid var(--agent-border-subtle)",
  };
  const amt: React.CSSProperties = { fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const per: React.CSSProperties = { fontWeight: 600, color: "var(--agent-text-muted)", fontSize: 11.5, fontStyle: "normal" };

  return createPortal(
    <div
      className={`acg-overlay nv2-night${closing ? " acg-closing" : ""}`}
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      onClick={requestClose}
    >
      <div
        className={`acg-card${closing ? " acg-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Add a payment card"
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(e) => { if (closing && e.target === e.currentTarget) onClose(); }}
        style={{ background: isNight ? "#161d2e" : "#fff" }}
      >
        <button type="button" className="acg-x" onClick={requestClose} aria-label="Close"><X size={16} weight="bold" /></button>

        <div className="acg-body">
          <span style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-coral-deep)", marginBottom: 7 }}>
            Activate your plan
          </span>
          <h3 style={{ margin: 0, paddingRight: 28, fontSize: 20, lineHeight: 1.2, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--agent-text-primary)" }}>
            Add a card to start adding sales
          </h3>
          <p style={{ margin: "9px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--agent-text-secondary)", maxWidth: "40ch" }}>
            Add a payment card to activate your plan. You can add or remove sales and team members at any time.
          </p>

          {/* Plan */}
          <div style={{ margin: "18px 0 0", border: "1px solid var(--agent-border-default)", borderRadius: 13, overflow: "hidden", background: "rgba(var(--agent-coral-rgb),0.02)" }}>
            <div style={{ ...rowBase, borderTop: "none", background: "rgba(var(--agent-coral-rgb),0.07)" }}>
              <span style={{ color: "var(--agent-text-primary)", fontWeight: 600 }}>Your plan</span>
              <span style={{ ...amt, color: "var(--agent-coral-deep)" }}>{gbp(basePence)} <i style={{ ...per, color: "var(--agent-coral)" }}>/ month</i></span>
            </div>
            <div style={rowBase}>
              <span>Each sale added</span>
              <span style={amt}>{gbp(perSalePence)}</span>
            </div>
            <div style={rowBase}>
              <span>Each extra team member</span>
              <span style={amt}>{gbp(perMemberPence)} <i style={per}>/ month</i></span>
            </div>
          </div>

          {/* Due today (pro-rata) */}
          {preview && (
            <div style={{ marginTop: 12, border: "1px solid rgba(var(--agent-coral-rgb),0.22)", borderRadius: 12, padding: "13px 15px", background: "rgba(var(--agent-coral-rgb),0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.01em" }}>Due today</span>
                <span style={{ fontSize: 19, fontWeight: 800, color: "var(--agent-coral-deep)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em", lineHeight: 1 }}>{gbp(preview.dueTodayPence)}</span>
              </div>
              <p style={{ margin: "7px 0 0", fontSize: 12, lineHeight: 1.6, color: "var(--agent-text-muted)" }}>
                Pro-rated for the remaining <b style={{ color: "var(--agent-text-secondary)", fontWeight: 700 }}>{preview.daysLeft} days</b> of {preview.monthLabel}.<br />
                Your next payment is {gbp(basePence)} on <b style={{ color: "var(--agent-text-secondary)", fontWeight: 700 }}>{preview.nextPaymentLabel}</b>, then monthly thereafter.
              </p>
            </div>
          )}

          {/* Card form */}
          <div style={{ marginTop: 18 }}>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--agent-text-secondary)", marginBottom: 9, letterSpacing: "0.01em" }}>Card details</span>
            {/* On a successful inline save, close the modal (+ refresh) so the gate
                clears and they get on with the sale, rather than sitting on a banner.
                3-D Secure redirects out and is finished on the billing page on return. */}
            <BusinessCardCapture publishableKey={publishableKey} onComplete={requestClose} />
          </div>

          {/* Trust */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 14, fontSize: 11, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--agent-success, #1F8A4A)" strokeWidth="1.8" style={{ flexShrink: 0, marginTop: 1 }}>
              <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <span>Securely processed by Stripe. We never see or store your card details.</span>
          </div>
        </div>
      </div>

      <style>{`
        .acg-overlay {
          position: fixed; inset: 0; z-index: 210; display: flex; align-items: center; justify-content: center;
          padding: 24px 16px;
          background: rgba(36,24,16,0.46);
          -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
          animation: acg-fade-in 160ms ease both;
          overscroll-behavior: contain;
        }
        .acg-overlay.acg-closing { animation: acg-fade-out 180ms ease both; }
        .acg-card {
          position: relative; width: 100%; max-width: 452px; max-height: calc(100dvh - 48px);
          display: flex; flex-direction: column; overflow: hidden;
          border-radius: 16px; border-top: 2px solid var(--agent-coral-deep, #FF6B4A);
          box-shadow: 0 24px 64px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.08);
          animation: acg-rise-in 240ms cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .acg-card.acg-closing { animation: acg-rise-out 180ms ease both; }
        .acg-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 24px 24px 20px; }
        .acg-x {
          position: absolute; top: 13px; right: 13px; width: 32px; height: 32px; z-index: 1;
          display: inline-flex; align-items: center; justify-content: center;
          border: none; border-radius: 9px; background: transparent; color: var(--agent-text-muted); cursor: pointer;
          transition: background 150ms ease, color 150ms ease;
        }
        .acg-x:hover { background: rgba(128,128,128,0.16); color: var(--agent-text-secondary); }
        @keyframes acg-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes acg-fade-out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes acg-rise-in { from { opacity: 0; transform: translateY(14px) scale(0.985); } to { opacity: 1; transform: none; } }
        @keyframes acg-rise-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(10px) scale(0.985); } }
        @media (prefers-reduced-motion: reduce) { .acg-overlay, .acg-card { animation: none; } }
      `}</style>
    </div>,
    document.body,
  );
}
