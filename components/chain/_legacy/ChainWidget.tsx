"use client";

import { useEffect, useState } from "react";
import { ChainMap } from "./ChainMap";
import type { ChainData } from "@/lib/services/chains";

type ExternalStatus = "Unknown" | "Active" | "At risk" | "Slow" | "Withdrawn";
const EXTERNAL_STATUSES: ExternalStatus[] = ["Unknown", "Active", "At risk", "Slow", "Withdrawn"];

type NewLink = {
  position: number;
  transactionId?: string | null;
  externalAddress?: string | null;
  externalStatus?: string | null;
};

export function ChainWidget({ transactionId }: { transactionId: string }) {
  const [chain, setChain] = useState<ChainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [links, setLinks] = useState<NewLink[]>([
    { position: 1, transactionId, externalAddress: null, externalStatus: null },
  ]);

  useEffect(() => {
    fetch(`/api/chains?transactionId=${transactionId}`)
      .then((r) => { if (!r.ok) throw new Error("not ok"); return r.json(); })
      .then((d) => setChain(d.chain))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [transactionId]);

  async function saveChain() {
    setSaving(true);
    try {
      const res = await fetch("/api/chains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, links }),
      });
      const d = await res.json();
      setChain(d.chain);
      setAdding(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteChain() {
    if (!chain) return;
    setSaving(true);
    try {
      await fetch(`/api/chains/${chain.id}`, { method: "DELETE" });
      setChain(null);
      setLinks([{ position: 1, transactionId, externalAddress: null, externalStatus: null }]);
    } finally {
      setSaving(false);
    }
  }

  function addLink() {
    setLinks((prev) => [
      ...prev,
      { position: prev.length + 1, transactionId: null, externalAddress: "", externalStatus: "Unknown" },
    ]);
  }

  function updateLink(i: number, patch: Partial<NewLink>) {
    setLinks((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, position: idx + 1 })));
  }

  if (loading) {
    return (
      <div className="glass-card px-5 py-4">
        <p className="text-sm text-slate-900/30">Loading chain data…</p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
      <div className="px-5 py-4 border-b border-white/20 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900/90">Property chain</p>
          <p className="text-xs text-slate-900/40 mt-0.5">
            {chain ? "Weakest link highlighted" : "Add the chain to identify weak links"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {chain && !adding && (
            <>
              <button
                onClick={() => setAdding(true)}
                className="text-xs text-blue-500 hover:text-blue-600 font-medium"
              >
                Edit
              </button>
              <button
                onClick={deleteChain}
                disabled={saving}
                className="text-xs text-slate-900/30 hover:text-red-500 transition-colors"
              >
                Remove
              </button>
            </>
          )}
          {!chain && !adding && (
            <button
              onClick={() => setAdding(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-50/60 text-blue-600 hover:bg-blue-100/60 font-medium transition-colors"
            >
              + Add chain
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {!adding && chain && (
          <ChainMap chain={chain} currentTransactionId={transactionId} />
        )}

        {!adding && !chain && (
          <p className="text-sm text-slate-900/30 italic text-center py-4">
            No chain added yet. Click &ldquo;Add chain&rdquo; to map the links.
          </p>
        )}

        {adding && (
          <div className="space-y-3">
            <p className="text-xs text-slate-900/50 mb-3">
              Position 1 = bottom of chain (buyer), highest = top (seller). This file is pre-filled.
            </p>

            {links.map((link, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-white/30 bg-white/20">
                <div className="w-6 h-6 rounded-full bg-white/40 border border-white/30 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-slate-900/50 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 space-y-2">
                  {link.transactionId ? (
                    <p className="text-sm font-medium text-blue-600">This file (auto)</p>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Property address"
                        value={link.externalAddress ?? ""}
                        onChange={(e) => updateLink(i, { externalAddress: e.target.value })}
                        className="glass-input w-full text-sm px-3 py-2"
                      />
                      <select
                        value={link.externalStatus ?? "Unknown"}
                        onChange={(e) => updateLink(i, { externalStatus: e.target.value })}
                        className="glass-input text-sm px-3 py-2"
                      >
                        {EXTERNAL_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
                {!link.transactionId && (
                  <button
                    type="button"
                    onClick={() => removeLink(i)}
                    className="text-slate-900/30 hover:text-red-400 transition-colors mt-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addLink}
              className="w-full text-xs text-slate-900/40 hover:text-blue-500 border border-dashed border-white/30 rounded-lg py-2.5 transition-colors"
            >
              + Add link
            </button>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={saveChain}
                disabled={saving}
                className="text-xs px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save chain"}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="text-xs text-slate-900/40 hover:text-slate-900/70"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
