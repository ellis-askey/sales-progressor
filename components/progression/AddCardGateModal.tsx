"use client";

// The add-a-card gate: shown when a business tries to add OR bring in a sale with
// no card on file (once collection is live). Reuses the canonical BusinessCardCapture
// (Stripe) inside a centred modal. On a saved card the page refreshes, billing goes
// active, and they can add the sale.

import { createPortal } from "react-dom";
import { X, CreditCard } from "@phosphor-icons/react";
import { BusinessCardCapture } from "./BusinessCardCapture";

export function AddCardGateModal({
  publishableKey,
  onClose,
}: {
  publishableKey: string;
  onClose: () => void;
}) {
  return createPortal(
    <div className="acg-overlay" onClick={onClose}>
      <div className="acg" role="dialog" aria-modal="true" aria-label="Add a payment card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="acg-x" onClick={onClose} aria-label="Close"><X size={15} weight="bold" /></button>
        <div className="acg-ico" aria-hidden><CreditCard size={23} weight="regular" /></div>
        <h3 className="acg-t">Add a card to start adding sales</h3>
        <p className="acg-d">Add a payment card to activate your plan. You can add or remove sales and team members anytime.</p>

        <div className="acg-plan">
          <div className="acg-pr me"><span>Your plan, starting today</span><span>£59 / month</span></div>
          <div className="acg-pr"><span>Each sale you add</span><span>£5</span></div>
          <div className="acg-pr"><span>Each extra team member</span><span>£39 / month</span></div>
        </div>

        <div style={{ marginTop: 16 }}>
          <BusinessCardCapture publishableKey={publishableKey} />
        </div>
      </div>

      <style>{`
        .acg-overlay { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; padding: 24px; background: rgba(36,24,16,0.46); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); animation: acg-fade 160ms ease both; }
        .acg { position: relative; width: 100%; max-width: 460px; background: var(--agent-surface-elevated, #fff); border: 1px solid var(--agent-border-default, rgba(0,0,0,0.1)); border-radius: 22px; box-shadow: 0 30px 80px -24px rgba(40,24,16,0.5); padding: 24px 24px 20px; overflow: hidden; animation: acg-rise 220ms cubic-bezier(0.22,1,0.36,1) both; }
        .acg::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, transparent, var(--agent-coral), var(--agent-coral-deep), transparent); }
        .acg-x { position: absolute; top: 14px; right: 14px; width: 30px; height: 30px; border-radius: 9px; border: none; background: transparent; color: var(--agent-text-muted); cursor: pointer; display: grid; place-items: center; }
        .acg-x:hover { background: rgba(0,0,0,0.05); color: var(--agent-text-secondary); }
        .acg-ico { width: 46px; height: 46px; border-radius: 13px; display: grid; place-items: center; color: var(--agent-coral-deep); background: rgba(var(--agent-coral-rgb),0.12); margin-bottom: 15px; }
        .acg-t { margin: 0; font-size: 19px; font-weight: 800; letter-spacing: -0.015em; color: var(--agent-text-primary); }
        .acg-d { margin: 9px 0 0; font-size: 13.5px; line-height: 1.55; color: var(--agent-text-secondary); max-width: 44ch; }
        .acg-plan { margin: 17px 0 4px; border: 1px solid var(--agent-border-default, rgba(0,0,0,0.1)); border-radius: 13px; overflow: hidden; background: var(--agent-surface-2, rgba(0,0,0,0.02)); }
        .acg-pr { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-top: 1px solid var(--agent-border-subtle); font-size: 12.5px; color: var(--agent-text-secondary); }
        .acg-pr:first-child { border-top: none; }
        .acg-pr span:last-child { font-weight: 700; color: var(--agent-text-primary); font-variant-numeric: tabular-nums; }
        .acg-pr.me { background: rgba(var(--agent-coral-rgb),0.06); }
        .acg-pr.me span:last-child { color: var(--agent-coral-deep); }
        @keyframes acg-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes acg-rise { from { opacity: 0; transform: translateY(16px) scale(0.975); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .acg-overlay, .acg { animation: none; } }
      `}</style>
    </div>,
    document.body,
  );
}
