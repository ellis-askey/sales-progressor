"use client";

// "Bring in an existing sale" — a progression business importing a sale already
// underway for one of its clients. Sale basics + "where is it up to?" (the same
// reconciliation picker agents use when claiming an in-progress sale). No £5 at
// add; it only accrues if the sale reaches exchange. Calls migrateSaleAction.

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Clock } from "@phosphor-icons/react";
import type { Tenure, PurchaseType } from "@prisma/client";
import { useAgentToast } from "@/components/agent/AgentToaster";
import {
  ReconcileMilestonePicker,
  type ReconciliationState,
  type MilestoneDefinitionLite,
} from "@/components/milestones/ReconcileMilestonePicker";
import { migrateSaleAction } from "@/app/actions/progression-migration";
import "@/app/claim/styles/claim-flow.css";

export function BringInSaleDrawer({
  agencyId,
  milestoneDefinitions,
  hoursLeft,
  onClose,
}: {
  agencyId: string;
  milestoneDefinitions: MilestoneDefinitionLite[];
  hoursLeft: number;
  onClose: () => void;
}) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [tenure, setTenure] = useState<Tenure>("freehold");
  const [purchaseType, setPurchaseType] = useState<PurchaseType>("mortgage");
  const [recon, setRecon] = useState<ReconciliationState>({});
  const [submitting, setSubmitting] = useState(false);

  function onPrice(v: string) {
    const digits = v.replace(/[^\d]/g, "").slice(0, 9);
    setPriceStr(digits ? Number(digits).toLocaleString("en-GB") : "");
  }

  async function submit() {
    if (!address.trim()) { toast.error("Enter the property address."); return; }
    setSubmitting(true);
    const completions = Object.entries(recon)
      .filter(([, v]) => v.ticked)
      .map(([milestoneDefinitionId, v]) => ({ milestoneDefinitionId, eventDate: v.eventDate || null }));
    const res = await migrateSaleAction({
      clientAgencyId: agencyId,
      propertyAddress: address.trim(),
      purchasePrice: Number(priceStr.replace(/[^\d]/g, "")) || null,
      tenure,
      purchaseType,
      completions,
    }).catch(() => null);
    setSubmitting(false);
    if (res?.ok) {
      toast.success("Sale brought in", { description: "It won't be charged the £5 unless it reaches exchange." });
      router.refresh();
      onClose();
      return;
    }
    toast.error(res?.error ?? "We couldn't bring in that sale. Please try again.");
    if (res && !res.ok && res.windowClosed) onClose();
  }

  const PURCHASE_OPTS: { value: PurchaseType; label: string }[] = [
    { value: "mortgage", label: "Mortgage" },
    { value: "cash_buyer", label: "Cash buyer" },
    { value: "cash_from_proceeds", label: "From sale proceeds" },
  ];

  return createPortal(
    <div className="bis-wrap">
      <div className="bis-scrim" onClick={() => { if (!submitting) onClose(); }} />
      <div className="bis" role="dialog" aria-modal="true" aria-label="Bring in an existing sale">
        <div className="bis-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bis-ht">Bring in an existing sale</div>
            <div className="bis-hs">For a sale already underway. Tell us the details and where it&rsquo;s up to.</div>
          </div>
          <button type="button" className="bis-x" onClick={onClose} aria-label="Close"><X size={14} weight="bold" /></button>
        </div>

        <div className="bis-body">
          <div className="bis-note">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5 7.6-5.9 6a1 1 0 0 1-1.44 0L7 12.5A1 1 0 0 1 8.44 11l1.93 2 5.19-5.3A1 1 0 0 1 17 9.6Z"/></svg>
            <span><span className="t">No charge for bringing this in.</span><span className="d">Sales already underway aren&rsquo;t charged the £5. We only add it if this sale reaches exchange.</span></span>
          </div>

          <div className="bis-win">
            <span className="bis-pill"><Clock size={12} weight="bold" /><span className="full">Migration open &middot; {hoursLeft} hours left</span><span className="short">{hoursLeft}h left</span></span>
            <span className="bis-wintext">Open for 48 hours after your first. Need to bring in more later? Contact support.</span>
          </div>

          <label className="bis-fl">Property address</label>
          <input className="bis-in" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 23 Rowan Gardens, Harlow, CM17 9PH" autoFocus />

          <label className="bis-fl">Price (optional)</label>
          <div className="bis-price"><span>£</span><input value={priceStr} onChange={(e) => onPrice(e.target.value)} inputMode="numeric" placeholder="425,000" /></div>

          <label className="bis-fl">Tenure</label>
          <div className="bis-seg">
            <button type="button" className={tenure === "freehold" ? "on" : ""} onClick={() => setTenure("freehold")}>Freehold</button>
            <button type="button" className={tenure === "leasehold" ? "on" : ""} onClick={() => setTenure("leasehold")}>Leasehold</button>
          </div>

          <label className="bis-fl">How they&rsquo;re buying</label>
          <div className="bis-seg">
            {PURCHASE_OPTS.map((o) => (
              <button key={o.value} type="button" className={purchaseType === o.value ? "on" : ""} onClick={() => setPurchaseType(o.value)}>{o.label}</button>
            ))}
          </div>

          <div className="bis-divider" />
          <p className="bis-stage-h">Where is it up to?</p>
          <p className="bis-stage-s">Tick everything that&rsquo;s already happened. Add a date to any you know. Later steps unlock as you tick the ones before them.</p>

          <ReconcileMilestonePicker
            milestoneDefinitions={milestoneDefinitions}
            tenure={tenure}
            purchaseType={purchaseType}
            state={recon}
            onChange={setRecon}
            layout="wide"
          />
        </div>

        <div className="bis-foot">
          <button type="button" className="agent-btn agent-btn-neutral agent-btn-md" style={{ width: 96 }} onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="button" className="agent-btn agent-btn-primary agent-btn-md" style={{ flex: 1 }} onClick={submit} disabled={submitting}>{submitting ? "Bringing in…" : "Bring in sale"}</button>
        </div>
      </div>

      <style>{`
        .bis-wrap { position: fixed; inset: 0; z-index: 200; display: flex; justify-content: flex-end; }
        .bis-scrim { position: absolute; inset: 0; background: rgba(36,24,16,0.42); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); }
        .bis { position: relative; z-index: 1; height: 100%; width: 480px; max-width: 100vw; background: var(--agent-surface-elevated, #fff); border-left: 1px solid var(--agent-border-default, rgba(0,0,0,0.1)); box-shadow: -8px 0 40px -12px rgba(40,24,16,0.4); display: flex; flex-direction: column; overflow: hidden; animation: bis-in 260ms cubic-bezier(0.25,0,0,1) both; }
        @keyframes bis-in { from { transform: translateX(30px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .bis { animation: none; } }
        .bis-head { background: linear-gradient(120deg, var(--agent-coral), var(--agent-coral-deep)); color: #fff; padding: 18px 22px; display: flex; align-items: flex-start; gap: 12px; flex-shrink: 0; }
        .bis-ht { font-size: 16px; font-weight: 800; letter-spacing: -0.01em; }
        .bis-hs { font-size: 12.5px; opacity: 0.9; margin-top: 3px; line-height: 1.45; }
        .bis-x { margin-left: auto; flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: #fff; background: rgba(255,255,255,0.16); border: none; cursor: pointer; }
        .bis-x:hover { background: rgba(255,255,255,0.26); }
        .bis-body { flex: 1; overflow-y: auto; padding: 20px 22px 22px; }
        .bis-foot { flex-shrink: 0; display: flex; gap: 11px; padding: 13px 22px 18px; border-top: 1px solid var(--agent-border-subtle); }
        .bis-note { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 13px; margin-bottom: 14px; background: rgba(31,138,74,0.10); border: 1px solid rgba(31,138,74,0.30); color: var(--agent-success, #1F8A4A); }
        .bis-note svg { flex-shrink: 0; margin-top: 1px; }
        .bis-note .t { display: block; font-size: 12.5px; font-weight: 700; color: var(--agent-text-primary); }
        .bis-note .d { display: block; font-size: 12px; color: var(--agent-text-secondary); margin-top: 2px; line-height: 1.5; }
        .bis-win { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
        .bis-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.02em; color: var(--agent-coral-deep); background: rgba(var(--agent-coral-rgb),0.12); border: 1px solid rgba(var(--agent-coral-rgb),0.28); border-radius: 999px; padding: 4px 11px; flex-shrink: 0; }
        .bis-pill .short { display: none; }
        .bis-wintext { font-size: 11.5px; color: var(--agent-text-muted); line-height: 1.45; }
        .bis-fl { display: block; font-size: 12px; font-weight: 700; color: var(--agent-text-secondary); margin: 0 0 7px; }
        .bis-in { width: 100%; border: 1px solid var(--agent-border-default, rgba(0,0,0,0.12)); border-radius: 10px; background: var(--agent-surface, #fff); padding: 10px 12px; font-size: 13.5px; color: var(--agent-text-primary); margin-bottom: 14px; }
        .bis-in:focus { outline: none; border-color: var(--agent-coral-deep); }
        .bis-price { display: flex; align-items: center; gap: 4px; border: 1px solid var(--agent-border-default, rgba(0,0,0,0.12)); border-radius: 10px; background: var(--agent-surface, #fff); padding: 0 12px; margin-bottom: 14px; }
        .bis-price:focus-within { border-color: var(--agent-coral-deep); }
        .bis-price span { color: var(--agent-text-muted); font-size: 13.5px; }
        .bis-price input { flex: 1; border: none; outline: none; background: transparent; padding: 10px 2px; font-size: 13.5px; color: var(--agent-text-primary); font-variant-numeric: tabular-nums; }
        .bis-seg { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
        .bis-seg button { flex: 1; min-width: fit-content; cursor: pointer; font: 650 12.5px/1 inherit; color: var(--agent-text-secondary); background: var(--agent-surface, #fff); border: 1px solid var(--agent-border-default, rgba(0,0,0,0.12)); border-radius: 9px; padding: 9px 10px; transition: all .14s; }
        .bis-seg button.on { color: var(--agent-coral-deep); background: rgba(var(--agent-coral-rgb),0.08); border-color: rgba(var(--agent-coral-rgb),0.4); }
        .bis-divider { height: 1px; background: var(--agent-border-subtle); margin: 20px 0 16px; }
        .bis-stage-h { font-size: 13.5px; font-weight: 750; color: var(--agent-text-primary); margin: 0 0 3px; }
        .bis-stage-s { font-size: 12px; color: var(--agent-text-secondary); margin: 0 0 14px; line-height: 1.5; }
        @media (max-width: 520px) { .bis { width: 100vw; } .bis-pill .full { display: none; } .bis-pill .short { display: inline; } }
      `}</style>
    </div>,
    document.body,
  );
}
