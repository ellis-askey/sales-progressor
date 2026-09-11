"use client";

// Shared impact preview for a purchase-type / tenure change. Shows which
// milestones get skipped (auto marked not-required) and which come back, plus
// a Current -> After completion-percent card. Extracted verbatim from
// EditSaleDetailsDrawer so the drawer and the inline hero editor render the
// exact same preview from one source (Law 14). The wrapper/border is the
// caller's job — this renders just the lists + percent card.

import { useState } from "react";
import type { SaleDetailsDelta, SaleDetailsDeltaItem } from "@/app/actions/transactions";
import { Pill } from "@/components/ui/Pill";

function DeltaList({ label, items, color, showSide }: { label: string; items: SaleDetailsDeltaItem[]; color: "red" | "green"; showSide: boolean }) {
  const [expanded, setExpanded] = useState(items.length <= 5);
  if (items.length === 0) return null;
  const shown = expanded ? items : items.slice(0, 5);
  const c = color === "red"
    ? { border: "border-red-100 divide-red-50", side: "bg-red-50 text-red-700 border-red-100" }
    : { border: "border-green-100 divide-green-50", side: "bg-green-50 text-green-700 border-green-100" };
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</p>
      <div className={`rounded-lg border divide-y overflow-hidden ${c.border}`}>
        {shown.map((item) => (
          <div key={item.id} className="px-3 py-2 flex items-center gap-2">
            <span className="flex-1 text-sm text-slate-700 leading-snug">{item.name}</span>
            {item.wasComplete && (
              <Pill glass tone="warning" size="sm" className="flex-shrink-0">Was complete</Pill>
            )}
            {showSide && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${c.side}`}>
                {item.side === "vendor" ? "Seller" : "Buyer"}
              </span>
            )}
          </div>
        ))}
      </div>
      {items.length > 5 && (
        <button onClick={() => setExpanded((v) => !v)} className="text-xs agent-link-primary mt-1">
          {expanded ? "Show fewer" : `Show ${items.length - 5} more`}
        </button>
      )}
    </div>
  );
}

export function SaleDetailsDeltaPreview({ delta }: { delta: SaleDetailsDelta }) {
  const allItems = [...delta.becomingNr, ...delta.becomingRequired];
  const hasStepChanges = allItems.length > 0;
  // The Seller/Buyer tag only earns its space when the change spans both
  // sides (e.g. a tenure change). When every affected step is one side —
  // like a purchase-type change, all buyer finances — it's just noise.
  const showSide = new Set(allItems.map((i) => i.side)).size > 1;
  const down = delta.projectedPercent < delta.currentPercent;
  const up = delta.projectedPercent > delta.currentPercent;
  return (
    <>
      <DeltaList label="These steps will be skipped" items={delta.becomingNr} color="red" showSide={showSide} />
      <DeltaList label="These steps will be re-activated" items={delta.becomingRequired} color="green" showSide={showSide} />
      {hasStepChanges && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500 mb-1.5">Sale progress</p>
          <div className="flex items-center gap-3">
            <div>
              <span className="block text-2xl font-bold text-slate-800 leading-none">{delta.currentPercent}%</span>
              <span className="block text-[11px] text-slate-400 mt-1">{delta.currentRemaining} left</span>
            </div>
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <div>
              <span
                className="block text-2xl font-bold leading-none"
                style={{ color: down ? "var(--agent-coral-deep)" : up ? "#059669" : "#334155" }}
              >
                {delta.projectedPercent}%
              </span>
              <span className="block text-[11px] text-slate-400 mt-1">{delta.projectedRemaining} left</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
