"use client";
// components/transaction/EditSaleDetailsModal.tsx

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { PurchaseType, Tenure } from "@prisma/client";
import { getSaleDetailsDelta, confirmSaleDetailsAction } from "@/app/actions/transactions";
import type { SaleDetailsDelta, SaleDetailsDeltaItem } from "@/app/actions/transactions";

const PURCHASE_TYPE_LABELS: Record<PurchaseType, string> = {
  mortgage: "Mortgage",
  cash_buyer: "Cash buyer",
  cash_from_proceeds: "Cash from Proceeds",
};
const TENURE_LABELS: Record<Tenure, string> = {
  leasehold: "Leasehold",
  freehold: "Freehold",
};

type Props = {
  transactionId: string;
  currentPurchaseType: PurchaseType;
  currentTenure: Tenure;
  onClose: () => void;
};

function DeltaList({ label, items, color }: { label: string; items: SaleDetailsDeltaItem[]; color: "red" | "green" }) {
  const [expanded, setExpanded] = useState(items.length <= 5);
  if (items.length === 0) return null;
  const shown = expanded ? items : items.slice(0, 5);
  const colorMap = {
    red:   { border: "border-red-100 divide-red-50",   side: "bg-red-50 text-red-700 border-red-100" },
    green: { border: "border-green-100 divide-green-50", side: "bg-green-50 text-green-700 border-green-100" },
  };
  const c = colorMap[color];
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</p>
      <div className={`rounded-lg border divide-y overflow-hidden ${c.border}`}>
        {shown.map((item) => (
          <div key={item.id} className="px-3 py-2 flex items-center gap-2">
            <span className="flex-1 text-sm text-slate-700 leading-snug">{item.name}</span>
            {item.wasComplete && (
              <span className="text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-100 rounded px-1.5 py-0.5 flex-shrink-0">
                was complete
              </span>
            )}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${c.side}`}>
              {item.side === "vendor" ? "Seller" : "Buyer"}
            </span>
          </div>
        ))}
      </div>
      {items.length > 5 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-blue-500 hover:text-blue-600 mt-1"
        >
          {expanded ? "Show fewer" : `Show ${items.length - 5} more`}
        </button>
      )}
    </div>
  );
}

export function EditSaleDetailsModal({ transactionId, currentPurchaseType, currentTenure, onClose }: Props) {
  const [, startTransition] = useTransition();

  // Form state
  const [purchaseType, setPurchaseType] = useState<PurchaseType>(currentPurchaseType);
  const [tenure, setTenure] = useState<Tenure>(currentTenure);

  // Two-step: form → preview
  const [delta, setDelta] = useState<SaleDetailsDelta | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    setError(null);
    setLoading(true);
    try {
      const result = await getSaleDetailsDelta({ transactionId, newPurchaseType: purchaseType, newTenure: tenure });
      if (result.noChange) {
        onClose();
        return;
      }
      setDelta(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    setSaving(true);
    startTransition(async () => {
      try {
        await confirmSaleDetailsAction({ transactionId, newPurchaseType: purchaseType, newTenure: tenure });
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Could not update sale details");
        setSaving(false);
      }
    });
  }

  const changedPurchaseType = purchaseType !== currentPurchaseType;
  const changedTenure = tenure !== currentTenure;

  const subtitle = [
    changedPurchaseType && `purchase type from ${PURCHASE_TYPE_LABELS[currentPurchaseType]} to ${PURCHASE_TYPE_LABELS[purchaseType]}`,
    changedTenure && `tenure from ${TENURE_LABELS[currentTenure]} to ${TENURE_LABELS[tenure]}`,
  ].filter(Boolean).join(" and ");

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[88vh] flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              {delta ? "Sale details changed" : "Edit sale details"}
            </h2>
            <button
              onClick={onClose}
              disabled={saving}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {delta && subtitle && (
            <p className="text-sm text-slate-500 mt-1">Updating {subtitle}.</p>
          )}
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {!delta ? (
            /* ── Form step ── */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Purchase type
                </label>
                <select
                  value={purchaseType}
                  onChange={(e) => setPurchaseType(e.target.value as PurchaseType)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="mortgage">Mortgage</option>
                  <option value="cash_buyer">Cash buyer</option>
                  <option value="cash_from_proceeds">Cash from Proceeds</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Tenure
                </label>
                <select
                  value={tenure}
                  onChange={(e) => setTenure(e.target.value as Tenure)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="leasehold">Leasehold</option>
                  <option value="freehold">Freehold</option>
                </select>
              </div>
            </div>
          ) : (
            /* ── Preview step ── */
            <div>
              <DeltaList
                label="Milestones that will be marked not required"
                items={delta.becomingNr}
                color="red"
              />
              <DeltaList
                label="Milestones that will be re-activated"
                items={delta.becomingRequired}
                color="green"
              />
              {(delta.becomingNr.length > 0 || delta.becomingRequired.length > 0) && (() => {
                const workloadUnchanged = delta.projectedPercent < delta.currentPercent && delta.projectedRemaining === delta.currentRemaining;
                return (
                  <>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-slate-400 mb-0.5">Current</p>
                        <p className="text-xl font-semibold text-slate-700">{delta.currentPercent}%</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{delta.currentRemaining} left</p>
                      </div>
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      <div className="text-center">
                        <p className="text-xs text-slate-400 mb-0.5">After</p>
                        <p className={`text-xl font-semibold ${delta.projectedPercent > delta.currentPercent ? "text-emerald-600" : delta.projectedPercent < delta.currentPercent ? "text-orange-500" : "text-slate-700"}`}>
                          {delta.projectedPercent}%
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{delta.projectedRemaining} left</p>
                      </div>
                    </div>
                    {workloadUnchanged && (
                      <p className="mt-2 text-[11px] text-slate-400 leading-snug">
                        The milestones removed were already completed — your remaining workload is unchanged.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          )}
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-slate-100 flex gap-3">
          {!delta ? (
            <>
              <button
                onClick={handlePreview}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-sm font-semibold text-white transition-colors"
              >
                {loading ? "Checking…" : "Preview changes"}
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-sm font-semibold text-white transition-colors"
              >
                {saving ? "Updating…" : "Update sale details"}
              </button>
              <button
                onClick={() => setDelta(null)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
