"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  upsertRecommendedSolicitorAction,
  removeRecommendedSolicitorAction,
  createAndRecommendSolicitorAction,
} from "@/app/actions/solicitors";

type RecommendedFirm = {
  id: string;         // AgencyRecommendedSolicitor id
  firmId: string;
  firmName: string;
  defaultReferralFeePence: number | null;
};

type AllFirm = { id: string; name: string };

function fmtFee(pence: number | null) {
  if (!pence) return "";
  return (pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function parseFee(val: string): number | null {
  const n = parseFloat(val.replace(/,/g, ""));
  return isNaN(n) || n <= 0 ? null : Math.round(n * 100);
}

export function RecommendedSolicitorsSettings({
  initialRecommended,
  allFirms,
}: {
  initialRecommended: RecommendedFirm[];
  allFirms: AllFirm[];
}) {
  const [recommended, setRecommended] = useState<RecommendedFirm[]>(initialRecommended);
  const [saving, setSaving] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // search / add state
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [adding, setAdding] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const recommendedIds = new Set(recommended.map((r) => r.firmId));

  const filtered = allFirms.filter(
    (f) => !recommendedIds.has(f.id) && f.name.toLowerCase().includes(query.toLowerCase()),
  );

  function updateFee(firmId: string, pence: number | null) {
    setRecommended((prev) =>
      prev.map((r) => (r.firmId === firmId ? { ...r, defaultReferralFeePence: pence } : r)),
    );
  }

  function saveFee(firmId: string, pence: number | null) {
    setSaving(firmId);
    startTransition(async () => {
      try { await upsertRecommendedSolicitorAction(firmId, pence); }
      finally { setSaving(null); }
    });
  }

  function handleRemove(firmId: string) {
    setRemoving(firmId);
    startTransition(async () => {
      try {
        await removeRecommendedSolicitorAction(firmId);
        setRecommended((prev) => prev.filter((r) => r.firmId !== firmId));
      } finally { setRemoving(null); }
    });
  }

  async function handleSelect(firm: AllFirm) {
    setQuery("");
    setShowSearch(false);
    setAdding(true);
    try {
      await upsertRecommendedSolicitorAction(firm.id, null);
      setRecommended((prev) => [...prev, { id: "", firmId: firm.id, firmName: firm.name, defaultReferralFeePence: null }]);
    } finally { setAdding(false); }
  }

  async function handleCreateNew() {
    const name = query.trim();
    if (!name) return;
    setAdding(true);
    setShowSearch(false);
    try {
      await createAndRecommendSolicitorAction(name);
      setRecommended((prev) => [...prev, { id: "", firmId: name, firmName: name, defaultReferralFeePence: null }]);
      setQuery("");
    } finally { setAdding(false); }
  }

  return (
    <div className="space-y-3">
      {recommended.length === 0 && (
        <p className="text-sm text-slate-900/40 italic">No recommended firms yet.</p>
      )}

      {/* Recommended rows */}
      {recommended.map((r) => (
        <div key={r.firmId} className="flex items-center gap-3 py-2 border-b border-white/15 last:border-0">
          <span className="flex-1 text-sm font-medium text-slate-900/80 truncate">{r.firmName}</span>

          {/* Default fee */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-slate-900/40">£</span>
            <input
              type="text"
              inputMode="numeric"
              value={fmtFee(r.defaultReferralFeePence)}
              onChange={(e) => updateFee(r.firmId, parseFee(e.target.value))}
              onBlur={() => saveFee(r.firmId, r.defaultReferralFeePence)}
              placeholder="default fee"
              className="w-28 px-2 py-1 text-sm rounded-lg bg-white/50 border border-white/30 text-slate-900/80 placeholder-slate-400 focus:outline-none focus:border-blue-400/60"
            />
          </div>

          {saving === r.firmId && <span className="text-xs text-slate-900/30 flex-shrink-0">Saving…</span>}

          <button
            onClick={() => handleRemove(r.firmId)}
            disabled={removing === r.firmId}
            className="text-xs text-slate-900/30 hover:text-red-400 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            {removing === r.firmId ? "…" : "Remove"}
          </button>
        </div>
      ))}

      {/* Search / add */}
      <div ref={searchRef} className="relative pt-1">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            placeholder={adding ? "Adding…" : "Search or add a solicitor firm…"}
            disabled={adding}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-white/50 border border-white/30 text-slate-900/80 placeholder-slate-400 focus:outline-none focus:border-blue-400/60 disabled:opacity-50"
          />
        </div>

        {showSearch && (query.length > 0 || filtered.length > 0) && (
          <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl bg-white/90 border border-white/40 shadow-lg overflow-hidden max-h-52 overflow-y-auto">
            {filtered.map((f) => (
              <button
                key={f.id}
                onMouseDown={() => handleSelect(f)}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-900/80 hover:bg-blue-50/60 transition-colors"
              >
                {f.name}
              </button>
            ))}
            {query.trim() && !allFirms.some((f) => f.name.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                onMouseDown={handleCreateNew}
                className="w-full text-left px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50/60 transition-colors border-t border-white/30"
              >
                + Add &ldquo;{query.trim()}&rdquo; as a new firm
              </button>
            )}
            {filtered.length === 0 && !query.trim() && (
              <p className="px-4 py-3 text-sm text-slate-900/40 italic">All known firms already added.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
