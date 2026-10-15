"use client";

// Per-sale "which progressor handles this sale?" picker. Shown on the New Sale
// flow ONLY when the agency works with 2+ progression businesses and the agent
// has chosen to send the sale to a progressor. The chosen business is sent as
// progressionBusinessId and re-validated server-side against the agency's
// non-removed links. A single-progressor agency never sees this (the one
// progressor is resolved server-side as before).

import { Check } from "@phosphor-icons/react";
import { feeModelSummary, type ClientFeeModel } from "@/lib/progression/client-fees";
import { AgencyMeshMark } from "@/components/progression/AgencyMeshMark";

export type ProgressorOption = { businessId: string; name: string; feeModel: ClientFeeModel | null };

export function ProgressorPicker({
  progressors,
  selectedId,
  onSelect,
}: {
  progressors: ProgressorOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="ppk">
      <p className="ppk-label">Which progressor handles this sale?</p>
      <p className="ppk-sub">You work with more than one. Pick who takes this file, their fee applies to this sale.</p>
      <div className="ppk-grid">
        {progressors.map((p) => {
          const sel = p.businessId === selectedId;
          return (
            <button
              key={p.businessId}
              type="button"
              className={"ppk-card" + (sel ? " sel" : "")}
              onClick={() => onSelect(p.businessId)}
              aria-pressed={sel}
            >
              <span className="ppk-logo"><AgencyMeshMark name={p.name} size={40} /></span>
              <span className="ppk-main">
                <span className="ppk-name">{p.name}</span>
                <span className="ppk-fee">{feeModelSummary(p.feeModel)}</span>
              </span>
              <span className={"ppk-check" + (sel ? " on" : "")} aria-hidden>{sel && <Check size={13} weight="bold" />}</span>
            </button>
          );
        })}
      </div>
      <style>{`
        .ppk { margin-top: 16px; }
        .ppk-label { margin: 0; font-size: 13.5px; font-weight: 700; color: var(--nv2-text-primary, var(--agent-text-primary)); }
        .ppk-sub { margin: 3px 0 10px; font-size: 12px; color: var(--agent-text-muted); line-height: 1.45; }
        .ppk-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
        .ppk-card { display: flex; align-items: center; gap: 11px; text-align: left; cursor: pointer;
          padding: 11px 12px; border-radius: 13px; border: 1.5px solid var(--agent-border-default);
          background: var(--agent-surface, #fff); transition: border-color .15s, box-shadow .15s, background .15s; }
        .ppk-card:hover { border-color: var(--agent-coral); }
        .ppk-card.sel { border-color: transparent;
          background: linear-gradient(135deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.06));
          box-shadow: 0 0 0 1.5px var(--agent-coral-deep), 0 4px 14px -6px rgba(var(--agent-coral-rgb),0.5); }
        .ppk-logo { width: 40px; height: 40px; border-radius: 10px; overflow: hidden; flex: none; border: 0.5px solid var(--agent-border-subtle); }
        .ppk-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .ppk-name { font-size: 13.5px; font-weight: 680; color: var(--agent-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ppk-fee { font-size: 12px; color: var(--agent-text-muted); }
        .ppk-check { width: 20px; height: 20px; border-radius: 50%; flex: none; display: grid; place-items: center;
          border: 1.5px solid var(--agent-border-default); color: #fff; transition: background .15s, border-color .15s; }
        .ppk-check.on { background: linear-gradient(145deg, var(--agent-coral), var(--agent-coral-deep)); border-color: transparent; }
      `}</style>
    </div>
  );
}
