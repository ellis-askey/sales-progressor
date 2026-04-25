"use client";

import { useState, useTransition } from "react";
import { updateSolicitorRecommendationAction, createRecommendedSolicitorAction } from "@/app/actions/solicitors";

type Firm = {
  id: string;
  name: string;
  isRecommended: boolean;
  defaultReferralFeePence: number | null;
};

const FIELD = "w-full px-3 py-2 text-sm rounded-lg bg-white/50 border border-white/30 text-slate-900/80 placeholder-slate-400 focus:outline-none focus:border-blue-400/60";

export function RecommendedSolicitorsSettings({ initialFirms }: { initialFirms: Firm[] }) {
  const [firms, setFirms] = useState<Firm[]>(initialFirms);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function fmtFee(pence: number | null) {
    if (!pence) return "";
    return (pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function parseFee(val: string): number | null {
    const n = parseFloat(val.replace(/,/g, ""));
    return isNaN(n) || n <= 0 ? null : Math.round(n * 100);
  }

  function updateLocal(id: string, patch: Partial<Firm>) {
    setFirms((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function saveRow(firm: Firm) {
    setSaving(firm.id);
    startTransition(async () => {
      try {
        await updateSolicitorRecommendationAction(firm.id, firm.isRecommended, firm.defaultReferralFeePence);
      } finally {
        setSaving(null);
      }
    });
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await createRecommendedSolicitorAction(newName.trim());
      // Optimistic local add (real id unknown until revalidate, but revalidatePath refreshes server)
      setFirms((prev) => [...prev, { id: `tmp-${Date.now()}`, name: newName.trim(), isRecommended: true, defaultReferralFeePence: null }]);
      setNewName("");
      setShowAdd(false);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-3">
      {firms.length === 0 && !showAdd && (
        <p className="text-sm text-slate-900/40 italic">No solicitor firms added yet.</p>
      )}

      {firms.map((firm) => (
        <div key={firm.id} className="flex items-center gap-3 py-2 border-b border-white/15 last:border-0">
          {/* Recommended toggle */}
          <button
            type="button"
            onClick={() => {
              const updated = { ...firm, isRecommended: !firm.isRecommended };
              updateLocal(firm.id, { isRecommended: updated.isRecommended });
              saveRow(updated);
            }}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              firm.isRecommended ? "bg-emerald-500" : "bg-slate-200"
            }`}
            role="switch"
            aria-checked={firm.isRecommended}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${firm.isRecommended ? "translate-x-4" : "translate-x-0"}`} />
          </button>

          {/* Firm name */}
          <span className="flex-1 text-sm font-medium text-slate-900/80 truncate">{firm.name}</span>

          {/* Default fee */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-slate-900/40">£</span>
            <input
              type="text"
              inputMode="numeric"
              value={firm.defaultReferralFeePence ? fmtFee(firm.defaultReferralFeePence) : ""}
              onChange={(e) => updateLocal(firm.id, { defaultReferralFeePence: parseFee(e.target.value) })}
              onBlur={() => saveRow(firm)}
              placeholder="fee"
              className="w-24 px-2 py-1 text-sm rounded-lg bg-white/50 border border-white/30 text-slate-900/80 placeholder-slate-400 focus:outline-none focus:border-blue-400/60"
            />
          </div>

          {saving === firm.id && (
            <span className="text-xs text-slate-900/30 flex-shrink-0">Saving…</span>
          )}
        </div>
      ))}

      {showAdd ? (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Firm name"
            className={FIELD}
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="px-3 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            {adding ? "Adding…" : "Add"}
          </button>
          <button
            onClick={() => { setShowAdd(false); setNewName(""); }}
            className="px-3 py-2 text-sm text-slate-900/50 hover:text-slate-900/80 rounded-lg hover:bg-white/20 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs font-semibold text-slate-900/60 hover:text-slate-900/90 transition-colors"
        >
          + Add solicitor firm
        </button>
      )}
    </div>
  );
}
